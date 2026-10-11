import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useAuthStore } from './auth'

/**
 * 个人信息（部门 / 出差人）现在归属于登录账号，存储在服务端。
 * 这里保留一个本地可写副本，兼容各页面既有的 v-model 用法。
 */
export const useSettingsStore = defineStore('settings', () => {
  const auth = useAuthStore()

  const profile = ref({
    department: auth.user?.department || '',
    reimburser: auth.user?.reimburser || ''
  })

  function syncFromAuth() {
    profile.value = {
      department: auth.user?.department || '',
      reimburser: auth.user?.reimburser || ''
    }
  }

  watch(() => auth.user, syncFromAuth, { immediate: true })

  /**
   * 修改个人信息并同步到服务端
   * @param {string} key - department | reimburser
   * @param {string} value
   */
  function updateProfile(key, value) {
    profile.value[key] = value
    auth.updateProfile({ [key]: value }).catch((e) => {
      console.error('保存个人信息失败：', e)
    })
  }

  return {
    profile,
    updateProfile,
    syncFromAuth
  }
})