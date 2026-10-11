<template>
  <div class="task-history-container">
    <!-- 空状态 -->
    <el-empty v-if="historyStore.allTasks.length === 0" description="暂无报销记录">
      <template #image>
        <span style="font-size: 48px">📋</span>
      </template>
    </el-empty>

    <!-- 任务列表 -->
    <el-table
      v-else
      :data="historyStore.allTasks"
      stripe
      class="task-table"
    >
      <el-table-column label="出差时间" min-width="180">
        <template #default="{ row }">
          <span>{{ row.tripStartDate || '—' }} ~ {{ row.tripEndDate || '—' }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="projectCode" label="项目编号" min-width="120" />

      <el-table-column label="报销金额" min-width="110" align="right">
        <template #default="{ row }">
          <span class="amount">¥{{ formatMoney(row.totalAmount) }}</span>
        </template>
      </el-table-column>

      <el-table-column label="生成日期" min-width="110">
        <template #default="{ row }">
          {{ row.generatedAt ? row.generatedAt.split(' ')[0] : '—' }}
        </template>
      </el-table-column>

      <el-table-column label="提交日期" min-width="140">
        <template #default="{ row }">
          <div class="submitted-cell" @click.stop="openDatePicker(row)">
            <span v-if="row.submittedAt">{{ row.submittedAt }}</span>
            <span v-else class="not-submitted">未填写</span>
            <el-icon class="edit-icon"><Edit /></el-icon>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="openDetail(row)">
            <el-icon><Document /></el-icon>详情
          </el-button>
          <el-button type="primary" link size="small" @click="downloadExcel(row)">
            <el-icon><Download /></el-icon>下载
          </el-button>
          <el-button type="danger" link size="small" @click="confirmDelete(row)">
            <el-icon><Delete /></el-icon>删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 日期编辑对话框 -->
    <el-dialog
      v-model="dateDialogVisible"
      title="设置提交日期"
      width="340px"
      append-to-body
    >
      <el-date-picker
        v-model="editingDate"
        type="date"
        placeholder="选择提交报销的日期"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        style="width: 100%"
      />
      <template #footer>
        <el-button @click="dateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmDateChange">确定</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      :title="`报销详情 - ${currentTask?.projectCode || ''}`"
      size="680px"
      direction="rtl"
    >
      <template v-if="currentTask">
        <!-- 基本信息 -->
        <div class="detail-section">
          <h4>基本信息</h4>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="出差时间">
              {{ currentTask.tripStartDate || '—' }} ~ {{ currentTask.tripEndDate || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="项目编号">{{ currentTask.projectCode || '—' }}</el-descriptions-item>
            <el-descriptions-item label="出差事由">{{ currentTask.reason || '—' }}</el-descriptions-item>
            <el-descriptions-item label="报销金额">
              <span class="amount">¥{{ formatMoney(currentTask.totalAmount) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="生成日期">{{ currentTask.generatedAt || '—' }}</el-descriptions-item>
            <el-descriptions-item label="提交日期">{{ currentTask.submittedAt || '未填写' }}</el-descriptions-item>
            <el-descriptions-item label="代理费">¥{{ formatMoney(currentTask.formData?.agencyFee || 0) }}</el-descriptions-item>
            <el-descriptions-item label="预借旅费">¥{{ formatMoney(currentTask.formData?.prepaidAmount || 0) }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 费用汇总 -->
        <div class="detail-section">
          <h4>费用汇总</h4>
          <div class="summary-grid">
            <div
              v-for="item in categorySummary"
              :key="item.name"
              class="summary-item"
            >
              <span class="summary-name">{{ item.name }}</span>
              <span class="summary-count">{{ item.count }}张</span>
              <span class="summary-amount">¥{{ formatMoney(item.amount) }}</span>
            </div>
            <div class="summary-item summary-total">
              <span class="summary-name">出差补助</span>
              <span class="summary-count">{{ currentTask.formData?.tripDays || 0 }}天{{ currentTask.formData?.subsidyPerDay ? `×${currentTask.formData.subsidyPerDay}元` : '' }}</span>
              <span class="summary-amount">¥{{ formatMoney(currentTask.formData?.subsidy || 0) }}</span>
            </div>
          </div>
        </div>

        <!-- 发票清单 -->
        <div class="detail-section">
          <h4>发票清单（{{ currentTask.invoices?.length || 0 }}张）</h4>
          <el-table :data="currentTask.invoices || []" stripe size="small" max-height="400">
            <el-table-column label="发票号码" min-width="120">
              <template #default="{ row }">{{ row.invoiceNo || '—' }}</template>
            </el-table-column>
            <el-table-column label="类别" min-width="90">
              <template #default="{ row }">{{ getCategoryName(row.category) }}</template>
            </el-table-column>
            <el-table-column label="金额" min-width="90" align="right">
              <template #default="{ row }">¥{{ formatMoney(row.amount) }}</template>
            </el-table-column>
            <el-table-column label="日期" min-width="100">
              <template #default="{ row }">{{ row.travelDate || row.issueDate || '—' }}</template>
            </el-table-column>
            <el-table-column label="行程" min-width="140">
              <template #default="{ row }">
                <span v-if="row.origin || row.destination">
                  {{ row.origin || '?' }} → {{ row.destination || '?' }}
                </span>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column label="文件" min-width="120">
              <template #default="{ row }">{{ row.fileName || '—' }}</template>
            </el-table-column>
          </el-table>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Download, Delete, Edit } from '@element-plus/icons-vue'
import { useHistoryStore } from '../stores/history'
import { CATEGORIES } from '../utils/constants'
import { generateExcel } from '../services/excelGenerator'
import { useSettingsStore } from '../stores/settings'

const historyStore = useHistoryStore()
const settingsStore = useSettingsStore()

// ─── 状态 ───
const drawerVisible = ref(false)
const currentTask = ref(null)
const dateDialogVisible = ref(false)
const editingTaskId = ref('')
const editingDate = ref('')

// ─── 类别名称映射 ───
const categoryMap = computed(() => {
  const map = {}
  for (const cat of CATEGORIES) {
    map[cat.id] = cat.name
  }
  return map
})

function getCategoryName(id) {
  return categoryMap.value[id] || id || '—'
}

// ─── 费用汇总 ───
const categorySummary = computed(() => {
  if (!currentTask.value?.invoices) return []
  const fd = currentTask.value.formData || {}
  const fields = [
    { id: '01', name: '交通费', key: 'transportTotal' },
    { id: '02a', name: '打车费(车站)', key: 'taxiStationTotal' },
    { id: '02b', name: '打车费(市内)', key: 'taxiCityTotal' },
    { id: '03', name: '住宿费', key: 'accommodationTotal' },
    { id: '04', name: '复印装订费', key: 'copyBindTotal' },
    { id: '05', name: '专家评审费', key: 'expertReviewTotal' },
    { id: '06', name: '办公用品费', key: 'officeSuppliesTotal' },
    { id: '07', name: '餐饮费', key: 'mealTotal' },
    { id: '08', name: '会议费', key: 'meetingTotal' },
    { id: '09', name: '快递费', key: 'expressTotal' },
    { id: '10', name: '其他费用', key: 'otherTotal' }
  ]

  return fields.map(f => {
    const amount = fd[f.key] || 0
    // 打车费拆分为 station/city，其余按 category 统计张数
    let count = 0
    if (f.id === '02a') {
      count = currentTask.value.invoices.filter(inv => inv.category === '02' && inv.taxiType === 'station').length
    } else if (f.id === '02b') {
      count = currentTask.value.invoices.filter(inv => inv.category === '02' && inv.taxiType === 'city').length
    } else {
      count = currentTask.value.invoices.filter(inv => inv.category === f.id).length
    }
    return { name: f.name, count, amount }
  }).filter(item => item.amount > 0 || item.count > 0)
})

// ─── 方法 ───

function formatMoney(num) {
  if (num == null) return '0.00'
  return Number(num).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function openDetail(task) {
  currentTask.value = task
  drawerVisible.value = true
}

function openDatePicker(row) {
  editingTaskId.value = row.id
  editingDate.value = row.submittedAt || ''
  dateDialogVisible.value = true
}

function confirmDateChange() {
  if (editingTaskId.value && editingDate.value) {
    historyStore.updateTask(editingTaskId.value, { submittedAt: editingDate.value })
    ElMessage.success('提交日期已更新')
  }
  dateDialogVisible.value = false
  editingTaskId.value = ''
}

async function downloadExcel(task) {
  try {
    // 构建 formData 兼容对象（generateExcel 需要的字段）
    const formData = {
      ...task.formData,
      projectCode: task.projectCode,
      reason: task.reason
    }

    const excelBuffer = await generateExcel({
      profile: settingsStore.profile,
      formData,
      invoices: task.invoices
    })

    // 使用 showSaveFilePicker 保存
    const handle = await window.showSaveFilePicker({
      suggestedName: task.excelFileName || '差旅费报销单.xlsx',
      types: [{
        description: 'Excel 文件',
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
      }]
    })

    const writable = await handle.createWritable()
    await writable.write(excelBuffer)
    await writable.close()

    ElMessage.success('报销单已下载')
  } catch (e) {
    if (e.name === 'AbortError') return // 用户取消
    console.error('下载失败:', e)
    ElMessage.error('下载失败：' + e.message)
  }
}

async function confirmDelete(task) {
  try {
    await ElMessageBox.confirm(
      `确定要删除这条报销记录吗？\n项目：${task.projectCode || '—'}\n金额：¥${formatMoney(task.totalAmount)}`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    historyStore.deleteTask(task.id)
    ElMessage.success('已删除')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.task-history-container {
  padding: 20px 24px;
  height: 100%;
  overflow-y: auto;
}

.task-table {
  width: 100%;
}

.amount {
  font-weight: 600;
  color: #e6a23c;
}

.not-submitted {
  color: #c0c4cc;
  font-size: 12px;
}

.submitted-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.edit-icon {
  font-size: 12px;
  color: #c0c4cc;
}

.submitted-cell:hover .edit-icon {
  color: #409eff;
}

/* 详情抽屉 */
.detail-section {
  margin-bottom: 24px;
}

.detail-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f0f0f0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 13px;
}

.summary-name {
  color: #606266;
}

.summary-count {
  color: #909399;
  font-size: 12px;
}

.summary-amount {
  font-weight: 600;
  color: #303133;
}

.summary-total {
  background: #ecf5ff;
}
</style>
