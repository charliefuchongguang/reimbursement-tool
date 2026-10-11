import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { apiRequest } from '@/services/api'

/**
 * 生成唯一任务 ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

/**
 * 精简发票对象，去除不可序列化的字段（FileHandle 等）
 */
function sanitizeInvoice(inv) {
  return {
    id: inv.id,
    invoiceNo: inv.invoiceNo || null,
    invoiceCode: inv.invoiceCode || null,
    invoiceType: inv.invoiceType || null,
    category: inv.category || '',
    amount: inv.amount || 0,
    issueDate: inv.issueDate || null,
    travelDate: inv.travelDate || null,
    fileName: inv.fileName || null,
    filePath: inv.filePath || null,
    origin: inv.origin || null,
    destination: inv.destination || null,
    transportTool: inv.transportTool || null,
    passenger: inv.passenger || null,
    flightNo: inv.flightNo || null,
    departureTime: inv.departureTime || null,
    arrivalTime: inv.arrivalTime || null,
    seller: inv.seller || null,
    taxiType: inv.taxiType || null,
    checkInDate: inv.checkInDate || null,
    checkOutDate: inv.checkOutDate || null,
    stayPerson: inv.stayPerson || null,
    hasCompanionXml: !!inv.hasCompanionXml,
    hasReceipt: !!inv.hasReceipt,
    fileType: inv.fileType || null
  }
}

export const useHistoryStore = defineStore('history', () => {
  const tasks = ref([])

  /**
   * 获取全部任务列表（按生成时间倒序）
   */
  const allTasks = computed(() => {
    return [...tasks.value].sort((a, b) => {
      return (b.generatedAt || '').localeCompare(a.generatedAt || '')
    })
  })

  /**
   * 从服务端加载当前用户的任务记录
   */
  async function loadTasks() {
    try {
      const res = await apiRequest('/tasks')
      tasks.value = res.tasks || []
    } catch (e) {
      console.error('加载任务记录失败：', e)
    }
  }

  /**
   * 清空本地缓存（登出时调用）
   */
  function reset() {
    tasks.value = []
  }

  /**
   * 保存新任务（本地即时添加到服务端异步持久化）
   */
  function saveTask({ formData, invoices, folderName, excelFileName }) {
    const transportInvoices = invoices.filter(inv => inv.category === '01')
    const getDate = inv => inv.travelDate || inv.issueDate
    const dates = transportInvoices
      .map(getDate)
      .filter(Boolean)
      .sort()

    const tripStartDate = dates.length > 0 ? dates[0] : ''
    const tripEndDate = dates.length > 0 ? dates[dates.length - 1] : ''

    const sanitizedInvoices = invoices.map(sanitizeInvoice)
    const invoiceNos = sanitizedInvoices
      .map(inv => inv.invoiceNo)
      .filter(Boolean)

    const task = {
      id: generateId(),
      tripStartDate,
      tripEndDate,
      projectCode: formData.projectCode || '',
      reason: formData.reason || '',
      totalAmount: formData.totalAmount || 0,
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      submittedAt: '',
      folderName,
      excelFileName,
      formData: {
        projectCode: formData.projectCode || '',
        reason: formData.reason || '',
        agencyFee: formData.agencyFee || 0,
        prepaidAmount: formData.prepaidAmount || 0,
        tripDays: formData.tripDays || 0,
        subsidyPerDay: formData.subsidyPerDay || 0,
        subsidy: formData.subsidy || 0,
        transportTotal: formData.transportTotal || 0,
        taxiStationTotal: formData.taxiStationTotal || 0,
        taxiCityTotal: formData.taxiCityTotal || 0,
        accommodationTotal: formData.accommodationTotal || 0,
        copyBindTotal: formData.copyBindTotal || 0,
        expertReviewTotal: formData.expertReviewTotal || 0,
        officeSuppliesTotal: formData.officeSuppliesTotal || 0,
        mealTotal: formData.mealTotal || 0,
        meetingTotal: formData.meetingTotal || 0,
        expressTotal: formData.expressTotal || 0,
        otherTotal: formData.otherTotal || 0,
        totalAmount: formData.totalAmount || 0,
        transferAmount: formData.transferAmount || 0,
        supplementAmount: formData.supplementAmount || 0,
        refundAmount: formData.refundAmount || 0
      },
      invoices: sanitizedInvoices,
      invoiceNos
    }

    tasks.value.push(task)
    apiRequest('/tasks', { method: 'POST', body: { task } }).catch((e) => {
      console.error('保存任务记录失败：', e)
    })
    return task
  }

  /**
   * 获取单条任务详情
   */
  function getTaskById(id) {
    return tasks.value.find(t => t.id === id) || null
  }

  /**
   * 删除任务
   */
  function deleteTask(id) {
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      tasks.value.splice(idx, 1)
      apiRequest(`/tasks/${id}`, { method: 'DELETE' }).catch((e) => {
        console.error('删除任务记录失败：', e)
      })
    }
  }

  /**
   * 更新任务字段
   */
  function updateTask(id, patch) {
    const task = tasks.value.find(t => t.id === id)
    if (task) {
      Object.assign(task, patch)
      apiRequest(`/tasks/${id}`, { method: 'PUT', body: { patch } }).catch((e) => {
        console.error('更新任务记录失败：', e)
      })
    }
  }

  /**
   * 获取所有历史发票编号集合（用于去重检查）
   */
  function getAllHistoricalInvoiceNos(excludeTaskId) {
    const nos = new Set()
    for (const task of tasks.value) {
      if (excludeTaskId && task.id === excludeTaskId) continue
      for (const no of (task.invoiceNos || [])) {
        nos.add(no)
      }
    }
    return nos
  }

  return {
    tasks,
    allTasks,
    loadTasks,
    reset,
    saveTask,
    getTaskById,
    deleteTask,
    updateTask,
    getAllHistoricalInvoiceNos
  }
})