/**
 * 交通费链路校验服务
 * 校验交通费链路：首张出发地应为北京，末张到达地应为北京
 */

/**
 * 校验交通费链路
 * @param {Array} invoices - 所有发票（会筛选交通费类）
 * @returns {Object} { passed: boolean, issues: Array, chain: Array }
 *   passed: 是否通过
 *   issues: 问题列表 [{ code, severity, msg }]
 *   chain: 按时间排序的交通链路 [{ id, date, origin, destination, tool }]
 */
export function checkTransportChain(invoices) {
  // 1. 筛选 category === '01'（交通费）的发票
  // 2. 按 issueDate 升序排序
  // 3. 构建链路数组 chain
  // 4. 检查首张：origin 是否包含"北京"
  // 5. 检查末张：destination 是否包含"北京"
  // 6. 允许中间段多城市（如 北京→上海→杭州→北京），中间不强制
  // 7. 返回结果

  const transportInvoices = invoices
    .filter(inv => inv.category === '01')
    .sort((a, b) => {
      // 优先用实际出行日期（travelDate）排序，回退到开票日期（issueDate）
      // 机票开票日期往往早于实际出发日期，直接用 issueDate 会导致链路顺序错误
      const dateA = a.travelDate || a.issueDate || ''
      const dateB = b.travelDate || b.issueDate || ''
      return dateA.localeCompare(dateB)
    })

  if (transportInvoices.length === 0) {
    return { passed: true, issues: [], chain: [] }
  }

  const chain = transportInvoices.map(inv => ({
    id: inv.id,
    date: inv.travelDate || inv.issueDate,   // 优先展示实际出行日期
    origin: inv.origin || '未知',
    destination: inv.destination || '未知',
    tool: inv.transportTool || '未知'
  }))

  const issues = []
  const first = chain[0]
  const last = chain[chain.length - 1]

  // 检查首张：出发地是否包含"北京"
  if (!first.origin.includes('北京')) {
    issues.push({
      code: 'transport_chain_start',
      severity: 'warn',
      msg: `交通费链路异常：首段出发地为"${first.origin}"，非北京。请检查是否缺少出发车票。`
    })
  }

  // 检查末张：到达地是否包含"北京"
  if (!last.destination.includes('北京')) {
    issues.push({
      code: 'transport_chain_end',
      severity: 'warn',
      msg: `交通费链路异常：末段到达地为"${last.destination}"，非北京。请检查是否缺少返程车票。`
    })
  }

  return {
    passed: issues.length === 0,
    issues,
    chain
  }
}
