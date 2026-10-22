import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSessionStore = defineStore('session', () => {
  // 选中的源文件夹句柄（File System Access API）
  const sourceDirHandle = ref(null)

  // 扫描到的文件列表
  const files = ref([])

  // 识别后的发票数据
  const invoices = ref([])

  // 跨发票问题
  const globalIssues = ref([])

  // 自动化处理中（扫描文件夹 / 解压 / 发票识别等），用于禁用下一步等操作
  const busy = ref(false)

  // 重置会话数据
  const resetSession = () => {
    sourceDirHandle.value = null
    files.value = []
    invoices.value = []
    globalIssues.value = []
    busy.value = false
  }

  return {
    sourceDirHandle,
    files,
    invoices,
    globalIssues,
    busy,
    resetSession
  }
})
