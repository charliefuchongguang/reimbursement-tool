import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { useSessionStore } from './session'
import { DEFAULT_SUBSIDY_PER_DAY } from '@/utils/constants'

export const useFormStore = defineStore('form', () => {
  // ─── 可编辑字段 ───
  const projectCode = ref('')
  const reason = ref('')
  const reimburseDate = ref('')
  const agencyFee = ref(0)
  const prepaidAmount = ref(0)
  const subsidyPerDay = ref(DEFAULT_SUBSIDY_PER_DAY)

  // ─── 计算属性：出差天数 ───
  // 按出差段分段计算：出京-回京配对，每段含首尾，多段累加
  const tripDays = computed(() => {
    const session = useSessionStore()
    // 篩选交通费发票（category === '01'），排除行程单
    const transportInvoices = session.invoices.filter(
      inv => inv.category === '01' && isActualInvoice(inv)
    )
    if (transportInvoices.length === 0) return 1

    // 优先使用 travelDate（实际出行日期），回退到 issueDate（开票日期）
    // 机票的开票日期往往早于出发日期，必须用 travelDate 才能正确排序和计算段落
    const getDate = (inv) => inv.travelDate || inv.issueDate

    // 按实际出行日期排序，只保留有 origin/destination 信息的发票
    const sorted = [...transportInvoices]
      .filter(inv => getDate(inv) && (inv.origin || inv.destination))
      .sort((a, b) => getDate(a).localeCompare(getDate(b)))

    // 如果没有 origin/destination 信息，fallback 到最早~最晚
    if (sorted.length === 0) {
      return fallbackDays(transportInvoices)
    }

    // 识别出差段：出京(origin含"北京")为段起点，回京(destination含"北京")为段终点
    const segments = []
    let currentStart = null // 当前段起点日期

    for (const inv of sorted) {
      const invDate = getDate(inv)
      const isLeavingBeijing = inv.origin && inv.origin.includes('北京')
      const isReturningBeijing = inv.destination && inv.destination.includes('北京')

      if (isLeavingBeijing && !isReturningBeijing) {
        // 出京：新段起点
        if (currentStart !== null) {
          // 前一段没有回京配对，用当前发票日期前一天作为前一段终点
          segments.push({
            start: currentStart,
            end: dayjs(invDate).subtract(1, 'day')
          })
        }
        currentStart = dayjs(invDate)
      } else if (isReturningBeijing && !isLeavingBeijing) {
        // 回京：当前段终点
        if (currentStart !== null) {
          segments.push({
            start: currentStart,
            end: dayjs(invDate)
          })
          currentStart = null
        }
        // 如果没有配对的出京，忽略这条回京发票
      }
      // 既不是出京也不是回京（如长沙→武汉），跳过
    }

    // 如果最后一段只有出京没有回京（还没回来），用最晚出行日期作为段终点
    if (currentStart !== null) {
      const allDates = transportInvoices
        .map(inv => getDate(inv))
        .filter(Boolean)
        .sort()
      const latestDate = allDates.length > 0 ? dayjs(allDates[allDates.length - 1]) : currentStart
      segments.push({ start: currentStart, end: latestDate })
    }

    // 如果无法形成任何配对，fallback 到最早~最晚
    if (segments.length === 0) {
      return fallbackDays(transportInvoices)
    }

    // 每段天数 = 终点日期 - 起点日期 + 1（含首尾），总天数 = 各段之和
    const totalDays = segments.reduce((sum, seg) => {
      const days = seg.end.diff(seg.start, 'day') + 1
      return sum + Math.max(days, 1)
    }, 0)

    return totalDays
  })

  // ─── Fallback：最早~最晚日期计算天数 ───
  function fallbackDays(invoices) {
    const getDate = (inv) => inv.travelDate || inv.issueDate
    const dates = invoices
      .map(inv => getDate(inv))
      .filter(Boolean)
      .sort()
    if (dates.length < 2) return 1
    return dayjs(dates[dates.length - 1]).diff(dayjs(dates[0]), 'day') + 1
  }

  // ─── 计算属性：出差补助 = 出差天数 × 补助标准（用户可输入） ───
  const subsidy = computed(() => tripDays.value * subsidyPerDay.value)

  // ─── 辅助函数：判断是否为实际计费发票（排除行程单） ───
  function isActualInvoice(inv) {
    const type = (inv.invoiceType || '').trim()
    return !type.includes('行程单')
  }

  // ─── 各类费用汇总（从 session.invoices 计算，排除行程单） ───
  const transportTotal = computed(() => {
    const session = useSessionStore()
    return round2(session.invoices
      .filter(inv => inv.category === '01' && isActualInvoice(inv))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0))
  })

  const taxiStationTotal = computed(() => {
    const session = useSessionStore()
    return round2(session.invoices
      .filter(inv => inv.category === '02' && inv.taxiType === 'station' && isActualInvoice(inv))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0))
  })

  const taxiCityTotal = computed(() => {
    const session = useSessionStore()
    return round2(session.invoices
      .filter(inv => inv.category === '02' && inv.taxiType === 'city' && isActualInvoice(inv))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0))
  })

  const accommodationTotal = computed(() => {
    const session = useSessionStore()
    return round2(session.invoices
      .filter(inv => inv.category === '03' && isActualInvoice(inv))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0))
  })

  const copyBindTotal = computed(() => {
    const session = useSessionStore()
    return round2(session.invoices
      .filter(inv => inv.category === '04' && isActualInvoice(inv))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0))
  })

  const expertReviewTotal = computed(() => {
    const session = useSessionStore()
    return round2(session.invoices
      .filter(inv => inv.category === '05' && isActualInvoice(inv))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0))
  })

  const officeSuppliesTotal = computed(() => {
    const session = useSessionStore()
    return round2(session.invoices
      .filter(inv => inv.category === '06' && isActualInvoice(inv))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0))
  })

  const mealTotal = computed(() => {
    const session = useSessionStore()
    return round2(session.invoices
      .filter(inv => inv.category === '07' && isActualInvoice(inv))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0))
  })

  const meetingTotal = computed(() => {
    const session = useSessionStore()
    return round2(session.invoices
      .filter(inv => inv.category === '08' && isActualInvoice(inv))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0))
  })

  const expressTotal = computed(() => {
    const session = useSessionStore()
    return round2(session.invoices
      .filter(inv => inv.category === '09' && isActualInvoice(inv))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0))
  })

  const otherTotal = computed(() => {
    const session = useSessionStore()
    return round2(session.invoices
      .filter(inv => inv.category === '10' && isActualInvoice(inv))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0))
  })

  // ─── 报销总额 ───
  const totalAmount = computed(() => {
    return round2(
      transportTotal.value +
      taxiStationTotal.value +
      taxiCityTotal.value +
      accommodationTotal.value +
      copyBindTotal.value +
      expertReviewTotal.value +
      officeSuppliesTotal.value +
      mealTotal.value +
      meetingTotal.value +
      expressTotal.value +
      otherTotal.value +
      subsidy.value +
      agencyFee.value
    )
  })

  // ─── 转账金额 = 报销总额 ───
  const transferAmount = computed(() => totalAmount.value)

  // ─── 补领金额 = max(报销总额 - 预借旅费, 0) ───
  const supplementAmount = computed(() => {
    return round2(Math.max(totalAmount.value - prepaidAmount.value, 0))
  })

  // ─── 退还金额 = max(预借旅费 - 报销总额, 0) ───
  const refundAmount = computed(() => {
    return round2(Math.max(prepaidAmount.value - totalAmount.value, 0))
  })

  // ─── 工具函数：四舍五入到2位小数 ───
  function round2(num) {
    return Math.round(num * 100) / 100
  }

  // ─── 重置表单 ───
  const resetForm = () => {
    projectCode.value = ''
    reason.value = ''
    reimburseDate.value = ''
    agencyFee.value = 0
    prepaidAmount.value = 0
    subsidyPerDay.value = DEFAULT_SUBSIDY_PER_DAY
  }

  return {
    // 可编辑字段
    projectCode,
    reason,
    reimburseDate,
    agencyFee,
    prepaidAmount,
    subsidyPerDay,
    // 计算属性
    tripDays,
    subsidy,
    transportTotal,
    taxiStationTotal,
    taxiCityTotal,
    accommodationTotal,
    copyBindTotal,
    expertReviewTotal,
    officeSuppliesTotal,
    mealTotal,
    meetingTotal,
    expressTotal,
    otherTotal,
    totalAmount,
    transferAmount,
    supplementAmount,
    refundAmount,
    // 方法
    resetForm
  }
})
