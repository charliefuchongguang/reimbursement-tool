import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as storage from '@/utils/storage'
import { apiRequest, getToken, setToken } from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getToken())
  const user = ref(storage.get('authUser') || null)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const mustChangePassword = computed(() => !!user.value?.mustChangePassword)

  function persist() {
    setToken(token.value)
    if (user.value) storage.set('authUser', user.value)
    else storage.remove('authUser')
  }

  function applyAuth(res) {
    token.value = res.token
    user.value = res.user
    persist()
  }

  async function register(nickname, phone) {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: { nickname, phone },
      auth: false
    })
    applyAuth(res)
    return res.user
  }

  async function login(phone, password) {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: { phone, password },
      auth: false
    })
    applyAuth(res)
    return res.user
  }

  async function changePassword(oldPassword, newPassword) {
    const res = await apiRequest('/auth/change-password', {
      method: 'POST',
      body: { oldPassword, newPassword }
    })
    user.value = res.user
    persist()
    return res.user
  }

  async function updateProfile(patch) {
    const res = await apiRequest('/auth/profile', { method: 'PUT', body: patch })
    user.value = res.user
    persist()
    return res.user
  }

  function logout() {
    token.value = ''
    user.value = null
    persist()
  }

  /**
   * 应用启动时用已存 token 恢复登录态
   */
  async function restore() {
    if (!token.value) {
      initialized.value = true
      return
    }
    try {
      const res = await apiRequest('/auth/me')
      user.value = res.user
      persist()
    } catch {
      logout()
    } finally {
      initialized.value = true
    }
  }

  return {
    token,
    user,
    initialized,
    isAuthenticated,
    isAdmin,
    mustChangePassword,
    register,
    login,
    changePassword,
    updateProfile,
    logout,
    restore
  }
})