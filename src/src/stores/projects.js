import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiRequest } from '@/services/api'

/**
 * 项目名称记忆：缓存当前用户用过的项目名，供「项目简写」输入框联想
 */
export const useProjectsStore = defineStore('projects', () => {
  const projects = ref([])
  const loaded = ref(false)

  async function load() {
    try {
      const res = await apiRequest('/projects')
      projects.value = res.projects || []
      loaded.value = true
    } catch (e) {
      console.error('加载项目名称失败：', e)
    }
  }

  function reset() {
    projects.value = []
    loaded.value = false
  }

  /**
   * 记住一个项目名（本地即时置顶 + 服务端异步累加使用次数）
   */
  function remember(code) {
    const c = (code || '').trim()
    if (!c) return

    const now = new Date().toISOString()
    const idx = projects.value.findIndex((p) => p.code === c)
    if (idx === -1) {
      projects.value.unshift({ code: c, useCount: 1, updatedAt: now })
    } else {
      const p = projects.value[idx]
      p.useCount = (p.useCount || 0) + 1
      p.updatedAt = now
      projects.value.splice(idx, 1)
      projects.value.unshift(p)
    }

    apiRequest('/projects', { method: 'POST', body: { code: c } }).catch((e) => {
      console.error('保存项目名称失败：', e)
    })
  }

  return { projects, loaded, load, reset, remember }
})