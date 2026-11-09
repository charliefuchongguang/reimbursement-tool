<template>
  <div class="user-manage">
    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索昵称 / 手机号"
        clearable
        style="width: 260px"
      />
      <el-button :loading="loading" @click="load">刷新</el-button>
      <span class="count">共 {{ filtered.length }} 个账号</span>
    </div>

    <el-table
      v-loading="loading"
      :data="filtered"
      row-key="id"
      stripe
      size="small"
      style="width: 100%"
    >
      <el-table-column type="index" label="#" width="50" />
      <el-table-column prop="nickname" label="昵称" min-width="110" />
      <el-table-column prop="phone" label="手机号" width="125" />
      <el-table-column label="角色" width="95">
        <template #default="{ row }">
          <el-tag :type="row.role === 'admin' ? 'warning' : 'info'" size="small" effect="plain">
            {{ row.role === 'admin' ? '管理员' : '普通用户' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="部门" min-width="100">
        <template #default="{ row }">{{ row.department || '—' }}</template>
      </el-table-column>
      <el-table-column label="出差人" min-width="90">
        <template #default="{ row }">{{ row.reimburser || '—' }}</template>
      </el-table-column>
      <el-table-column label="任务数" width="80" align="center">
        <template #default="{ row }">{{ row.taskCount ?? 0 }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <span v-if="row.mustChangePassword" class="state-warn">需改密</span>
          <span v-else class="state-ok">正常</span>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" width="160">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="110" align="center">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="openPasswordDialog(row)">
            修改密码
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="pwdDialogVisible"
      :title="`修改密码 - ${pwdTarget.nickname || ''}`"
      width="380px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="pwdFormRef"
        :model="pwdForm"
        :rules="pwdRules"
        label-position="top"
      >
        <el-form-item label="新密码" prop="password">
          <el-input v-model="pwdForm.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="pwdForm.confirmPassword"
            type="password"
            show-password
            placeholder="请再次输入新密码"
            @keyup.enter="submitPassword"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSubmitting" @click="submitPassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { apiRequest } from '@/services/api'

const users = ref([])
const loading = ref(false)
const keyword = ref('')

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(
    (u) => (u.nickname || '').toLowerCase().includes(q) || (u.phone || '').includes(q)
  )
})

function formatTime(iso) {
  if (!iso) return '—'
  return dayjs(iso).format('YYYY-MM-DD HH:mm')
}

async function load() {
  loading.value = true
  try {
    const res = await apiRequest('/admin/users')
    users.value = res.users || []
  } catch (e) {
    ElMessage.error(e.message || '加载账号列表失败')
  } finally {
    loading.value = false
  }
}

// ─── 协助修改密码 ───
const pwdDialogVisible = ref(false)
const pwdSubmitting = ref(false)
const pwdFormRef = ref(null)
const pwdTarget = reactive({ id: null, nickname: '' })
const pwdForm = reactive({ password: '', confirmPassword: '' })

const pwdRules = {
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (rule, value, cb) => {
        if (value !== pwdForm.password) cb(new Error('两次输入的密码不一致'))
        else cb()
      },
      trigger: 'blur'
    }
  ]
}

function openPasswordDialog(row) {
  pwdTarget.id = row.id
  pwdTarget.nickname = row.nickname
  pwdForm.password = ''
  pwdForm.confirmPassword = ''
  pwdDialogVisible.value = true
}

async function submitPassword() {
  const valid = await pwdFormRef.value?.validate().catch(() => false)
  if (!valid) return
  pwdSubmitting.value = true
  try {
    await apiRequest(`/admin/users/${pwdTarget.id}/password`, {
      method: 'PUT',
      body: { password: pwdForm.password }
    })
    ElMessage.success('密码已修改')
    pwdDialogVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '修改失败')
  } finally {
    pwdSubmitting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.user-manage {
  padding: 8px 4px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.count {
  font-size: 13px;
  color: #909399;
}

.state-ok {
  color: #67c23a;
}

.state-warn {
  color: #e6a23c;
}
</style>