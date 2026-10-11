<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand">
        <span class="auth-logo">📋</span>
        <h1>报销助手</h1>
        <p>出差报销辅助工具 · 多用户版</p>
      </div>

      <el-tabs v-model="activeTab" stretch>
        <el-tab-pane label="登录" name="login">
          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            label-position="top"
            @submit.prevent
          >
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="loginForm.phone" maxlength="11" placeholder="请输入手机号" />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                show-password
                placeholder="请输入密码"
                @keyup.enter="submitLogin"
              />
            </el-form-item>
            <el-button
              type="primary"
              class="auth-submit"
              :loading="loading"
              @click="submitLogin"
            >
              登录
            </el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form
            ref="registerFormRef"
            :model="registerForm"
            :rules="registerRules"
            label-position="top"
            @submit.prevent
          >
            <el-form-item label="昵称" prop="nickname">
              <el-input v-model="registerForm.nickname" maxlength="30" placeholder="请输入昵称" />
            </el-form-item>
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="registerForm.phone" maxlength="11" placeholder="请输入手机号" />
            </el-form-item>
            <el-alert
              type="info"
              :closable="false"
              show-icon
              title="初始密码为手机号后六位，首次登录后需修改。"
            />
            <el-button
              type="primary"
              class="auth-submit"
              :loading="loading"
              @click="submitRegister"
            >
              注册并登录
            </el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const activeTab = ref('login')
const loading = ref(false)

const loginFormRef = ref(null)
const registerFormRef = ref(null)

const loginForm = reactive({ phone: '', password: '' })
const registerForm = reactive({ nickname: '', phone: '' })

const PHONE_RE = /^1[3-9]\d{9}$/

const loginRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: PHONE_RE, message: '请输入有效的 11 位手机号', trigger: 'blur' }
  ],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const registerRules = {
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: PHONE_RE, message: '请输入有效的 11 位手机号', trigger: 'blur' }
  ]
}

async function submitLogin() {
  const valid = await loginFormRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await auth.login(loginForm.phone.trim(), loginForm.password)
    ElMessage.success('登录成功')
  } catch (e) {
    ElMessage.error(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}

async function submitRegister() {
  const valid = await registerFormRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await auth.register(registerForm.nickname.trim(), registerForm.phone.trim())
    ElMessage.success('注册成功，请设置新密码')
  } catch (e) {
    ElMessage.error(e.message || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #eef2ff 0%, #f5f7fa 100%);
  padding: 20px;
}

.auth-card {
  width: 380px;
  max-width: 100%;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  padding: 32px 28px 24px;
}

.auth-brand {
  text-align: center;
  margin-bottom: 16px;
}

.auth-logo {
  font-size: 36px;
}

.auth-brand h1 {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 8px 0 4px;
}

.auth-brand p {
  font-size: 12px;
  color: #909399;
}

.auth-submit {
  width: 100%;
  margin-top: 8px;
}

:deep(.el-alert) {
  margin-bottom: 12px;
}
</style>