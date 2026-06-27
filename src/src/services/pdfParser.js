// 使用 legacy build：内置了 Uint8Array.prototype.toHex/toBase64 等新特性的 polyfill，
// 兼容旧版 Chrome / Edge / Firefox（避免 "hashOriginal.toHex is not a function" 错误）。
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

// 设置 worker（Vite 环境下，使用 legacy worker 以匹配 legacy 主库）
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url
).href

/**
 * 从 PDF 文件中抽取所有文本
 * @param {File | ArrayBuffer} input - PDF 文件或 ArrayBuffer
 * @returns {Promise<{ text: string, isScanned: boolean }>}
 *   text: 提取的全部文本（各页合并）
 *   isScanned: 如果文本很少（<20字符），判定为扫描件
 */
export async function parsePdf(input) {
  let data
  if (input instanceof File) {
    const raw = await input.arrayBuffer()
    data = raw.slice(0)  // 创建副本，避免 pdfjs transfer 后 ArrayBuffer detached
  } else if (input instanceof ArrayBuffer) {
    data = input.slice(0)  // 创建副本，避免 pdfjs transfer 后 ArrayBuffer detached
  } else {
    throw new Error('输入参数必须是 File 或 ArrayBuffer 类型')
  }

  let pdfDoc
  try {
    const loadingTask = pdfjsLib.getDocument({ data })
    pdfDoc = await loadingTask.promise
  } catch (e) {
    const msg = e?.message || String(e)
    if (msg.includes('password')) {
      throw new Error('PDF 文件已加密，无法解析。请先解密后重试。')
    }
    if (msg.includes('Invalid PDF')) {
      throw new Error('PDF 文件已损坏或格式不正确，无法解析。')
    }
    throw new Error(`PDF 文件加载失败：${msg}`)
  }

  const pageTexts = []
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    try {
      const page = await pdfDoc.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => item.str)
        .join('')
      pageTexts.push(pageText)
    } catch (e) {
      // 单页解析失败时记录警告，继续解析其他页
      console.warn(`PDF 第 ${i} 页解析失败:`, e?.message || e)
      pageTexts.push('')
    }
  }

  const fullText = pageTexts.join('\n')
  const trimmedLength = fullText.replace(/\s/g, '').length

  // 阈值判断：低于10字符判定为扫描件
  // 火车票等PDF文本可能较短但非扫描件，阈值从20降至10
  let isScanned = trimmedLength < 10

  // 如果文本较短但包含火车票关键字，不标记为扫描件
  // 火车票PDF可能因格式特殊导致提取文本较少
  if (isScanned && trimmedLength > 0) {
    const trainKeywords = ['火车', '车次', '高铁', '动车', '列车', '座席', '乘车', '铁路', '客运']
    if (trainKeywords.some(kw => fullText.includes(kw))) {
      isScanned = false
    }
  }

  return { text: fullText, isScanned }
}

/**
 * 将 PDF 第一页渲染为图片（base64 PNG）
 * 用于扫描件/图片型 PDF 的视觉识别
 * @param {ArrayBuffer} arrayBuffer - PDF 文件的 ArrayBuffer
 * @returns {Promise<string>} 纯 base64 字符串（不含 data:image/png;base64, 前缀）
 */
export async function renderPdfPageToImage(arrayBuffer) {
  const data = arrayBuffer.slice(0)  // 创建副本，避免 pdfjs transfer 后 ArrayBuffer detached
  const loadingTask = pdfjsLib.getDocument({ data })
  const pdfDoc = await loadingTask.promise
  const page = await pdfDoc.getPage(1)

  const viewport = page.getViewport({ scale: 2 }) // scale=2 保证清晰度

  // 浏览器环境：使用 canvas
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')

  await page.render({
    canvasContext: ctx,
    viewport
  }).promise

  // 导出为 base64 PNG，去掉 data URL 前缀
  const dataUrl = canvas.toDataURL('image/png')
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')

  // 释放 canvas 内存
  canvas.width = 0
  canvas.height = 0

  return base64
}
