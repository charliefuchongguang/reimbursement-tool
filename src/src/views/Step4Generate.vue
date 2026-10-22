<template>
  <div class="step4-container">
    <!-- 预览区 -->
    <div class="section-card">
      <div class="section-title">预览</div>

      <!-- 输出文件夹结构 -->
      <div class="preview-block">
        <div class="preview-label">输出文件夹结构：</div>
        <div class="folder-tree">
          <div class="tree-line tree-root">📁 {{ folderName }}</div>
          <template v-for="cat in categoriesWithCount" :key="cat.id">
            <div class="tree-line tree-sub">
              <span>├── {{ cat.folder }}/</span>
              <span class="tree-count">({{ cat.count }}张)</span>
            </div>
            <div v-if="cat.id === '02'" class="tree-line tree-sub2">
              <span>│   └── 行程单/</span>
            </div>
          </template>
        </div>
      </div>

      <!-- 报销单文件名 -->
      <div class="preview-block">
        <div class="preview-label">报销单文件名：</div>
        <div class="excel-name">📄 {{ excelFileName }}</div>
      </div>
    </div>

    <!-- 操作区 -->
    <div class="section-card">
      <div class="section-title">操作</div>

      <!-- 打印文件合并方式 -->
      <div class="print-layout-option">
        <div class="option-label">生成打印文件</div>
        <el-radio-group v-model="printLayout">
          <el-radio value="twoPerPage">拼接（一张两页）</el-radio>
          <el-radio value="onePerPage">不拼接（一张一页）</el-radio>
        </el-radio-group>
      </div>

      <!-- 执行按钮 -->
      <el-button
        type="primary"
        size="large"
        :loading="executing"
        :disabled="completed"
        @click="execute"
      >
        <template #icon><el-icon><FolderAdd /></el-icon></template>
        选择输出目录并执行
      </el-button>

      <!-- 进度区 -->
      <div v-if="executing" class="progress-area">
        <el-progress
          :percentage="currentProgress"
          :stroke-width="18"
          :status="completed ? 'success' : ''"
        />
        <div class="progress-text">
          <div v-for="(step, idx) in completedSteps" :key="idx" class="step-completed">
            ✅ {{ step }}
          </div>
          <template v-if="archivePhase">
            正在归档文件... ({{ archiveCurrent }}/{{ archiveTotal }})
          </template>
          <template v-else-if="excelPhase">
            正在生成报销单...
          </template>
          <template v-else-if="mergePhase">
            正在合并PDF文件... ({{ mergeCurrent }}/{{ mergeTotal }})
          </template>
        </div>
      </div>
    </div>

    <!-- 完成区 -->
    <div v-if="completed" class="section-card success-card">
      <el-result icon="success" title="归档完成！" :sub-title="`共归档 ${sessionStore.invoices.length} 张发票，报销总额 ¥${formatMoney(formStore.totalAmount)}`">
        <template #extra>
          <div class="result-detail">
            <div class="result-item">📁 {{ folderName }}</div>
            <div class="result-item">📄 {{ excelFileName }}</div>
            <div v-for="mf in mergedFiles" :key="mf" class="result-item">📄 {{ mf }}</div>
          </div>
          <!-- PDF文件信息 -->
          <div v-if="pdfInfos.length > 0" class="pdf-info-list">
            <div class="pdf-info-title">📋 生成的PDF文件</div>
            <div v-for="info in pdfInfos" :key="info.name" class="pdf-info-item">
              <span class="pdf-info-name">{{ info.name }}</span>
              <span class="pdf-info-detail">{{ info.pages }}页，{{ info.size }}</span>
            </div>
          </div>
          <!-- 行程单匹配提示 -->
          <div v-if="mergeWarnings.length > 0" class="error-list">
            <el-alert
              type="warning"
              :closable="false"
              :title="`行程单提示（${mergeWarnings.length}）`"
            >
              <ul>
                <li v-for="(w, idx) in mergeWarnings" :key="idx">{{ w }}</li>
              </ul>
            </el-alert>
          </div>
          <!-- 归档失败文件 -->
          <div v-if="archiveErrors.length > 0" class="error-list">
            <el-alert
              type="warning"
              :closable="false"
              :title="`部分文件归档失败（${archiveErrors.length}个）`"
            >
              <ul>
                <li v-for="(err, idx) in archiveErrors" :key="idx">
                  {{ err.fileName }}：{{ err.error }}
                </li>
              </ul>
            </el-alert>
          </div>
        </template>
      </el-result>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { FolderAdd } from '@element-plus/icons-vue'
import { useSessionStore } from '../stores/session'
import { useFormStore } from '../stores/form'
import { useSettingsStore } from '../stores/settings'
import { useHistoryStore } from '../stores/history'
import { CATEGORIES } from '../utils/constants'
import { archiveInvoices } from '../services/archiver'
import { generateExcel } from '../services/excelGenerator'
import { fileToPngs, mergePrintImages, mergeOtherPdfs } from '../services/pdfMerger'
import { parseItineraryPdf } from '../services/itineraryParser'
import { rebuildItineraryPngs } from '../services/itineraryRebuilder'
import { PDFDocument } from 'pdf-lib'

const sessionStore = useSessionStore()
const formStore = useFormStore()
const settingsStore = useSettingsStore()
const historyStore = useHistoryStore()

// ─── 状态 ───
const executing = ref(false)
const completed = ref(false)
const archivePhase = ref(false)
const excelPhase = ref(false)
const archiveProgress = ref(0)
const archiveCurrent = ref(0)
const archiveTotal = ref(0)
const archiveErrors = ref([])
const mergePhase = ref(false)
const mergeCurrent = ref(0)
const mergeTotal = ref(0)
const mergedFiles = ref([])
const printLayout = ref('twoPerPage')
const completedSteps = ref([])
const pdfInfos = ref([])
const mergeWarnings = ref([])

// 行程单判定：invoiceType 含"行程单"（兼容"打车行程单/滴滴行程单/高德行程单"等）
const isItinerary = (inv) => (inv.invoiceType || '').includes('行程单')

// 当前进度百分比
const currentProgress = computed(() => {
  if (archivePhase.value) return archiveProgress.value
  if (excelPhase.value) return 100
  if (mergePhase.value && mergeTotal.value > 0) {
    return Math.round((mergeCurrent.value / mergeTotal.value) * 100)
  }
  return 100
})

// ─── 计算属性 ───

// 根文件夹名：出差人+总额+项目简写
const folderName = computed(() => {
  const name = settingsStore.profile.reimburser || '未知'
  const amount = Math.round(formStore.totalAmount || 0)
  const code = formStore.projectCode || '未知'
  return `${name}+${amount}+${code}`
})

// Excel 文件名
const excelFileName = computed(() => {
  return `${folderName.value}-差旅费报销单.xlsx`
})

// 每类发票数量
const categoriesWithCount = computed(() => {
  return CATEGORIES.map(cat => {
    const count = sessionStore.invoices.filter(inv => inv.category === cat.id).length
    return { ...cat, count }
  })
})

// ─── 方法 ───

function archiveFormat(percentage) {
  return `${Math.round(percentage)}%`
}

function formatMoney(num) {
  if (num == null) return '0.00'
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

async function execute() {
  executing.value = true
  archivePhase.value = false
  excelPhase.value = false
  archiveProgress.value = 0
  archiveCurrent.value = 0
  archiveTotal.value = 0
  archiveErrors.value = []
  completedSteps.value = []
  pdfInfos.value = []
  completed.value = false

  try {
    // 1. 选择输出目录
    let outputDirHandle
    try {
      outputDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
    } catch (e) {
      // 用户取消选择目录
      executing.value = false
      return
    }

    // 2. 归档发票文件
    archivePhase.value = true
    const archiveResult = await archiveInvoices(
      outputDirHandle,
      sessionStore.invoices,
      sessionStore.files,
      folderName.value,
      (current, total) => {
        archiveCurrent.value = current
        archiveTotal.value = total
        archiveProgress.value = Math.round((current / total) * 100)
      }
    )
    archiveErrors.value = archiveResult.errors || []
    completedSteps.value.push('归档完成')

    // 3. 生成 Excel
    archivePhase.value = false
    excelPhase.value = true

    const excelBuffer = await generateExcel({
      profile: settingsStore.profile,
      formData: formStore,
      invoices: sessionStore.invoices
    })

    // 4. 保存 Excel 到输出目录的根文件夹内
    const rootDir = await outputDirHandle.getDirectoryHandle(folderName.value)
    const excelFileHandle = await rootDir.getFileHandle(excelFileName.value, { create: true })
    const writable = await excelFileHandle.createWritable()
    await writable.write(excelBuffer)
    await writable.close()
    completedSteps.value.push('报销单生成完成')

    // 5. PDF 合并
    mergePhase.value = true
    excelPhase.value = false
    mergedFiles.value = []
    pdfInfos.value = []
    mergeWarnings.value = []

    const allInvoices = sessionStore.invoices

    // 其他票据（机票行程单等）：保持原始合并
    const otherPdfs = allInvoices.filter(
      inv => isItinerary(inv) && inv.category !== '02' && inv.fileHandle
    )
    // 打车发票（实际计费发票，非行程单）
    const taxiInvoices = allInvoices.filter(
      inv => inv.category === '02' && !isItinerary(inv) && inv.fileHandle
    )
    // 打车行程单
    const itineraryEntries = allInvoices.filter(
      inv => inv.category === '02' && isItinerary(inv) && inv.fileHandle
    )

    mergeTotal.value = allInvoices.filter(inv => inv.fileHandle).length
    mergeCurrent.value = 0

    try {
      // 5.1 解析行程单，并按其"合计金额"与打车发票按金额相等配对
      const itineraryInfos = []
      for (const entry of itineraryEntries) {
        let parsed = { ok: false }
        try {
          const f = await entry.fileHandle.getFile()
          parsed = await parseItineraryPdf(await f.arrayBuffer())
        } catch (e) {
          console.warn('行程单解析失败：', entry.fileName, e)
        }
        itineraryInfos.push({
          entry,
          parsed,
          total: parsed.ok ? (parsed.summary?.total ?? null) : null,
          used: false,
          pngs: null
        })
      }

      const matchByInvoiceId = new Map()
      for (const inv of taxiInvoices) {
        if (inv.amount == null) continue
        const hit = itineraryInfos.find(
          it => !it.used && it.total != null && Math.abs(it.total - inv.amount) < 0.02
        )
        if (hit) {
          hit.used = true
          matchByInvoiceId.set(inv.id, hit)
        }
      }

      // 行程单 → PNG（优先重构，扫描件降级为原页图片）
      const itineraryPngs = async (it) => {
        if (!it.pngs) {
          it.pngs = it.parsed.ok
            ? await rebuildItineraryPngs(it.parsed)
            : await fileToPngs(it.entry.fileHandle)
        }
        return it.pngs
      }

      // 5.2 按识别顺序混排：每张打车发票后紧跟其重构行程单
      const orderedPngs = []
      let processed = 0
      for (const inv of allInvoices) {
        if (!inv.fileHandle) continue
        if (isItinerary(inv)) continue

        orderedPngs.push(...(await fileToPngs(inv.fileHandle)))

        const it = matchByInvoiceId.get(inv.id)
        if (it) {
          orderedPngs.push(...(await itineraryPngs(it)))
        } else if (inv.category === '02') {
          mergeWarnings.value.push(`打车发票「${inv.invoiceNo || inv.fileName}」未匹配到行程单，已按原样打印`)
        }

        processed++
        mergeCurrent.value = processed
      }

      // 5.3 未匹配到发票的行程单：重构后追加到末尾
      for (const it of itineraryInfos) {
        if (it.used) continue
        orderedPngs.push(...(await itineraryPngs(it)))
        mergeWarnings.value.push(`行程单「${it.entry.fileName}」未匹配到对应打车发票，已追加到末尾`)
      }

      if (orderedPngs.length > 0) {
        const mergedData = await mergePrintImages(orderedPngs, {
          mode: printLayout.value === 'twoPerPage' ? 'twoPerPage' : 'onePerPage'
        })
        const invoiceFileName = '发票合并打印.pdf'
        const invFileHandle = await rootDir.getFileHandle(invoiceFileName, { create: true })
        const invWritable = await invFileHandle.createWritable()
        await invWritable.write(mergedData)
        await invWritable.close()
        mergedFiles.value.push(invoiceFileName)
        const invPdfDoc = await PDFDocument.load(mergedData)
        pdfInfos.value.push({
          name: invoiceFileName,
          pages: invPdfDoc.getPageCount(),
          size: formatFileSize(mergedData.length)
        })
      }

      // 5.4 其他票据合并（不含打车行程单）
      if (otherPdfs.length > 0) {
        const mergedData = await mergeOtherPdfs(otherPdfs, (cur) => {
          mergeCurrent.value = processed + cur
        })
        const otherFileName = '其他票据合并.pdf'
        const otherFileHandle = await rootDir.getFileHandle(otherFileName, { create: true })
        const otherWritable = await otherFileHandle.createWritable()
        await otherWritable.write(mergedData)
        await otherWritable.close()
        mergedFiles.value.push(otherFileName)
        const otherPdfDoc = await PDFDocument.load(mergedData)
        pdfInfos.value.push({
          name: otherFileName,
          pages: otherPdfDoc.getPageCount(),
          size: formatFileSize(mergedData.length)
        })
      }

      completedSteps.value.push('PDF合并完成')
    } catch (mergeErr) {
      console.error('PDF合并失败：', mergeErr)
      ElMessage.warning(`PDF合并失败（不影响归档结果）：${mergeErr.message}`)
      completedSteps.value.push('PDF合并失败（已跳过）')
    }

    mergePhase.value = false

    // 6. 完成
    completed.value = true
    ElMessage.success('归档与生成完成！')

    // 7. 保存任务记录
    historyStore.saveTask({
      formData: formStore,
      invoices: sessionStore.invoices,
      folderName: folderName.value,
      excelFileName: excelFileName.value
    })
  } catch (e) {
    console.error('归档或生成失败：', e)
    ElMessage.error(`操作失败：${e.message}`)
  } finally {
    executing.value = false
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style scoped>
.step4-container {
  max-width: 780px;
  margin: 0 auto;
  padding: 8px 0;
}

.section-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 20px 24px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

/* 预览区 */
.preview-block {
  margin-bottom: 16px;
}

.preview-block:last-child {
  margin-bottom: 0;
}

.preview-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

/* 文件夹树 */
.folder-tree {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 12px 16px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.8;
  color: #303133;
}

.tree-line {
  white-space: nowrap;
}

.tree-root {
  font-weight: 600;
  color: #409eff;
}

.tree-sub {
  padding-left: 24px;
  color: #606266;
}

.tree-sub2 {
  padding-left: 48px;
  color: #909399;
}

.tree-count {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}

/* Excel 文件名 */
.excel-name {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 8px 16px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  color: #303133;
}

.print-layout-option {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.option-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

/* 进度区 */
.progress-area {
  margin-top: 16px;
}

.progress-text {
  text-align: center;
  font-size: 13px;
  color: #606266;
  margin-top: 8px;
}

.step-completed {
  color: #67c23a;
  margin-bottom: 4px;
}

/* 完成区 */
.success-card {
  border-color: #e1f3d8;
  background: #f0f9eb;
}

.result-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.result-item {
  font-size: 14px;
  color: #303133;
}

/* 错误列表 */
.error-list {
  margin-top: 12px;
  text-align: left;
}

/* PDF文件信息列表 */
.pdf-info-list {
  margin-top: 12px;
  text-align: left;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 10px 14px;
}

.pdf-info-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.pdf-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  padding: 4px 0;
  border-bottom: 1px solid #ebeef5;
}

.pdf-info-item:last-child {
  border-bottom: none;
}

.pdf-info-name {
  color: #303133;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
}

.pdf-info-detail {
  color: #909399;
  flex-shrink: 0;
  margin-left: 12px;
}

.error-list ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
  font-size: 13px;
}

.error-list li {
  margin-bottom: 4px;
  color: #606266;
}
</style>
