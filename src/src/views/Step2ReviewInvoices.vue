<template>
  <div class="step2-container">
    <!-- 识别进度条 -->
    <div v-if="recognizing" class="progress-section">
      <el-progress
        :percentage="progress"
        :stroke-width="10"
        :format="progressFormat"
      />
      <div class="progress-text">
        正在识别：<span class="current-file">{{ currentFile }}</span>
      </div>
    </div>

    <!-- 识别完成后的统计 -->
    <div v-else-if="sessionStore.invoices.length > 0" class="stats-bar">
      <span>共识别 <strong>{{ sessionStore.invoices.length }}</strong> 张发票</span>
      <span v-if="errorCount > 0" class="stat-error">❌ {{ errorCount }} 个错误</span>
      <span v-if="warnCount > 0" class="stat-warn">⚠️ {{ warnCount }} 个警告</span>
      <span v-if="errorCount === 0 && warnCount === 0" class="stat-ok">✅ 全部合规</span>
    </div>

    <!-- 主体：左右分栏 -->
    <div class="main-layout">
      <!-- 左侧：发票列表 -->
      <div class="left-panel" v-loading="sessionStore.busy" element-loading-text="正在识别发票...">
        <!-- 工具栏 -->
        <div class="toolbar">
          <el-button size="small" :disabled="sessionStore.busy" @click="manualAddVisible = true">
            <el-icon><Plus /></el-icon>
            手动添加
          </el-button>
          <el-button size="small" :disabled="sessionStore.busy || selectedInvoices.length === 0" @click="deleteSelected">
            <el-icon><Delete /></el-icon>
            删除选中
          </el-button>
          <el-dropdown
            trigger="click"
            :disabled="sessionStore.busy || selectedInvoices.length === 0"
            @command="batchChangeCategory"
          >
            <el-button size="small" :disabled="sessionStore.busy || selectedInvoices.length === 0">
              修改类别
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="cat in CATEGORIES"
                  :key="cat.id"
                  :command="cat.id"
                >
                  {{ cat.name }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 发票表格 -->
        <el-table
          ref="tableRef"
          :data="sessionStore.invoices"
          row-key="id"
          stripe
          highlight-current-row
          size="small"
          :row-class-name="tableRowClassName"
          @selection-change="handleSelectionChange"
          style="width: 100%"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column type="expand">
            <template #default="{ row }">
              <InvoiceDetailPanel :invoice="row" />
            </template>
          </el-table-column>
          <el-table-column label="#" type="index" width="50" />
          <el-table-column label="类别" width="110">
            <template #default="{ row }">
              <el-tag
                :type="categoryTagType(row.category)"
                size="small"
                effect="plain"
              >
                {{ categoryName(row.category) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="日期"
            prop="issueDate"
            width="110"
            sortable
          />
          <el-table-column
            label="金额"
            width="100"
            sortable
            :sort-method="sortByAmount"
            align="right"
          >
            <template #default="{ row }">
              <span v-if="row.amount != null">{{ row.amount.toFixed(2) }}</span>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="销售方" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.seller || '—' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="70" align="center">
            <template #default="{ row }">
              <span :title="statusLabel(row.status)">{{ statusIcon(row.status) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 右侧：问题清单 -->
      <div class="right-panel">
        <ComplianceList
          :invoice-issues="flatInvoiceIssues"
          :global-issues="sessionStore.globalIssues"
          @locate-invoice="locateInvoice"
        />
      </div>
    </div>

    <!-- 手动添加弹窗 -->
    <ManualAddDialog
      v-model:visible="manualAddVisible"
      @add="handleManualAdd"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, ArrowDown } from '@element-plus/icons-vue'
import { useSessionStore } from '../stores/session'
import { useHistoryStore } from '../stores/history'
import { CATEGORIES } from '../utils/constants'
import { parsePdf, renderPdfPageToImage } from '../services/pdfParser'
import { parseInvoiceXml } from '../services/xmlParser'
import { parseOfd } from '../services/ofdParser'
import { recognizeInvoice, recognizeInvoiceByVision } from '../services/deepseekClient'
import { classifyAll, classifyTaxiType } from '../services/classifier'
import { checkTransportChain } from '../services/transportChecker'
import { runComplianceCheck } from '../services/compliance'
import InvoiceDetailPanel from '../components/InvoiceDetailPanel.vue'
import ComplianceList from '../components/ComplianceList.vue'
import ManualAddDialog from '../components/ManualAddDialog.vue'

const sessionStore = useSessionStore()
const historyStore = useHistoryStore()

// ─── 识别状态 ───
const recognizing = ref(false)
const progress = ref(0)
const currentFile = ref('')

// ─── 表格状态 ───
const tableRef = ref(null)
const selectedInvoices = ref([])
const manualAddVisible = ref(false)
const highlightRowId = ref(null)

// ─── 类别映射 ───
const categoryMap = Object.fromEntries(CATEGORIES.map(c => [c.id, c.name]))

// 类别 → tag 类型
const categoryTagTypes = {
  '01': '',        // 交通费 - 默认蓝
  '02': 'success', // 打车费 - 绿
  '03': 'warning', // 住宿费 - 橙
  '04': 'info',    // 复印装订费 - 灰
  '05': 'danger',  // 专家评审费 - 红
  '06': 'success', // 办公用品费 - 绿
  '07': 'warning', // 餐饮费 - 橙
  '08': '',        // 会议费 - 默认蓝
  '09': 'info',    // 快递费 - 灰
  '10': 'info'     // 其他费用 - 灰
}

function categoryName(id) {
  return categoryMap[id] || '未知'
}

function categoryTagType(id) {
  return categoryTagTypes[id] || 'info'
}

// ─── 状态显示 ───
function statusIcon(status) {
  const map = { ok: '✅', warning: '⚠️', error: '❌', manual: '✏️' }
  return map[status] || '❓'
}

function statusLabel(status) {
  const map = { ok: '合规', warning: '有警告', error: '有错误', manual: '手动录入' }
  return map[status] || '未知'
}

function determineStatus(issues) {
  if (!issues || issues.length === 0) return 'ok'
  if (issues.some(i => i.severity === 'error')) return 'error'
  if (issues.some(i => i.severity === 'warn')) return 'warning'
  return 'ok'
}

// ─── 统计 ───
const errorCount = computed(() =>
  sessionStore.invoices.filter(inv => inv.status === 'error').length
)

const warnCount = computed(() =>
  sessionStore.invoices.filter(inv => inv.status === 'warning').length
)

// ─── 扁平化发票问题（附带 invoiceId 用于定位） ───
const flatInvoiceIssues = computed(() => {
  const result = []
  for (const inv of sessionStore.invoices) {
    if (inv.issues && inv.issues.length > 0) {
      for (const issue of inv.issues) {
        result.push({ ...issue, invoiceId: inv.id })
      }
    }
  }
  return result
})

// ─── 进度条格式化 ───
function progressFormat(percentage) {
  return `${Math.round(percentage)}%`
}

// ─── 排序 ───
function sortByAmount(a, b) {
  return (a.amount || 0) - (b.amount || 0)
}

// ─── 表格行样式 ───
function tableRowClassName({ row }) {
  if (row.id === highlightRowId.value) return 'highlight-row'
  return ''
}

// ─── 选择变更 ───
function handleSelectionChange(selection) {
  selectedInvoices.value = selection
}

// ─── 删除选中 ───
async function deleteSelected() {
  if (selectedInvoices.value.length === 0) return
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedInvoices.value.length} 张发票？`,
      '删除确认',
      { type: 'warning' }
    )
    const delIds = new Set(selectedInvoices.value.map(i => i.id))
    sessionStore.invoices = sessionStore.invoices.filter(i => !delIds.has(i.id))
    selectedInvoices.value = []
    ElMessage.success('已删除')
  } catch {
    // 用户取消
  }
}

// ─── 批量修改类别 ───
function batchChangeCategory(categoryId) {
  for (const inv of selectedInvoices.value) {
    inv.category = categoryId
    // 重新计算 taxiType
    if (categoryId === '02') {
      inv.taxiType = classifyTaxiType(inv)
    } else {
      inv.taxiType = null
    }
    // 重新判定状态
    inv.status = determineStatus(inv.issues)
  }
  ElMessage.success(`已将 ${selectedInvoices.value.length} 张发票类别修改为「${categoryName(categoryId)}」`)
}

// ─── 手动添加 ───
function handleManualAdd(invoice) {
  sessionStore.invoices.push(invoice)
  ElMessage.success('已添加手动发票')
}

// ─── 问题定位：高亮并滚动到对应行 ───
function locateInvoice(invoiceId) {
  highlightRowId.value = invoiceId
  nextTick(() => {
    if (tableRef.value) {
      tableRef.value.setCurrentRow(
        sessionStore.invoices.find(i => i.id === invoiceId)
      )
      // 滚动到可见
      const rowEl = document.querySelector('.highlight-row')
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    // 3秒后取消高亮
    setTimeout(() => {
      highlightRowId.value = null
    }, 3000)
  })
}

// ─── 识别流程 ───
onMounted(() => {
  if (sessionStore.invoices.length === 0 && sessionStore.files.length > 0) {
    startRecognition()
  }
})

async function startRecognition() {
  recognizing.value = true
  sessionStore.busy = true
  progress.value = 0
  try {
    await runRecognition()
  } catch (e) {
    console.error('识别流程失败：', e)
    ElMessage.error('识别流程出错：' + (e.message || e))
  } finally {
    recognizing.value = false
    sessionStore.busy = false
    currentFile.value = ''
  }
}

async function runRecognition() {
  const files = sessionStore.files
  const results = []

  // 构建待处理文件列表：避免 PDF+XML 重复
  // 策略：只处理 PDF 文件，如果 PDF 有配对 XML 则带上 XML
  //       再处理没有配对 PDF 的独立 XML
  const pdfFiles = files.filter(f => f.type === 'pdf')
  const xmlFiles = files.filter(f => f.type === 'xml')

  // 找出已配对的 XML 文件名集合
  const pairedXmlNames = new Set(
    pdfFiles
      .filter(f => f.pairedTo)
      .map(f => f.pairedTo)
  )

  // 独立 XML（没有配对 PDF 的）
  const standaloneXmlFiles = xmlFiles.filter(f => !pairedXmlNames.has(f.name))

  // 合并待处理列表
  const processList = [
    ...pdfFiles.map(f => ({
      ...f,
      processType: 'pdf',
      xmlFile: f.pairedTo
        ? xmlFiles.find(x => x.name === f.pairedTo)
        : null
    })),
    ...standaloneXmlFiles.map(f => ({
      ...f,
      processType: 'xml',
      xmlFile: null
    }))
  ]

  for (let i = 0; i < processList.length; i++) {
    progress.value = ((i + 1) / processList.length) * 100
    currentFile.value = processList[i].name

    try {
      const invoice = await processOneFile(processList[i])
      if (invoice) results.push(invoice)
    } catch (e) {
      results.push({
        id: crypto.randomUUID(),
        fileName: processList[i].name,
        fileHandle: processList[i].fileHandle,
        status: 'error',
        issues: [{ code: 'parse_failed', severity: 'error', msg: `识别失败: ${e.message}` }]
      })
    }
  }

  // ── 按 invoiceNo 去重 ──────────────────────────────────────────────
  // 场景：PDF 文件名与 XML 文件名不同（如"闪送电子票据.pdf"+"闪送xml票据.xml"），
  //       Step1 的同名配对无法识别，两者会被分别识别成两张发票。
  // 策略：识别完成后，若同一目录下存在 invoiceNo 完全相同的两张发票，
  //       则合并为一张（保留 PDF 条目，XML 的结构化字段优先覆盖 PDF 字段）。
  const deduped = deduplicateByInvoiceNo(results)

  // 分类
  const classified = classifyAll(deduped)

  // 链路校验
  const chainResult = checkTransportChain(classified)

  // 合规检查（含历史发票编号去重）
  const historicalInvoiceNos = historyStore.getAllHistoricalInvoiceNos()
  const complianceResult = runComplianceCheck(classified, files, historicalInvoiceNos)

  // 合并问题到每张发票
  for (const inv of classified) {
    const extraIssues = complianceResult.invoiceIssues.get(inv.id) || []
    inv.issues = [...(inv.issues || []), ...extraIssues]
    inv.status = determineStatus(inv.issues)
  }

  // 存入 store
  sessionStore.invoices = classified
  sessionStore.globalIssues = [...chainResult.issues, ...complianceResult.globalIssues]

  ElMessage.success(`识别完成，共 ${classified.length} 张发票`)
}

/**
 * 按 invoiceNo 对识别结果去重
 * 适用于 PDF 与 XML 文件名不一致导致 Step1 配对失败、被分别识别的情况。
 * 规则：
 *   1. invoiceNo 为空 / 纯文本型发票（无 invoiceNo）→ 不参与去重，原样保留
 *   2. 相同 invoiceNo 出现多次时，以首个 PDF 条目为主记录：
 *      - 用 XML 条目中有值的字段覆盖主记录的空字段（XML 数据更准确）
 *      - 移除重复的 XML 独立条目
 */
function deduplicateByInvoiceNo(invoices) {
  const seen = new Map()   // invoiceNo → 主记录索引（在 out 数组中）
  const out = []

  for (const inv of invoices) {
    const no = inv.invoiceNo?.trim()
    // invoiceNo 为空或识别失败的条目，直接保留
    if (!no) {
      out.push(inv)
      continue
    }

    if (!seen.has(no)) {
      seen.set(no, out.length)
      out.push({ ...inv })
    } else {
      // 已有同号发票 → 用当前条目的非空字段补充主记录（XML 字段更结构化，优先覆盖）
      const masterIdx = seen.get(no)
      const master = out[masterIdx]
      const FIELDS_TO_MERGE = [
        'issueDate', 'amount', 'amountExcludeTax', 'amountTax',
        'seller', 'buyer', 'remark', 'invoiceType', 'items',
        'origin', 'destination', 'transportTool', 'passenger',
        'flightNo', 'departureTime', 'travelDate', 'trainNo',
        'stayPerson', 'checkInDate', 'checkOutDate'
      ]
      for (const field of FIELDS_TO_MERGE) {
        // 当前条目有值而主记录没有 → 补充；两者都有则不覆盖（PDF 的 fileHandle 保留）
        if (inv[field] != null && inv[field] !== '' && (master[field] == null || master[field] === '')) {
          master[field] = inv[field]
        }
      }
      // 如果被合并的条目来自 XML 文件，则主记录视为已有配套 XML，
      // 避免合规检查误报"缺少配套 XML 文件"
      if (inv.fileName?.toLowerCase().endsWith('.xml') || inv.fileType === 'xml') {
        master.hasCompanionXml = true
      }
      // 标记已合并，方便调试
      master._mergedFrom = (master._mergedFrom || []).concat(inv.fileName || inv.name)
    }
  }

  return out
}

async function processOneFile(fileInfo) {
  const file = await fileInfo.fileHandle.getFile()
  let rawData = { fileName: fileInfo.name }

  if (fileInfo.processType === 'xml' || fileInfo.type === 'xml') {
    // 独立 XML 文件直接解析
    const text = await file.text()
    const xmlData = parseInvoiceXml(text)
    rawData.xmlData = xmlData
    rawData.text = text
  } else {
    // PDF 文件：优先检查 OFD 配套
    if (fileInfo.companionOfdHandle) {
      try {
        currentFile.value = `${fileInfo.name} (OFD结构化解析...)`
        const ofdFile = await fileInfo.companionOfdHandle.getFile()
        const ofdBuffer = await ofdFile.arrayBuffer()
        const ofdResult = await parseOfd(ofdBuffer)
        // 直接使用OFD结构化数据，跳过AI识别
        return {
          id: crypto.randomUUID(),
          fileName: fileInfo.name,
          fileHandle: fileInfo.fileHandle,
          companionFileName: fileInfo.companionOfdName || null,
          hasCompanionOfd: true,
          recognitionSource: 'ofd',
          status: 'ok',
          issues: [],
          ...ofdResult
        }
      } catch (e) {
        console.warn(`OFD解析失败，降级到PDF识别: ${fileInfo.name}`, e)
        // 继续走PDF识别流程
      }
    }

    // PDF 文件抽文本
    const arrayBuffer = await file.arrayBuffer()
    const { text, isScanned } = await parsePdf(arrayBuffer)

    if (isScanned) {
      // 扫描件/图片型PDF：使用视觉识别
      // 更新进度提示
      currentFile.value = `${fileInfo.name} (正在识别扫描件...)`

      try {
        const imageBase64 = await renderPdfPageToImage(arrayBuffer)
        const aiResult = await recognizeInvoiceByVision(imageBase64)

        return {
          id: crypto.randomUUID(),
          fileName: fileInfo.name,
          fileHandle: fileInfo.fileHandle,
          companionFileName: fileInfo.xmlFile ? fileInfo.xmlFile.name : (fileInfo.pairedTo || null),
          hasCompanionXml: !!fileInfo.xmlFile,
          isScanned: true,
          status: 'ok',
          issues: [],
          ...aiResult
        }
      } catch (e) {
        // 视觉识别失败，返回手动录入状态
        console.error(`扫描件视觉识别失败: ${fileInfo.name}`, e)
        return {
          id: crypto.randomUUID(),
          fileName: fileInfo.name,
          fileHandle: fileInfo.fileHandle,
          status: 'manual',
          isScanned: true,
          issues: [{ code: 'vision_failed', severity: 'warn', msg: `扫描件视觉识别失败: ${e.message}，请手动录入` }]
        }
      }
    }

    rawData.text = text

    // 配对 XML
    if (fileInfo.xmlFile) {
      try {
        const xmlHandle = fileInfo.xmlFile.fileHandle
        const xmlFile = await xmlHandle.getFile()
        const xmlText = await xmlFile.text()
        const xmlData = parseInvoiceXml(xmlText)
        rawData.xmlData = xmlData
        rawData.hasCompanion = true
      } catch (e) {
        console.warn(`配对 XML 解析失败: ${fileInfo.xmlFile.name}`, e)
      }
    }
  }

  // 调用 AI 识别（文本识别）
  const aiResult = await recognizeInvoice(rawData)

  return {
    id: crypto.randomUUID(),
    fileName: fileInfo.name,
    fileHandle: fileInfo.fileHandle,
    companionFileName: fileInfo.xmlFile ? fileInfo.xmlFile.name : (fileInfo.pairedTo || null),
    hasCompanionXml: !!fileInfo.xmlFile,
    status: 'ok',
    issues: [],
    ...aiResult
  }
}

// ─── 暴露方法给父组件（App.vue 用作导航前确认） ───
function hasUnresolvedIssues() {
  return sessionStore.invoices.some(
    inv => inv.status === 'error' || inv.status === 'warning'
  ) || sessionStore.globalIssues.some(
    issue => issue.severity === 'error' || issue.severity === 'warn'
  )
}

function getUnresolvedCount() {
  let count = sessionStore.invoices.filter(
    inv => inv.status === 'error' || inv.status === 'warning'
  ).length
  count += sessionStore.globalIssues.filter(
    issue => issue.severity === 'error' || issue.severity === 'warn'
  ).length
  return count
}

defineExpose({ hasUnresolvedIssues, getUnresolvedCount })
</script>

<style scoped>
.step2-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 进度条 */
.progress-section {
  margin-bottom: 16px;
}

.progress-text {
  font-size: 13px;
  color: #606266;
  margin-top: 6px;
}

.current-file {
  color: #409eff;
  font-weight: 500;
}

/* 统计栏 */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
}

.stat-error {
  color: #f56c6c;
  font-weight: 500;
}

.stat-warn {
  color: #e6a23c;
  font-weight: 500;
}

.stat-ok {
  color: #67c23a;
  font-weight: 500;
}

/* 主体布局 */
.main-layout {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.left-panel {
  flex: 7;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.right-panel {
  flex: 3;
  min-width: 240px;
  max-width: 360px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 12px;
  overflow: hidden;
}

/* 工具栏 */
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

/* 文本样式 */
.text-muted {
  color: #c0c4cc;
}

/* 高亮行 */
:deep(.highlight-row) {
  background-color: #ecf5ff !important;
  animation: highlight-fade 3s ease-out;
}

@keyframes highlight-fade {
  0% { background-color: #b3d8ff; }
  100% { background-color: transparent; }
}

/* 表格 hover */
:deep(.el-table__body tr:hover > td) {
  background-color: #ecf5ff !important;
}
</style>
