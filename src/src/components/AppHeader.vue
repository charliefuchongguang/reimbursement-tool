<template>
  <div class="app-header">
    <div class="header-left">
      <span class="app-logo">📋</span>
      <h1 class="app-title">报销助手</h1>
    </div>
    <div class="header-right">
      <el-button circle plain size="small" @click="$emit('open-settings')">
        <el-icon><Setting /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { Setting } from '@element-plus/icons-vue'

defineEmits(['open-settings'])
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 20px;
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-logo {
  font-size: 20px;
}

.app-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}
</style>
