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
          :percentage="archivePhase ? archiveProgress : 100"
          :format="archivePhase ? archiveFormat : () => ''"
          :stroke-width="18"
          :status="excelPhase && !completed ? 'success' : ''"
        />
        <div class="progress-text">
          <template v-if="archivePhase">
            归档中... ({{ archiveCurrent }}/{{ archiveTotal }})
          </template>
          <template v-else-if="excelPhase">
            正在生成报销单...
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

    // 5. 完成
    completed.value = true
    ElMessage.success('归档与生成完成！')

    // 6. 保存任务记录
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
