<template>
  <div class="step3-container">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="110px"
      label-position="right"
      class="step3-form"
    >
      <!-- 基本信息 -->
      <div class="section-card">
        <div class="section-title">基本信息</div>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="部门">
              <el-input v-model="settingsStore.profile.department" @change="onDepartmentChange" placeholder="请输入部门" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="出差人">
              <el-input v-model="settingsStore.profile.reimburser" @change="onReimburserChange" placeholder="请输入出差人" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="报销日期">
              <el-date-picker
                v-model="formStore.reimburseDate"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="项目简写" prop="projectCode">
              <el-autocomplete
                v-model="formStore.projectCode"
                :fetch-suggestions="fetchProjectSuggestions"
                placeholder="请输入或选择项目简写"
                clearable
                style="width: 100%"
                @change="onProjectCodeChange"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="出差事由" prop="reason">
              <el-input v-model="formStore.reason" placeholder="请输入出差事由" maxlength="200" />
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <!-- 费用信息 -->
      <div class="section-card">
        <div class="section-title">费用信息</div>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="代理费及标书款">
              <el-input-number
                v-model="formStore.agencyFee"
                :min="0"
                :precision="2"
                :step="100"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="予借旅费">
              <el-input-number
                v-model="formStore.prepaidAmount"
                :min="0"
                :precision="2"
                :step="100"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <!-- 自动计算（只读展示） -->
      <div class="section-card">
        <div class="section-title">自动计算</div>

        <!-- 出差补助 -->
        <div class="calc-row">
          <span class="calc-label">出差天数</span>
          <span class="calc-value">{{ formStore.tripDays }} 天</span>
        </div>
        <div class="calc-row">
          <span class="calc-label">补助标准（元/天）</span>
          <el-input-number
            v-model="formStore.subsidyPerDay"
            :min="0"
            :precision="2"
            :step="10"
            size="small"
            controls-position="right"
            class="subsidy-input"
          />
        </div>
        <div class="calc-row">
          <span class="calc-label">出差补助</span>
          <span class="calc-value">¥{{ formatMoney(formStore.subsidy) }} <span class="calc-hint">({{ formStore.tripDays }}天 × {{ formStore.subsidyPerDay }}元/天)</span></span>
        </div>

        <el-divider />

        <!-- 各类费用 -->
        <div class="calc-row">
          <span class="calc-label expandable" :class="{ clickable: getInvoicesByKey('01').length }" @click="getInvoicesByKey('01').length && toggleExpand('01')">
            <span v-if="getInvoicesByKey('01').length" class="expand-arrow">{{ expandedKeys['01'] ? '▼' : '▶' }}</span>
            交通费合计
          </span>
          <span class="calc-value">¥{{ formatMoney(formStore.transportTotal) }}</span>
        </div>
        <template v-if="expandedKeys['01']">
          <div v-for="inv in getInvoicesByKey('01')" :key="inv.fileName" class="calc-row detail-row">
            <span class="calc-label">{{ inv.fileName }}</span>
            <span class="calc-value detail-value">¥{{ formatMoney(inv.amount) }}</span>
          </div>
        </template>

        <div class="calc-row sub-row">
          <span class="calc-label expandable" :class="{ clickable: getInvoicesByKey('02-station').length }" @click="getInvoicesByKey('02-station').length && toggleExpand('02-station')">
            <span v-if="getInvoicesByKey('02-station').length" class="expand-arrow">{{ expandedKeys['02-station'] ? '▼' : '▶' }}</span>
            打车费(车站)
          </span>
          <span class="calc-value">¥{{ formatMoney(formStore.taxiStationTotal) }}</span>
        </div>
        <template v-if="expandedKeys['02-station']">
          <div v-for="inv in getInvoicesByKey('02-station')" :key="inv.fileName" class="calc-row detail-row">
            <span class="calc-label">{{ inv.fileName }}</span>
            <span class="calc-value detail-value">¥{{ formatMoney(inv.amount) }}</span>
          </div>
        </template>

        <div class="calc-row sub-row">
          <span class="calc-label expandable" :class="{ clickable: getInvoicesByKey('02-city').length }" @click="getInvoicesByKey('02-city').length && toggleExpand('02-city')">
            <span v-if="getInvoicesByKey('02-city').length" class="expand-arrow">{{ expandedKeys['02-city'] ? '▼' : '▶' }}</span>
            打车费(市内)
          </span>
          <span class="calc-value">¥{{ formatMoney(formStore.taxiCityTotal) }}</span>
        </div>
        <template v-if="expandedKeys['02-city']">
          <div v-for="inv in getInvoicesByKey('02-city')" :key="inv.fileName" class="calc-row detail-row">
            <span class="calc-label">{{ inv.fileName }}</span>
            <span class="calc-value detail-value">¥{{ formatMoney(inv.amount) }}</span>
          </div>
        </template>

        <div class="calc-row">
          <span class="calc-label expandable" :class="{ clickable: getInvoicesByKey('03').length }" @click="getInvoicesByKey('03').length && toggleExpand('03')">
            <span v-if="getInvoicesByKey('03').length" class="expand-arrow">{{ expandedKeys['03'] ? '▼' : '▶' }}</span>
            住宿费
          </span>
          <span class="calc-value">¥{{ formatMoney(formStore.accommodationTotal) }}</span>
        </div>
        <template v-if="expandedKeys['03']">
          <div v-for="inv in getInvoicesByKey('03')" :key="inv.fileName" class="calc-row detail-row">
            <span class="calc-label">{{ inv.fileName }}</span>
            <span class="calc-value detail-value">¥{{ formatMoney(inv.amount) }}</span>
          </div>
        </template>

        <div class="calc-row">
          <span class="calc-label expandable" :class="{ clickable: getInvoicesByKey('04').length }" @click="getInvoicesByKey('04').length && toggleExpand('04')">
            <span v-if="getInvoicesByKey('04').length" class="expand-arrow">{{ expandedKeys['04'] ? '▼' : '▶' }}</span>
            复印装订费
          </span>
          <span class="calc-value">¥{{ formatMoney(formStore.copyBindTotal) }}</span>
        </div>
        <template v-if="expandedKeys['04']">
          <div v-for="inv in getInvoicesByKey('04')" :key="inv.fileName" class="calc-row detail-row">
            <span class="calc-label">{{ inv.fileName }}</span>
            <span class="calc-value detail-value">¥{{ formatMoney(inv.amount) }}</span>
          </div>
        </template>

        <div class="calc-row">
          <span class="calc-label expandable" :class="{ clickable: getInvoicesByKey('05').length }" @click="getInvoicesByKey('05').length && toggleExpand('05')">
            <span v-if="getInvoicesByKey('05').length" class="expand-arrow">{{ expandedKeys['05'] ? '▼' : '▶' }}</span>
            专家评审费
          </span>
          <span class="calc-value">¥{{ formatMoney(formStore.expertReviewTotal) }}</span>
        </div>
        <template v-if="expandedKeys['05']">
          <div v-for="inv in getInvoicesByKey('05')" :key="inv.fileName" class="calc-row detail-row">
            <span class="calc-label">{{ inv.fileName }}</span>
            <span class="calc-value detail-value">¥{{ formatMoney(inv.amount) }}</span>
          </div>
        </template>

        <div class="calc-row">
          <span class="calc-label expandable" :class="{ clickable: getInvoicesByKey('06').length }" @click="getInvoicesByKey('06').length && toggleExpand('06')">
            <span v-if="getInvoicesByKey('06').length" class="expand-arrow">{{ expandedKeys['06'] ? '▼' : '▶' }}</span>
            办公用品费
          </span>
          <span class="calc-value">¥{{ formatMoney(formStore.officeSuppliesTotal) }}</span>
        </div>
        <template v-if="expandedKeys['06']">
          <div v-for="inv in getInvoicesByKey('06')" :key="inv.fileName" class="calc-row detail-row">
            <span class="calc-label">{{ inv.fileName }}</span>
            <span class="calc-value detail-value">¥{{ formatMoney(inv.amount) }}</span>
          </div>
        </template>

        <div class="calc-row">
          <span class="calc-label expandable" :class="{ clickable: getInvoicesByKey('07').length }" @click="getInvoicesByKey('07').length && toggleExpand('07')">
            <span v-if="getInvoicesByKey('07').length" class="expand-arrow">{{ expandedKeys['07'] ? '▼' : '▶' }}</span>
            餐饮费
          </span>
          <span class="calc-value">¥{{ formatMoney(formStore.mealTotal) }}</span>
        </div>
        <template v-if="expandedKeys['07']">
          <div v-for="inv in getInvoicesByKey('07')" :key="inv.fileName" class="calc-row detail-row">
            <span class="calc-label">{{ inv.fileName }}</span>
            <span class="calc-value detail-value">¥{{ formatMoney(inv.amount) }}</span>
          </div>
        </template>

        <div class="calc-row">
          <span class="calc-label expandable" :class="{ clickable: getInvoicesByKey('08').length }" @click="getInvoicesByKey('08').length && toggleExpand('08')">
            <span v-if="getInvoicesByKey('08').length" class="expand-arrow">{{ expandedKeys['08'] ? '▼' : '▶' }}</span>
            会议费
          </span>
          <span class="calc-value">¥{{ formatMoney(formStore.meetingTotal) }}</span>
        </div>
        <template v-if="expandedKeys['08']">
          <div v-for="inv in getInvoicesByKey('08')" :key="inv.fileName" class="calc-row detail-row">
            <span class="calc-label">{{ inv.fileName }}</span>
            <span class="calc-value detail-value">¥{{ formatMoney(inv.amount) }}</span>
          </div>
        </template>

        <div class="calc-row">
          <span class="calc-label expandable" :class="{ clickable: getInvoicesByKey('09').length }" @click="getInvoicesByKey('09').length && toggleExpand('09')">
            <span v-if="getInvoicesByKey('09').length" class="expand-arrow">{{ expandedKeys['09'] ? '▼' : '▶' }}</span>
            快递费
          </span>
          <span class="calc-value">¥{{ formatMoney(formStore.expressTotal) }}</span>
        </div>
        <template v-if="expandedKeys['09']">
          <div v-for="inv in getInvoicesByKey('09')" :key="inv.fileName" class="calc-row detail-row">
            <span class="calc-label">{{ inv.fileName }}</span>
            <span class="calc-value detail-value">¥{{ formatMoney(inv.amount) }}</span>
          </div>
        </template>

        <div class="calc-row">
          <span class="calc-label expandable" :class="{ clickable: getInvoicesByKey('10').length }" @click="getInvoicesByKey('10').length && toggleExpand('10')">
            <span v-if="getInvoicesByKey('10').length" class="expand-arrow">{{ expandedKeys['10'] ? '▼' : '▶' }}</span>
            其他费用
          </span>
          <span class="calc-value">¥{{ formatMoney(formStore.otherTotal) }}</span>
        </div>
        <template v-if="expandedKeys['10']">
          <div v-for="inv in getInvoicesByKey('10')" :key="inv.fileName" class="calc-row detail-row">
            <span class="calc-label">{{ inv.fileName }}</span>
            <span class="calc-value detail-value">¥{{ formatMoney(inv.amount) }}</span>
          </div>
        </template>

        <el-divider />

        <!-- 报销总额 -->
        <div class="calc-row total-row">
          <span class="calc-label">报销总额</span>
          <span class="calc-value total-value">¥{{ formatMoney(formStore.totalAmount) }}</span>
        </div>
        <div class="calc-row">
          <span class="calc-label">大写金额</span>
          <span class="calc-value chinese-amount">{{ chineseTotal }}</span>
        </div>

        <el-divider />

        <!-- 结算信息 -->
        <div class="calc-row">
          <span class="calc-label">转账金额</span>
          <span class="calc-value">¥{{ formatMoney(formStore.transferAmount) }}</span>
        </div>
        <div class="calc-row">
          <span class="calc-label">补领金额</span>
          <span class="calc-value" :class="{ 'highlight-amount': formStore.supplementAmount > 0 }">¥{{ formatMoney(formStore.supplementAmount) }}</span>
        </div>
        <div class="calc-row">
          <span class="calc-label">退还金额</span>
          <span class="calc-value" :class="{ 'highlight-amount': formStore.refundAmount > 0 }">¥{{ formatMoney(formStore.refundAmount) }}</span>
        </div>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import dayjs from 'dayjs'
import { useSettingsStore } from '../stores/settings'
import { useFormStore } from '../stores/form'
import { useSessionStore } from '../stores/session'
import { useProjectsStore } from '../stores/projects'
import { numberToChinese } from '../utils/numberToChinese'

const settingsStore = useSettingsStore()
const formStore = useFormStore()
const sessionStore = useSessionStore()
const projectsStore = useProjectsStore()

// ─── 费用分类发票展开状态 ───
const expandedKeys = reactive({})

function toggleExpand(key) {
  expandedKeys[key] = !expandedKeys[key]
}

// ─── 辅助函数：判断是否为实际计费发票（排除行程单） ───
function isActualInvoice(inv) {
  const type = (inv.invoiceType || '').trim()
  return !type.includes('行程单')
}

// ─── 按分类获取发票列表（排除行程单） ───
function getInvoicesByKey(key) {
  const invoices = sessionStore.invoices
  if (key === '02-station') return invoices.filter(inv => inv.category === '02' && inv.taxiType === 'station' && isActualInvoice(inv))
  if (key === '02-city') return invoices.filter(inv => inv.category === '02' && inv.taxiType === 'city' && isActualInvoice(inv))
  return invoices.filter(inv => inv.category === key && isActualInvoice(inv))
}

const formRef = ref(null)

// ─── 表单验证数据对象（仅用于 el-form :model） ───
const formData = computed(() => ({
  projectCode: formStore.projectCode,
  reason: formStore.reason
}))

// ─── 验证规则 ───
const formRules = {
  projectCode: [
    { required: true, validator: validateNotEmpty, trigger: 'blur' }
  ],
  reason: [
    { required: true, validator: validateNotEmpty, trigger: 'blur' }
  ]
}

function validateNotEmpty(rule, value, callback) {
  if (!value || !value.trim()) {
    callback(new Error('此字段为必填项'))
  } else {
    callback()
  }
}

// ─── 默认报销日期 ───
onMounted(() => {
  if (!formStore.reimburseDate) {
    formStore.reimburseDate = dayjs().format('YYYY-MM-DD')
  }
  projectsStore.load()
})

// ─── 部门/出差人修改同步到 settings ───
function onDepartmentChange(val) {
  settingsStore.updateProfile('department', val)
}

function onReimburserChange(val) {
  settingsStore.updateProfile('reimburser', val)
}

// ─── 项目简写：历史联想 + 记忆 ───
function fetchProjectSuggestions(queryString, cb) {
  const q = (queryString || '').trim().toLowerCase()
  const list = projectsStore.projects
    .filter((p) => !q || (p.code || '').toLowerCase().includes(q))
    .slice(0, 20)
    .map((p) => ({ value: p.code, useCount: p.useCount }))
  cb(list)
}

function onProjectCodeChange(val) {
  projectsStore.remember(val)
}

// ─── 金额格式化：千位分隔符 + 2位小数 ───
function formatMoney(num) {
  if (num == null) return '0.00'
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

// ─── 大写金额 ───
const chineseTotal = computed(() => numberToChinese(formStore.totalAmount))

// ─── 暴露验证方法 ───
defineExpose({
  validate() {
    return formRef.value.validate().then(() => true).catch(() => false)
  }
})
</script>

<style scoped>
.step3-container {
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

/* 计算行 */
.calc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
}

.calc-row.sub-row {
  padding-left: 16px;
}

/* 展开箭头 */
.expand-arrow {
  display: inline-block;
  width: 14px;
  font-size: 10px;
  color: #909399;
  margin-right: 2px;
  transition: transform 0.2s;
}

.calc-label.expandable {
  display: flex;
  align-items: center;
}

.calc-label.clickable {
  cursor: pointer;
}

.calc-label.clickable:hover {
  color: #409eff;
}

/* 发票明细行 */
.calc-row.detail-row {
  padding-left: 32px;
  padding-top: 3px;
  padding-bottom: 3px;
  background: #fafafa;
  border-radius: 4px;
  margin: 1px 0;
}

.calc-row.detail-row .calc-label {
  font-size: 12px;
  color: #909399;
}

.detail-value {
  font-size: 12px;
  color: #909399;
}

.calc-label {
  color: #606266;
}

.calc-value {
  color: #303133;
  font-variant-numeric: tabular-nums;
}

.calc-hint {
  font-size: 12px;
  color: #909399;
  margin-left: 4px;
}

/* 补助标准输入框 */
.subsidy-input {
  width: 130px;
}

/* 合计行 */
.total-row {
  padding: 10px 0;
}

.total-value {
  font-size: 20px;
  font-weight: 700;
  color: #409eff;
}

.chinese-amount {
  color: #e6a23c;
  font-weight: 500;
}

/* 金额高亮 */
.highlight-amount {
  color: #f56c6c;
  font-weight: 500;
}

/* 分隔线 */
:deep(.el-divider) {
  margin: 10px 0;
}

/* 输入数字组件宽度 */
:deep(.el-input-number) {
  width: 100%;
}
</style>
