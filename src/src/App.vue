<template>
  <div class="app-container">
    <!-- 未登录：显示登录/注册 -->
    <LoginView v-if="!authStore.isAuthenticated" />

    <!-- 首次登录强制改密 -->
    <ChangePasswordView v-else-if="authStore.mustChangePassword" />

    <template v-else>
      <!-- 浏览器不兼容全屏提示 -->
      <div v-if="!isSupported" class="unsupported-overlay">
        <div class="unsupported-card">
          <div class="unsupported-icon">⚠️</div>
          <h2>浏览器不兼容</h2>
          <p>当前浏览器不支持文件系统访问，请使用 Chrome 或 Edge 浏览器（版本 ≥ 120）</p>
        </div>
      </div>

      <template v-else>
        <!-- 顶部导航栏 -->
        <AppHeader @open-settings="settingsVisible = true" />

        <!-- Tab 切换 -->
        <el-tabs v-model="activeTab" class="app-tabs">
          <el-tab-pane label="报销流程" name="flow">
            <!-- 步骤条 -->
            <div class="steps-wrapper">
              <el-steps :active="currentStep" finish-status="success" align-center>
                <el-step title="选择文件夹" />
                <el-step title="识别审查" />
                <el-step title="填写信息" />
                <el-step title="归档生成" />
              </el-steps>
            </div>

            <!-- 主内容区 -->
            <el-main class="app-main">
              <Step1SelectFolder v-if="currentStep === 0" />
              <Step2ReviewInvoices v-else-if="currentStep === 1" ref="step2Ref" />
              <Step3FillInfo v-else-if="currentStep === 2" ref="step3Ref" />
              <Step4Generate v-else-if="currentStep === 3" />
            </el-main>

            <!-- 底部导航按钮 -->
            <el-footer class="app-footer">
              <div class="footer-buttons">
                <el-button
                  :disabled="currentStep === 0"
                  @click="prevStep"
                >
                  上一步
                </el-button>
                <el-button
                  type="primary"
                  :disabled="currentStep === 3"
                  @click="nextStep"
                >
                  下一步
                </el-button>
              </div>
            </el-footer>
          </el-tab-pane>

          <el-tab-pane label="任务记录" name="history">
            <TaskHistory />
          </el-tab-pane>

          <el-tab-pane label="出差日历" name="calendar">
            <TripCalendar />
          </el-tab-pane>
        </el-tabs>

        <!-- 设置弹窗 -->
        <SettingsDialog v-model:visible="settingsVisible" />
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, shallowRef } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from './stores/auth'
import { useHistoryStore } from './stores/history'
import AppHeader from './components/AppHeader.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import LoginView from './views/LoginView.vue'
import ChangePasswordView from './views/ChangePasswordView.vue'
import Step1SelectFolder from './views/Step1SelectFolder.vue'
import Step2ReviewInvoices from './views/Step2ReviewInvoices.vue'
import Step3FillInfo from './views/Step3FillInfo.vue'
import Step4Generate from './views/Step4Generate.vue'
import TaskHistory from './views/TaskHistory.vue'
import TripCalendar from './views/TripCalendar.vue'

const authStore = useAuthStore()
const historyStore = useHistoryStore()

const activeTab = ref('flow')
const currentStep = ref(0)
const settingsVisible = ref(false)
const isSupported = ref(true)
const step2Ref = shallowRef(null)
const step3Ref = shallowRef(null)

onMounted(async () => {
  // 浏览器兼容性检测
  if (!('showDirectoryPicker' in window)) {
    isSupported.value = false
  }

  // 恢复登录态，并按用户加载任务记录
  await authStore.restore()
  if (authStore.isAuthenticated) {
    historyStore.loadTasks()
  }
})

// 登录/登出时同步任务记录
watch(
  () => authStore.isAuthenticated,
  (val) => {
    if (val) historyStore.loadTasks()
    else historyStore.reset()
  }
)

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const nextStep = async () => {
  if (currentStep.value < 3) {
    // 从 Step 2 离开时检查是否有未解决问题
    if (currentStep.value === 1 && step2Ref.value) {
      if (step2Ref.value.hasUnresolvedIssues()) {
        const count = step2Ref.value.getUnresolvedCount()
        try {
          await ElMessageBox.confirm(
            `仍有 ${count} 个问题未解决，是否继续？`,
            '提示',
            {
              confirmButtonText: '继续',
              cancelButtonText: '返回检查',
              type: 'warning'
            }
          )
        } catch {
          return // 用户选择返回检查
        }
      }
    }

    // 从 Step 3 离开时验证表单
    if (currentStep.value === 2 && step3Ref.value) {
      const valid = await step3Ref.value.validate()
      if (!valid) return
    }
    currentStep.value++
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* Tab 切换栏 */
.app-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-tabs > .el-tabs__header {
  margin: 0;
  padding: 0 20px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.app-tabs > .el-tabs__content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-tabs .el-tab-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.steps-wrapper {
  padding: 20px 40px;
  background-color: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: #fff;
}

.app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid #e4e7ed;
  background-color: #fff;
  height: 60px !important;
  flex-shrink: 0;
}

.footer-buttons {
  display: flex;
  gap: 12px;
}

/* 浏览器不兼容全屏提示 */
.unsupported-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  z-index: 9999;
}

.unsupported-card {
  text-align: center;
  padding: 48px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  max-width: 480px;
}

.unsupported-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.unsupported-card h2 {
  font-size: 20px;
  color: #303133;
  margin-bottom: 12px;
}

.unsupported-card p {
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
}
</style>