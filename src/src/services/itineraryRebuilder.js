/**
 * 行程单重构服务
 * 将解析后的行程单（汇总 + 行程表格）重绘成紧凑的横版页面（210×140mm），
 * 输出为一张或多张 PNG（供 PDF 合并时嵌入）。
 */
import { PRINT_PAPER_MM, PRINT_MARGIN_MM } from '../utils/constants'

const DPI = 300
const PX_PER_MM = DPI / 25.4

const FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif'
const TITLE_SIZE = 44
const SUMMARY_SIZE = 26
const HEADER_SIZE = 26
const CELL_SIZE = 24
const FOOTER_SIZE = 16

const PAD_X = 12
const PAD_Y = 10

// 表格列：字段 + 宽度占比
const COLUMNS = [
  { key: 'idx', title: '序号', ratio: 0.07, align: 'center' },
  { key: 'time', title: '上车时间', ratio: 0.21, align: 'left' },
  { key: 'from', title: '起点', ratio: 0.31, align: 'left' },
  { key: 'to', title: '终点', ratio: 0.31, align: 'left' },
  { key: 'amount', title: '金额', ratio: 0.10, align: 'right' }
]

const FOOTER_TEXT = '说明：行程单金额可能包括路桥费、高速费、停车费、优惠券等附加费用金额。'

/**
 * 生成重构后的行程单页面 PNG
 * @param {Object} parsed - parseItineraryPdf 的结果
 * @returns {Promise<Uint8Array[]>} 每页 PNG 字节
 */
export async function rebuildItineraryPngs(parsed) {
  const W = Math.round(PRINT_PAPER_MM.width * PX_PER_MM)
  const H = Math.round(PRINT_PAPER_MM.height * PX_PER_MM)
  const margin = Math.round(PRINT_MARGIN_MM * PX_PER_MM)
  const contentW = W - margin * 2
  const contentH = H - margin * 2

  const colWidths = COLUMNS.map((c) => Math.round(contentW * c.ratio))
  const firstColX = margin
  const colX = []
  let acc = firstColX
  for (const w of colWidths) {
    colX.push(acc)
    acc += w
  }

  const lineH = Math.round(CELL_SIZE * 1.4)
  const headerH = HEADER_SIZE * 1.5 + PAD_Y * 2
  const titleH = titleBlockHeight(parsed)
  const footerH = FOOTER_TEXT ? FOOTER_SIZE * 1.8 : 0
  const tableAreaH = contentH - titleH - headerH - footerH

  // 预先计算每行高度
  const measureCanvas = document.createElement('canvas')
  const mctx = measureCanvas.getContext('2d')
  const rows = (parsed.rows || []).map((r) => {
    const cellLines = COLUMNS.map((c, i) => {
      mctx.font = font(CELL_SIZE, c.key === 'idx' || c.key === 'amount')
      const maxLines = c.key === 'from' || c.key === 'to' ? 3 : 2
      return clampLines(wrapText(mctx, r[c.key] || '', colWidths[i] - PAD_X * 2), maxLines)
    })
    const maxLines = Math.max(1, ...cellLines.map((l) => l.length))
    const height = maxLines * lineH + PAD_Y * 2
    return { data: r, cellLines, height }
  })

  // 分页
  const pages = []
  let current = []
  let usedH = 0
  for (const row of rows) {
    if (usedH + row.height > tableAreaH && current.length > 0) {
      pages.push(current)
      current = []
      usedH = 0
    }
    current.push(row)
    usedH += row.height
  }
  pages.push(current)

  // 渲染每一页
  const pngs = []
  for (let p = 0; p < pages.length; p++) {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    let y = margin
    y = drawTitleBlock(ctx, parsed, margin, y, contentW)
    y = drawTableHeader(ctx, colX, colWidths, y, headerH)
    for (let r = 0; r < pages[p].length; r++) {
      y = drawRow(ctx, pages[p][r], colX, colWidths, y, r % 2 === 1)
    }

    if (FOOTER_TEXT) {
      ctx.fillStyle = '#909399'
      ctx.font = font(FOOTER_SIZE, false)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText(FOOTER_TEXT, margin, H - margin)
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    pngs.push(new Uint8Array(await blob.arrayBuffer()))

    canvas.width = 0
    canvas.height = 0
  }

  measureCanvas.width = 0
  measureCanvas.height = 0
  return pngs
}

function titleBlockHeight(parsed) {
  const summaryLines = buildSummaryLines(parsed).length
  return TITLE_SIZE * 1.6 + summaryLines * SUMMARY_SIZE * 1.7 + 20
}

function buildSummaryLines(parsed) {
  const s = parsed.summary || {}
  const lines = []
  const parts = []
  if (s.phone) parts.push(`行程人手机号：${s.phone}`)
  if (s.count != null) parts.push(`共 ${s.count} 单行程`)
  if (s.total != null) parts.push(`合计 ${s.total} 元`)
  if (parts.length) lines.push(parts.join('　　'))
  if (s.startDate) {
    lines.push(`行程日期：${s.startDate}${s.endDate && s.endDate !== s.startDate ? ' 至 ' + s.endDate : ''}`)
  }
  return lines
}

function drawTitleBlock(ctx, parsed, x, y, contentW) {
  ctx.fillStyle = '#1f2d3d'
  ctx.font = font(TITLE_SIZE, true)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(parsed.title || '行程单', x + contentW / 2, y)
  y += TITLE_SIZE * 1.6

  ctx.fillStyle = '#606266'
  ctx.font = font(SUMMARY_SIZE, false)
  ctx.textAlign = 'left'
  for (const line of buildSummaryLines(parsed)) {
    ctx.fillText(line, x, y)
    y += SUMMARY_SIZE * 1.7
  }
  return y + 20
}

function drawTableHeader(ctx, colX, colWidths, y, headerH) {
  ctx.fillStyle = '#2b6cb0'
  ctx.fillRect(colX[0], y, colX[colX.length - 1] + colWidths[colWidths.length - 1] - colX[0], headerH)

  ctx.fillStyle = '#ffffff'
  ctx.font = font(HEADER_SIZE, true)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < COLUMNS.length; i++) {
    ctx.fillText(COLUMNS[i].title, colX[i] + colWidths[i] / 2, y + headerH / 2)
  }
  return y + headerH
}

function drawRow(ctx, row, colX, colWidths, y, shaded) {
  const rowH = row.height
  if (shaded) {
    ctx.fillStyle = '#f5f7fa'
    ctx.fillRect(colX[0], y, colX[colX.length - 1] + colWidths[colWidths.length - 1] - colX[0], rowH)
  }

  ctx.font = font(CELL_SIZE, false)
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#303133'
  for (let i = 0; i < COLUMNS.length; i++) {
    const col = COLUMNS[i]
    const lines = row.cellLines[i]
    const cellX = colX[i]
    const cellW = colWidths[i]
    let ty = y + PAD_Y
    for (const line of lines) {
      let tx = cellX + PAD_X
      let align = 'left'
      if (col.align === 'center') {
        tx = cellX + cellW / 2
        align = 'center'
      } else if (col.align === 'right') {
        tx = cellX + cellW - PAD_X
        align = 'right'
      }
      ctx.textAlign = align
      ctx.fillText(line, tx, ty)
      ty += Math.round(CELL_SIZE * 1.4)
    }
  }

  // 行分隔线
  ctx.strokeStyle = '#e4e7ed'
  ctx.beginPath()
  const right = colX[colX.length - 1] + colWidths[colWidths.length - 1]
  ctx.moveTo(colX[0], y + rowH)
  ctx.lineTo(right, y + rowH)
  ctx.stroke()

  return y + rowH
}

function font(size, bold) {
  return `${bold ? 'bold ' : ''}${size}px ${FONT_FAMILY}`
}

function wrapText(ctx, text, maxWidth) {
  const lines = []
  for (const para of String(text).split('\n')) {
    let line = ''
    for (const ch of para) {
      const test = line + ch
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line)
        line = ch
      } else {
        line = test
      }
    }
    lines.push(line)
  }
  return lines
}

function clampLines(lines, maxLines) {
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = kept[maxLines - 1].slice(0, -1) + '…'
  return kept
}