/**
 * 发票归档服务
 * 在输出目录创建分类文件夹并复制发票文件
 */
import { CATEGORIES } from '../utils/constants'

/**
 * 执行文件归档：在输出目录创建分类文件夹并复制发票文件
 * @param {FileSystemDirectoryHandle} outputDirHandle - 用户选择的输出目录
 * @param {Array} invoices - 分类后的发票数组
 * @param {Array} files - session store 的 files 数组（用于查找配套 XML fileHandle）
 * @param {string} folderName - 根文件夹名（如"张三+3870+BJ001"）
 * @param {Function} onProgress - 进度回调 (current, total)
 * @returns {Promise<{ success: boolean, errors: Array }>}
 */
export async function archiveInvoices(outputDirHandle, invoices, files, folderName, onProgress) {
  // 1. 创建根目录：outputDirHandle/folderName/
  const rootDir = await outputDirHandle.getDirectoryHandle(folderName, { create: true })

  // 2. 创建所有类别子目录
  const categoryDirs = {}
  for (const cat of CATEGORIES) {
    categoryDirs[cat.id] = await rootDir.getDirectoryHandle(cat.folder, { create: true })
  }

  // 3. 打车费特殊：创建 02_打车费/行程单/ 子目录
  const taxiItineraryDir = await categoryDirs['02'].getDirectoryHandle('行程单', { create: true })

  // 4. 遍历发票，复制文件到对应目录
  const errors = []
  let processed = 0
  const total = invoices.length

  for (const inv of invoices) {
    try {
      // 确定目标目录
      let targetDir = categoryDirs[inv.category] || categoryDirs['10']

      // 打车行程单特殊处理
      if (inv.category === '02' && inv.invoiceType === '打车行程单') {
        targetDir = taxiItineraryDir
      }

      // 复制 PDF/主文件
      if (inv.fileHandle) {
        const file = await inv.fileHandle.getFile()
        const newFileHandle = await targetDir.getFileHandle(file.name, { create: true })
        const writable = await newFileHandle.createWritable()
        await writable.write(await file.arrayBuffer())
        await writable.close()
      }

      // 复制配套 XML（如果有）
      const companionHandle = findCompanionFileHandle(inv, files)
      if (companionHandle) {
        const xmlFile = await companionHandle.getFile()
        const newXmlHandle = await targetDir.getFileHandle(xmlFile.name, { create: true })
        const writable = await newXmlHandle.createWritable()
        await writable.write(await xmlFile.arrayBuffer())
        await writable.close()
      }
    } catch (e) {
      errors.push({ fileName: inv.fileName || '未知文件', error: e.message })
    }

    processed++
    onProgress?.(processed, total)
  }

  return { success: errors.length === 0, errors }
}

/**
 * 通过 companionFileName 在 files 数组中查找配套 XML 的 fileHandle
 * @param {Object} invoice - 发票对象
 * @param {Array} files - session store 的 files 数组
 * @returns {FileSystemFileHandle|null}
 */
function findCompanionFileHandle(invoice, files) {
  if (!invoice.companionFileName || !files || !files.length) return null

  const companion = files.find(f => f.name === invoice.companionFileName)
  return companion?.fileHandle || null
}
