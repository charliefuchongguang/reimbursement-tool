<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-brand">
        <span class="auth-logo">🔒</span>
        <h1>设置新密码</h1>
        <p>首次登录需修改默认密码后继续使用</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent
      >
        <el-form-item label="当前密码（初始为手机号后六位）" prop="oldPassword">
          <el-input v-model="form.oldPassword" type="password" show-password placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="form.newPassword" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            show-password
            placeholder="请再次输入新密码"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button type="primary" class="auth-submit" :loading="loading" @click="submit">
          确认修改
        </el-button>
        <el-button text class="auth-logout" @click="logout">退出登录</el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const formRef = ref(null)
const loading = ref(false)
const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const rules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码至少 6 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, cb) => {
        if (value !== form.newPassword) cb(new Error('两次输入的密码不一致'))
        else cb()
      },
      trigger: 'blur'
    }
  ]
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await auth.changePassword(form.oldPassword, form.newPassword)
    ElMessage.success('密码修改成功')
  } catch (e) {
    ElMessage.error(e.message || '修改失败')
  } finally {
    loading.value = false
  }
}

function logout() {
  auth.logout()
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

.auth-logout {
  width: 100%;
  margin: 8px 0 0;
  color: #909399;
}
</style>