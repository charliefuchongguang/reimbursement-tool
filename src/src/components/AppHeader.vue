<template>
  <div class="app-header">
    <div class="header-left">
      <span class="app-logo">📋</span>
      <h1 class="app-title">报销助手</h1>
    </div>
    <div class="header-right">
      <span class="user-name">
        {{ authStore.user?.nickname || authStore.user?.phone }}
        <el-tag v-if="authStore.isAdmin" size="small" type="warning" effect="plain">管理员</el-tag>
      </span>
      <el-button circle plain size="small" @click="$emit('open-settings')">
        <el-icon><Setting /></el-icon>
      </el-button>
      <el-button circle plain size="small" @click="logout">
        <el-icon><SwitchButton /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { Setting, SwitchButton } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

defineEmits(['open-settings'])

const authStore = useAuthStore()

async function logout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning'
    })
    authStore.logout()
  } catch {
    // 用户取消
  }
}
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

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-name {
  font-size: 13px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>