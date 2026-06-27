import { defineStore } from 'pinia'
import { ref } from 'vue'
import { get as storageGet, set as storageSet } from '@/utils/storage'

export const useSettingsStore = defineStore('settings', () => {
  // 个人信息
  const profile = ref({
    department: storageGet('profile.department') || '',
    reimburser: storageGet('profile.reimburser') || ''
  })

  // DeepSeek API Key
  const deepseekApiKey = ref(storageGet('deepseekApiKey') || '')

  // 修改个人信息时自动保存
  const updateProfile = (key, value) => {
    profile.value[key] = value
    storageSet(`profile.${key}`, value)
  }

  // 修改 API Key 时自动保存
  const updateApiKey = (key) => {
    deepseekApiKey.value = key
    storageSet('deepseekApiKey', key)
  }

  return {
    profile,
    deepseekApiKey,
    updateProfile,
    updateApiKey
  }
})
