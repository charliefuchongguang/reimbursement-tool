<template>
  <el-dialog
    :model-value="visible"
    title="⚙️ 设置"
    width="480px"
    @update:model-value="$emit('update:visible', $event)"
    :close-on-click-modal="false"
  >
    <!-- 个人信息区 -->
    <div class="section-title">📌 个人信息</div>
    <el-form label-position="top" class="settings-form">
      <el-form-item label="昵称">
        <el-input v-model="localNickname" placeholder="请输入昵称" />
      </el-form-item>
      <el-form-item label="部门">
        <el-input
          v-model="localProfile.department"
          placeholder="请输入部门名称"
        />
      </el-form-item>
      <el-form-item label="出差人">
        <el-input
          v-model="localProfile.reimburser"
          placeholder="请输入出差人姓名"
        />
      </el-form-item>
    </el-form>

    <el-divider />

    <!-- 大模型配置：仅管理员可见 -->
    <template v-if="auth.isAdmin">
      <div class="section-title">🤖 统一大模型配置（管理员）</div>
      <el-form label-position="top" class="settings-form">
        <el-form-item label="模型">
          <el-input v-model="llm.model" placeholder="deepseek-chat" />
        </el-form-item>
        <el-form-item label="接口地址">
          <el-input v-model="llm.baseUrl" placeholder="https://api.deepseek.com" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input
            v-model="llm.apiKey"
            type="password"
            show-password
            :placeholder="llm.apiKeyMasked ? `已配置：${llm.apiKeyMasked}（留空则不修改）` : '请输入 API Key'"
          />
        </el-form-item>
        <div class="api-actions">
          <el-button size="small" :loading="testing" @click="testConnection">
            测试连接
          </el-button>
          <el-button size="small" type="primary" @click="saveSettings">
            保存
          </el-button>
        </div>
        <div v-if="testResult !== null" class="test-result">
          <span v-if="testResult.success" class="test-success">✅ 连接成功</span>
          <span v-else class="test-fail">❌ {{ testResult.message }}</span>
        </div>
      </el-form>
    </template>

    <template v-else>
      <div class="tip-text">
        💡 大模型 API Key 由管理员统一配置，所有用户共用，无需自行填写。
      </div>
      <div class="save-row">
        <el-button size="small" type="primary" @click="saveSettings">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { testApiKey } from '@/services/deepseekClient'
import { apiRequest } from '@/services/api'

const props = defineProps({
  visible: Boolean
})
const emit = defineEmits(['update:visible'])

const settingsStore = useSettingsStore()
const auth = useAuthStore()

const localNickname = ref('')
const localProfile = reactive({ department: '', reimburser: '' })

const llm = reactive({ apiKey: '', apiKeyMasked: '', model: '', baseUrl: '' })
const testing = ref(false)
const testResult = ref(null)

// 弹窗打开时同步数据
watch(
  () => props.visible,
  async (val) => {
    if (!val) return
    localNickname.value = auth.user?.nickname || ''
    localProfile.department = settingsStore.profile.department
    localProfile.reimburser = settingsStore.profile.reimburser
    testResult.value = null
    llm.apiKey = ''
    if (auth.isAdmin) {
      try {
        const res = await apiRequest('/admin/llm')
        llm.apiKeyMasked = res.apiKeyMasked
        llm.model = res.model
        llm.baseUrl = res.baseUrl
      } catch (e) {
        ElMessage.error(e.message || '读取大模型配置失败')
      }
    }
  }
)

// 测试统一 Key 连接
const testConnection = async () => {
  testing.value = true
  testResult.value = null
  try {
    const res = await testApiKey(llm.apiKey.trim() || undefined)
    testResult.value = res.success
      ? { success: true }
      : { success: false, message: res.error || '连接失败' }
  } finally {
    testing.value = false
  }
}

// 保存设置
const saveSettings = async () => {
  try {
    if (localNickname.value.trim() && localNickname.value.trim() !== auth.user?.nickname) {
      await auth.updateProfile({ nickname: localNickname.value.trim() })
    }
    if (localProfile.department !== settingsStore.profile.department) {
      settingsStore.updateProfile('department', localProfile.department)
    }
    if (localProfile.reimburser !== settingsStore.profile.reimburser) {
      settingsStore.updateProfile('reimburser', localProfile.reimburser)
    }
    if (auth.isAdmin) {
      const body = { model: llm.model.trim(), baseUrl: llm.baseUrl.trim() }
      if (llm.apiKey.trim()) body.apiKey = llm.apiKey.trim()
      const res = await apiRequest('/admin/llm', { method: 'PUT', body })
      llm.apiKeyMasked = res.apiKeyMasked
      llm.apiKey = ''
    }
    ElMessage.success('设置已保存')
    emit('update:visible', false)
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}
</script>

<style scoped>
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.settings-form {
  margin-bottom: 8px;
}

.settings-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.settings-form :deep(.el-input) {
  width: 100%;
}

.api-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 8px;
}

.test-result {
  font-size: 13px;
  margin-bottom: 8px;
}

.test-success {
  color: #67c23a;
}

.test-fail {
  color: #f56c6c;
}

.save-row {
  display: flex;
  justify-content: flex-end;
}

.tip-text {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
  padding: 8px 0;
  border-top: 1px solid #ebeef5;
}
</style>