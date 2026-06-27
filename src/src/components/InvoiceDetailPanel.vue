<template>
  <div class="invoice-detail-panel">
    <el-descriptions :column="3" border size="small">
      <el-descriptions-item label="发票号码">
        {{ invoice.invoiceNo || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="发票类型">
        {{ invoice.invoiceType || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="发票代码">
        {{ invoice.invoiceCode || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="不含税金额">
        <span v-if="invoice.amountExcludeTax">{{ invoice.amountExcludeTax.toFixed(2) }}</span>
        <span v-else>—</span>
      </el-descriptions-item>
      <el-descriptions-item label="税额">
        <span v-if="invoice.amountTax">{{ invoice.amountTax.toFixed(2) }}</span>
        <span v-else>—</span>
      </el-descriptions-item>
      <el-descriptions-item label="含税金额">
        <span v-if="invoice.amount">{{ invoice.amount.toFixed(2) }}</span>
        <span v-else>—</span>
      </el-descriptions-item>
      <el-descriptions-item label="购买方">
        {{ invoice.buyer || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="备注" :span="2">
        {{ invoice.remark || '—' }}
      </el-descriptions-item>
    </el-descriptions>

    <!-- 交通类额外字段 -->
    <el-descriptions
      v-if="isTransport"
      :column="3"
      border
      size="small"
      class="extra-section"
    >
      <template #title>
        <span class="section-label">交通信息</span>
      </template>
      <el-descriptions-item label="出发地">
        {{ invoice.origin || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="到达地">
        {{ invoice.destination || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="交通工具">
        {{ invoice.transportTool || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="乘客">
        {{ invoice.passenger || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="航班号/车次">
        {{ invoice.flightNo || invoice.trainNo || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="" />
    </el-descriptions>

    <!-- 住宿类额外字段 -->
    <el-descriptions
      v-if="isAccommodation"
      :column="3"
      border
      size="small"
      class="extra-section"
    >
      <template #title>
        <span class="section-label">住宿信息</span>
      </template>
      <el-descriptions-item label="住宿人">
        {{ invoice.stayPerson || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="入住日期">
        {{ invoice.checkInDate || '—' }}
      </el-descriptions-item>
      <el-descriptions-item label="离店日期">
        {{ invoice.checkOutDate || '—' }}
      </el-descriptions-item>
    </el-descriptions>

    <!-- 文件信息 -->
    <div class="file-info-section">
      <span class="section-label">文件信息</span>
      <div class="file-info-items">
        <span v-if="invoice.fileName" class="file-info-item">
          <el-icon :size="14"><Document /></el-icon>
          {{ invoice.fileName }}
        </span>
        <span v-if="invoice.companionFileName" class="file-info-item">
          <el-icon :size="14" color="#67c23a"><Tickets /></el-icon>
          {{ invoice.companionFileName }}
        </span>
        <span v-if="!invoice.fileName && !invoice.companionFileName" class="file-info-item text-muted">
          手动录入
        </span>
      </div>
    </div>

    <!-- 问题列表 -->
    <div v-if="invoice.issues && invoice.issues.length > 0" class="issues-section">
      <span class="section-label">问题 ({{ invoice.issues.length }})</span>
      <div
        v-for="(issue, idx) in invoice.issues"
        :key="idx"
        class="issue-item"
        :class="`issue-${issue.severity}`"
      >
        <span class="issue-icon">
          {{ issue.severity === 'error' ? '❌' : issue.severity === 'warn' ? '⚠️' : '💡' }}
        </span>
        <span class="issue-msg">{{ issue.msg }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Document, Tickets } from '@element-plus/icons-vue'

const props = defineProps({
  invoice: {
    type: Object,
    required: true
  }
})

const isTransport = computed(() =>
  props.invoice.category === '01' || props.invoice.category === '02'
)

const isAccommodation = computed(() =>
  props.invoice.category === '03'
)
</script>

<style scoped>
.invoice-detail-panel {
  padding: 12px 20px;
}

.extra-section {
  margin-top: 12px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
  display: block;
}

.file-info-section {
  margin-top: 16px;
}

.file-info-items {
  display: flex;
  gap: 16px;
  margin-top: 6px;
}

.file-info-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #606266;
}

.text-muted {
  color: #909399;
  font-style: italic;
}

.issues-section {
  margin-top: 16px;
}

.issue-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 10px;
  margin-top: 4px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
}

.issue-icon {
  flex-shrink: 0;
}

.issue-msg {
  color: #606266;
}

.issue-error {
  background: #fef0f0;
  border-left: 3px solid #f56c6c;
}

.issue-warn {
  background: #fdf6ec;
  border-left: 3px solid #e6a23c;
}

.issue-info {
  background: #f0f6ff;
  border-left: 3px solid #409eff;
}
</style>
