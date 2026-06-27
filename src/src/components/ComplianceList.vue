<template>
  <div class="compliance-list">
    <div class="list-header">
      <el-icon :size="16" color="#e6a23c"><WarningFilled /></el-icon>
      <span class="list-title">问题清单</span>
      <el-badge :value="totalIssues" :type="hasError ? 'danger' : 'warning'" />
    </div>

    <div v-if="allIssues.length === 0" class="empty-issues">
      <el-icon :size="32" color="#67c23a"><CircleCheckFilled /></el-icon>
      <span>全部合规，无问题</span>
    </div>

    <div v-else class="issues-scroll">
      <div
        v-for="(issue, idx) in sortedIssues"
        :key="idx"
        class="compliance-item"
        :class="`severity-${issue.severity}`"
        @click="handleClick(issue)"
      >
        <span class="item-icon">
          {{ iconMap[issue.severity] || '💡' }}
        </span>
        <span class="item-msg">{{ issue.msg }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { WarningFilled, CircleCheckFilled } from '@element-plus/icons-vue'

const props = defineProps({
  invoiceIssues: {
    type: Array,
    default: () => []
  },
  globalIssues: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['locate-invoice'])

const iconMap = {
  error: '❌',
  warn: '⚠️',
  info: '💡'
}

// 严重度排序权重
const severityWeight = { error: 0, warn: 1, info: 2 }

// 合并所有问题
const allIssues = computed(() => {
  return [...props.invoiceIssues, ...props.globalIssues]
})

// 按严重度排序
const sortedIssues = computed(() => {
  return [...allIssues.value].sort((a, b) => {
    return (severityWeight[a.severity] ?? 3) - (severityWeight[b.severity] ?? 3)
  })
})

const totalIssues = computed(() => allIssues.value.length)

const hasError = computed(() => allIssues.value.some(i => i.severity === 'error'))

function handleClick(issue) {
  if (issue.invoiceId) {
    emit('locate-invoice', issue.invoiceId)
  }
}
</script>

<style scoped>
.compliance-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.list-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}

.list-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  flex: 1;
}

.empty-issues {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  color: #67c23a;
  font-size: 13px;
}

.issues-scroll {
  flex: 1;
  overflow-y: auto;
  padding-top: 8px;
}

.compliance-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-left: 3px solid transparent;
}

.compliance-item:hover {
  background-color: #f5f7fa;
}

.severity-error {
  border-left-color: #f56c6c;
  background-color: #fef0f0;
}

.severity-error:hover {
  background-color: #fde2e2;
}

.severity-warn {
  border-left-color: #e6a23c;
  background-color: #fdf6ec;
}

.severity-warn:hover {
  background-color: #faecd8;
}

.severity-info {
  border-left-color: #409eff;
  background-color: #f0f6ff;
}

.severity-info:hover {
  background-color: #dce9f7;
}

.item-icon {
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1.5;
}

.item-msg {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  word-break: break-all;
}
</style>
