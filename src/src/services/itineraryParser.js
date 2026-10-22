/**
 * 打车行程单解析服务
 * 从滴滴出行 / 高德打车等行程单 PDF 中提取「汇总信息 + 行程表格行」
 * 供打印时重构成横版行程单使用。
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
}

// 同一行的 y 坐标容差
const ROW_TOLERANCE = 6

/**
 * 解析行程单 PDF
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<Object>} 解析结果；失败时返回 { ok:false, reason }
 */
export async function parseItineraryPdf(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer.slice(0))
  const pdfDoc = await pdfjsLib.getDocument({
    data,
    cMapUrl: '/cmaps/',
    cMapPacked: true
  }).promise

  const items = []
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p)
    const content = await page.getTextContent()
    for (const it of content.items) {
      const s = (it.str || '').replace(/\s+/g, ' ').trim()
      if (!s) continue
      items.push({ x: it.transform[4], y: it.transform[5], w: it.width || 0, s })
    }
  }

  return parseItineraryItems(items)
}

/**
 * 从文本项解析行程单结构
 */
export function parseItineraryItems(items) {
  if (!items || items.length === 0) return { ok: false, reason: 'no_text' }

  const rows = groupRows(items)
  const headerIndex = rows.findIndex(
    (r) =>
      r.items.some((c) => c.s === '序号') &&
      r.items.some((c) => c.s.startsWith('金额')) &&
      r.items.some((c) => c.s === '起点' || c.s === '终点')
  )
  if (headerIndex === -1) return { ok: false, reason: 'no_table' }

  const columns = rows[headerIndex].items.map((c) => ({
    key: columnKey(c.s),
    center: c.x + c.w / 2
  }))

  const dataRows = []
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const joined = row.items.map((c) => c.s).join('')
    if (/^说明|^页码/.test(joined)) break
    const cells = {}
    for (const item of row.items) {
      const center = item.x + item.w / 2
      let nearest = null
      let nearestDist = Infinity
      for (const col of columns) {
        const dist = Math.abs(col.center - center)
        if (dist < nearestDist) {
          nearestDist = dist
          nearest = col
        }
      }
      if (nearest && nearest.key) {
        cells[nearest.key] = cells[nearest.key] ? `${cells[nearest.key]} ${item.s}` : item.s
      }
    }
    if (cells.idx && /^\d+$/.test(cells.idx.trim())) {
      dataRows.push(cells)
    }
  }

  const summary = parseSummary(items)

  return {
    ok: dataRows.length > 0 || !!summary.total,
    vendor: summary.vendor,
    title: `${summary.vendor || '打车'}行程单`,
    summary,
    rows: dataRows.map((r) => ({
      idx: (r.idx || '').trim(),
      time: (r.time || '').trim(),
      from: (r.from || '').replace(/\|/g, '\n').trim(),
      to: (r.to || '').replace(/\|/g, '\n').trim(),
      amount: (r.amount || '').replace(/元$/, '').trim()
    }))
  }
}

/**
 * 按 y 坐标把文本项分组为行
 */
function groupRows(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows = []
  for (const item of sorted) {
    const last = rows[rows.length - 1]
    if (last && Math.abs(last.y - item.y) <= ROW_TOLERANCE) {
      last.items.push(item)
    } else {
      rows.push({ y: item.y, items: [item] })
    }
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x)
  return rows
}

/**
 * 表头名称 → 字段键
 */
function columnKey(name) {
  const n = name.replace(/\s/g, '')
  if (n.startsWith('序号')) return 'idx'
  if (n.startsWith('上车时间')) return 'time'
  if (n.startsWith('起点')) return 'from'
  if (n.startsWith('终点')) return 'to'
  if (n.startsWith('金额')) return 'amount'
  return null
}

/**
 * 汇总信息：合计金额、行程数、手机号、日期范围、供应商
 */
function parseSummary(items) {
  const flat = items.map((i) => i.s).join(' ')

  const totalMatch = flat.match(/合计\s*([0-9]+(?:\.[0-9]+)?)\s*元/)
  const countMatch = flat.match(/共[计]?\s*([0-9]+)\s*[单笔]?\s*行程/)
  const phoneMatch = flat.match(/手机号[:：]?\s*(1\d{10})/)

  let startDate = ''
  let endDate = ''
  const dateItem = items.find((i) => /行程起止日期[:：]|行程时间[:：]/.test(i.s))
  if (dateItem) {
    const m = dateItem.s.match(/[:：]\s*(.+?)至(.+)$/)
    if (m) {
      startDate = m[1].trim()
      endDate = m[2].trim()
    }
  }

  let vendor = ''
  if (flat.includes('高德')) vendor = '高德'
  else if (flat.includes('滴滴')) vendor = '滴滴'

  return {
    vendor,
    total: totalMatch ? Number(totalMatch[1]) : null,
    count: countMatch ? Number(countMatch[1]) : null,
    phone: phoneMatch ? phoneMatch[1] : '',
    startDate,
    endDate
  }
}