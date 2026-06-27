<template>
  <el-dialog
    :model-value="visible"
    title="⚙️ 设置"
    width="480px"
    @update:model-value="$emit('update:visible', $event)"
    :close-on-click-modal="false"
  >
    <!-- 个人信息区 -->
    <div class="section-title">📌 个人信息（首次填写后自动记忆）</div>
    <el-form label-position="top" class="settings-form">
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

    <!-- API Key 区 -->
    <div class="section-title">🤖 DeepSeek API Key</div>
    <el-form label-position="top" class="settings-form">
      <el-form-item label="API Key">
        <el-input
          v-model="localApiKey"
          type="password"
          placeholder="请输入 DeepSeek API Key"
          show-password
        />
      </el-form-item>
      <div class="api-actions">
        <el-button
          size="small"
          :loading="testing"
          @click="testConnection"
        >
          测试连接
        </el-button>
        <el-button size="small" @click="clearApiKey">
          清除
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

    <div class="tip-text">
      💡 还没有 API Key？去
      <a href="https://platform.deepseek.com" target="_blank" rel="noopener">platform.deepseek.com</a>
      申请 → 新用户有免费额度
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps({
  visible: Boolean
})
const emit = defineEmits(['update:visible'])

const settingsStore = useSettingsStore()

// 本地编辑状态（不直接修改 store，点保存才写入）
const localProfile = ref({
  department: '',
  reimburser: ''
})
const localApiKey = ref('')
const testing = ref(false)
const testResult = ref(null)

// 弹窗打开时，从 store 同步到本地
watch(() => props.visible, (val) => {
  if (val) {
    localProfile.value = {
      department: settingsStore.profile.department,
      reimburser: settingsStore.profile.reimburser
    }
    localApiKey.value = settingsStore.deepseekApiKey
    testResult.value = null
  }
})

// 测试 DeepSeek API 连接
const testConnection = async () => {
  if (!localApiKey.value.trim()) {
    testResult.value = { success: false, message: '请先输入 API Key' }
    return
  }
  testing.value = true
  testResult.value = null
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localApiKey.value.trim()}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5
      })
    })
    if (res.ok) {
      testResult.value = { success: true }
    } else {
      const data = await res.json().catch(() => ({}))
      const msg = data.error?.message || `HTTP ${res.status}`
      testResult.value = { success: false, message: msg }
    }
  } catch (e) {
    testResult.value = { success: false, message: '网络错误，请检查连接' }
  } finally {
    testing.value = false
  }
}

// 清除 API Key
const clearApiKey = () => {
  localApiKey.value = ''
  testResult.value = null
}

// 保存设置到 store
const saveSettings = () => {
  settingsStore.updateProfile('department', localProfile.value.department)
  settingsStore.updateProfile('reimburser', localProfile.value.reimburser)
  settingsStore.updateApiKey(localApiKey.value.trim())
  emit('update:visible', false)
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

.tip-text {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}

.tip-text a {
  color: #409eff;
  text-decoration: none;
}

.tip-text a:hover {
  text-decoration: underline;
}
</style>
