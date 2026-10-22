/**
 * PDF 合并服务
 * - mergePrintImages: 打印文件合并（不拼接=210×140mm单页；拼接=A4每页2张）
 * - mergeOtherPdfs: 其他票据直接按页合并（保持原始尺寸）
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PDFDocument } from 'pdf-lib'
import { PRINT_PAPER_MM, PRINT_MARGIN_MM, MM_TO_PT } from '../utils/constants'

// Worker 已在 pdfParser.js 中设置，此处仅在未设置时补设
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
}

// A4 尺寸（points）
const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

/**
 * 将 PDF ArrayBuffer 的每一页渲染为 PNG Uint8Array
 * @param {ArrayBuffer} arrayBuffer
 * @param {number} scale - 渲染缩放比，默认 2.0
 * @returns {Promise<Uint8Array[]>}
 */
export async function renderPagesToPng(arrayBuffer, scale = 2.0) {
  const data = new Uint8Array(arrayBuffer.slice(0))
  const pdfDoc = await pdfjsLib.getDocument({
    data,
    cMapUrl: '/cmaps/',
    cMapPacked: true
  }).promise
  const pages = []

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')

    await page.render({ canvasContext: ctx, viewport }).promise

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    pages.push(new Uint8Array(await blob.arrayBuffer()))

    canvas.width = 0
    canvas.height = 0
  }

  return pages
}

/**
 * 将文件句柄对应的 PDF 渲染为每页 PNG
 * @param {FileSystemFileHandle} fileHandle
 * @param {number} [scale=2.0]
 * @returns {Promise<Uint8Array[]>}
 */
export async function fileToPngs(fileHandle, scale = 2.0) {
  const file = await fileHandle.getFile()
  const buffer = await file.arrayBuffer()
  return renderPagesToPng(buffer, scale)
}

/**
 * 打印文件合并：把所有页面图片按顺序排版
 * @param {Uint8Array[]} pngList - 有序的每页 PNG
 * @param {Object} [opts]
 * @param {'twoPerPage'|'onePerPage'} [opts.mode='twoPerPage']
 * @param {number} [opts.marginMm=PRINT_MARGIN_MM]
 * @returns {Promise<Uint8Array>}
 */
export async function mergePrintImages(pngList, { mode = 'twoPerPage', marginMm = PRINT_MARGIN_MM } = {}) {
  if (!pngList || pngList.length === 0) {
    throw new Error('没有可合并的打印页面')
  }

  const pdfDoc = await PDFDocument.create()

  if (mode === 'onePerPage') {
    const pageW = PRINT_PAPER_MM.width * MM_TO_PT
    const pageH = PRINT_PAPER_MM.height * MM_TO_PT
    const margin = marginMm * MM_TO_PT

    for (const png of pngList) {
      const page = pdfDoc.addPage([pageW, pageH])
      const img = await pdfDoc.embedPng(png)
      const dims = fitImage(img.width, img.height, pageW - margin * 2, pageH - margin * 2)
      page.drawImage(img, {
        x: (pageW - dims.width) / 2,
        y: (pageH - dims.height) / 2,
        width: dims.width,
        height: dims.height
      })
    }
    return await pdfDoc.save()
  }

  // 拼接：A4 每页上下 2 张
  const MARGIN = 20
  const HALF_HEIGHT = A4_HEIGHT / 2
  for (let i = 0; i < pngList.length; i += 2) {
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])

    const topImg = await pdfDoc.embedPng(pngList[i])
    const topDims = fitImage(topImg.width, topImg.height, A4_WIDTH - MARGIN * 2, HALF_HEIGHT - MARGIN)
    page.drawImage(topImg, {
      x: (A4_WIDTH - topDims.width) / 2,
      y: HALF_HEIGHT + (HALF_HEIGHT - topDims.height) / 2 - MARGIN / 2,
      width: topDims.width,
      height: topDims.height
    })

    if (i + 1 < pngList.length) {
      const btmImg = await pdfDoc.embedPng(pngList[i + 1])
      const btmDims = fitImage(btmImg.width, btmImg.height, A4_WIDTH - MARGIN * 2, HALF_HEIGHT - MARGIN)
      page.drawImage(btmImg, {
        x: (A4_WIDTH - btmDims.width) / 2,
        y: (HALF_HEIGHT - btmDims.height) / 2 + MARGIN / 2,
        width: btmDims.width,
        height: btmDims.height
      })
    }
  }

  return await pdfDoc.save()
}

/**
 * 非发票类 PDF 直接按页合并（保持原始尺寸）
 * @param {Object[]} otherPdfs - 发票对象数组，每个对象有 fileHandle 属性
 * @param {Function} [onProgress] - 进度回调 (current, total)
 * @returns {Promise<Uint8Array>}
 */
export async function mergeOtherPdfs(otherPdfs, onProgress) {
  const newDoc = await PDFDocument.create()
  let processed = 0

  for (const inv of otherPdfs) {
    const file = await inv.fileHandle.getFile()
    const buffer = await file.arrayBuffer()
    const srcDoc = await PDFDocument.load(buffer)
    const pages = await newDoc.copyPages(srcDoc, srcDoc.getPageIndices())
    pages.forEach(p => newDoc.addPage(p))
    processed++
    onProgress?.(processed, otherPdfs.length)
  }

  return await newDoc.save()
}

/**
 * 按比例缩放图片以适配目标区域
 */
function fitImage(imgW, imgH, maxW, maxH) {
  const ratio = Math.min(maxW / imgW, maxH / imgH)
  return { width: imgW * ratio, height: imgH * ratio }
}