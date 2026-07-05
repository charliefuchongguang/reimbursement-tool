/**
 * PDF 合并服务
 * - mergeInvoicePdfs: 发票类PDF以"每页A4放2张"上下排版合并
 * - mergeOtherPdfs: 非发票类PDF直接按页合并（不做排版）
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PDFDocument } from 'pdf-lib'

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
 * @returns {Promise<Uint8Array[]>} 每页对应的 PNG 字节数组
 */
async function renderPagesToPng(arrayBuffer, scale = 2.0) {
  const data = new Uint8Array(arrayBuffer.slice(0)) // 副本，避免 pdfjs transfer 后 detached
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

    // 转为 Blob 再转 Uint8Array
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    const pngBytes = new Uint8Array(await blob.arrayBuffer())
    pages.push(pngBytes)

    // 释放 canvas
    canvas.width = 0
    canvas.height = 0
  }

  return pages
}

/**
 * 发票类 PDF 上下排版合并
 * 将所有发票的每一页渲染为图片，每张 A4 放 2 张（上/下半部分）
 * @param {Object[]} invoicePdfs - 发票对象数组，每个对象有 fileHandle 属性
 * @param {Function} [onProgress] - 进度回调 (current, total)
 * @returns {Promise<Uint8Array>} 合并后的 PDF 数据
 */
export async function mergeInvoicePdfs(invoicePdfs, onProgress) {
  // 1. 渲染所有发票的所有页面为 PNG
  const allImages = []
  let processed = 0

  for (const inv of invoicePdfs) {
    const file = await inv.fileHandle.getFile()
    const buffer = await file.arrayBuffer()
    const pages = await renderPagesToPng(buffer)
    allImages.push(...pages)
    processed++
    onProgress?.(processed, invoicePdfs.length)
  }

  if (allImages.length === 0) {
    throw new Error('没有可合并的发票页面')
  }

  // 2. 创建新 A4 PDF，每页放 2 张图片
  const pdfDoc = await PDFDocument.create()
  const MARGIN = 20
  const HALF_HEIGHT = A4_HEIGHT / 2

  for (let i = 0; i < allImages.length; i += 2) {
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])

    // 上半部分（第 i 张）
    const topImg = await pdfDoc.embedPng(allImages[i])
    const topDims = fitImage(topImg.width, topImg.height, A4_WIDTH - MARGIN * 2, HALF_HEIGHT - MARGIN)
    const topX = (A4_WIDTH - topDims.width) / 2
    const topY = HALF_HEIGHT + (HALF_HEIGHT - topDims.height) / 2 - MARGIN / 2
    page.drawImage(topImg, { x: topX, y: topY, width: topDims.width, height: topDims.height })

    // 下半部分（第 i+1 张，如果存在）
    if (i + 1 < allImages.length) {
      const btmImg = await pdfDoc.embedPng(allImages[i + 1])
      const btmDims = fitImage(btmImg.width, btmImg.height, A4_WIDTH - MARGIN * 2, HALF_HEIGHT - MARGIN)
      const btmX = (A4_WIDTH - btmDims.width) / 2
      const btmY = (HALF_HEIGHT - btmDims.height) / 2 + MARGIN / 2
      page.drawImage(btmImg, { x: btmX, y: btmY, width: btmDims.width, height: btmDims.height })
    }
  }

  return await pdfDoc.save()
}

/**
 * 非发票类 PDF 直接按页合并（保持原始尺寸）
 * @param {Object[]} otherPdfs - 发票对象数组，每个对象有 fileHandle 属性
 * @param {Function} [onProgress] - 进度回调 (current, total)
 * @returns {Promise<Uint8Array>} 合并后的 PDF 数据
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
 * @param {number} imgW - 图片原始宽度
 * @param {number} imgH - 图片原始高度
 * @param {number} maxW - 目标最大宽度
 * @param {number} maxH - 目标最大高度
 * @returns {{ width: number, height: number }}
 */
function fitImage(imgW, imgH, maxW, maxH) {
  const ratio = Math.min(maxW / imgW, maxH / imgH)
  return { width: imgW * ratio, height: imgH * ratio }
}
