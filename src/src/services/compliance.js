/**
 * 合规性检查服务
 * 依据公司报销规范，对识别出的发票自动检查并给出问题清单
 */

// 预付卡/储值卡关键字
const PREPAID_CARD_KEYWORDS = ['预付卡', '储值卡', '充值卡', '购物卡']

/**
 * 对所有发票执行合规性检查
 * @param {Array} invoices - 识别后的发票数组
 * @param {Array} files - 扫描到的文件列表（用于检查是否有配套文件）
 * @param {Set<string>} [historicalInvoiceNos] - 历史任务中的发票编号集合（用于去重）
 * @returns {Object} { invoiceIssues: Map<id, issues[]>, globalIssues: issues[] }
 */
export function runComplianceCheck(invoices, files = [], historicalInvoiceNos = new Set()) {
  const invoiceIssues = new Map() // 每张发票的问题
  const globalIssues = [] // 全局问题

  for (const inv of invoices) {
    const issues = []

    // 规则1：机票备注检查
    if (inv.category === '01' && inv.transportTool === '飞机') {
      checkFlightRemark(inv, issues)
    }

    // 规则2：住宿费备注检查
    if (inv.category === '03') {
      checkAccommodationRemark(inv, issues)
    }

    // 规则3：住宿水单检查
    if (inv.category === '03') {
      checkAccommodationReceipt(inv, files, issues)
    }

    // 规则4：电子发票完整性（PDF+XML配套，火车票和行程单除外）
    // 对 invoiceType 做 trim 后比较，增强鲁棒性
    const invType = (inv.invoiceType || '').trim()
    const xmlExemptTypes = ['火车票', '打车行程单', '机票行程单', '行程单']
    if (!xmlExemptTypes.includes(invType)) {
      checkElectronicInvoiceCompleteness(inv, issues)
    }

    // 规则5：专票适用性
    checkSpecialInvoiceApplicability(inv, issues)

    // 规则6：专家评审费提醒
    if (inv.category === '05') {
      issues.push({
        code: 'expert_fee_reminder',
        severity: 'info',
        msg: `发票"${inv.invoiceNo || inv.fileName}"：公司转账的专家费需在银行回单后贴上专家签名表`
      })
    }

    // 规则7：预付卡发票检测
    checkPrepaidCard(inv, issues)

    // 规则8：替票检测（通过发票类别与内容不匹配来推测）
    checkSubstituteInvoice(inv, issues)

    // 规则9：发票编号跨任务去重
    if (historicalInvoiceNos.size > 0) {
      checkDuplicateInvoiceNo(inv, historicalInvoiceNos, issues)
    }

    if (issues.length > 0) {
      invoiceIssues.set(inv.id, issues)
    }
  }

  return { invoiceIssues, globalIssues }
}

/**
 * 规则1：机票备注检查
 * 备注栏须包含：乘机人姓名、行程信息、乘机时间、航班号
 * @param {Object} inv - 发票数据
 * @param {Array} issues - 问题数组（就地追加）
 */
function checkFlightRemark(inv, issues) {
  const label = inv.invoiceNo || inv.fileName

  // 检查乘机人
  if (!inv.passenger) {
    issues.push({
      code: 'flight_passenger_missing',
      severity: 'warn',
      msg: `发票"${label}"：机票备注缺少乘机人姓名`
    })
  }

  // 检查航班号
  if (!inv.flightNo) {
    issues.push({
      code: 'flight_no_missing',
      severity: 'warn',
      msg: `发票"${label}"：机票备注缺少航班号`
    })
  }

  // 检查行程信息（出发地+目的地）
  if (!inv.origin) {
    issues.push({
      code: 'flight_origin_missing',
      severity: 'warn',
      msg: `发票"${label}"：机票备注缺少出发地`
    })
  }
  if (!inv.destination) {
    issues.push({
      code: 'flight_destination_missing',
      severity: 'warn',
      msg: `发票"${label}"：机票备注缺少目的地`
    })
  }

  // 检查乘机时间
  if (!inv.issueDate) {
    issues.push({
      code: 'flight_date_missing',
      severity: 'warn',
      msg: `发票"${label}"：机票备注缺少乘机时间`
    })
  }
}

/**
 * 规则2：住宿费备注检查
 * 备注栏须包含：住宿人姓名、入离时间
 * @param {Object} inv - 发票数据
 * @param {Array} issues - 问题数组（就地追加）
 */
function checkAccommodationRemark(inv, issues) {
  const label = inv.invoiceNo || inv.fileName

  // 检查住宿人
  if (!inv.stayPerson) {
    issues.push({
      code: 'stay_person_missing',
      severity: 'warn',
      msg: `发票"${label}"：住宿费备注缺少住宿人姓名`
    })
  }

  // 检查入住日期
  if (!inv.checkInDate) {
    issues.push({
      code: 'checkin_date_missing',
      severity: 'warn',
      msg: `发票"${label}"：住宿费备注缺少入住日期`
    })
  }

  // 检查离店日期
  if (!inv.checkOutDate) {
    issues.push({
      code: 'checkout_date_missing',
      severity: 'warn',
      msg: `发票"${label}"：住宿费备注缺少离店日期`
    })
  }
}

/**
 * 规则3：住宿水单检查
 * 检查是否有配套的住宿水单/账单明细文件
 * @param {Object} inv - 发票数据
 * @param {Array} files - 扫描到的文件列表
 * @param {Array} issues - 问题数组（就地追加）
 */
function checkAccommodationReceipt(inv, files, issues) {
  const label = inv.invoiceNo || inv.fileName

  // 方式1：检查发票对象是否标记了配套水单
  if (inv.hasReceipt || inv.pairedWith) {
    return // 已有水单标记，通过
  }

  // 方式2：在文件列表中搜索水单/账单相关文件
  // 查找与该发票同目录下是否有"水单"或"账单"相关文件
  const receiptKeywords = ['水单', '账单', '明细', '消费清单']
  const invDir = inv.filePath ? inv.filePath.replace(/[/\\][^/\\]+$/, '') : ''

  const hasReceiptFile = files.some(file => {
    // 文件名中包含水单关键字
    const nameMatch = receiptKeywords.some(kw => (file.name || '').includes(kw))
    if (!nameMatch) return false
    // 如果发票有路径，则要求同目录；否则只要名称匹配即可
    if (invDir && file.path) {
      return file.path.startsWith(invDir)
    }
    return true
  })

  if (!hasReceiptFile) {
    issues.push({
      code: 'accommodation_receipt_missing',
      severity: 'warn',
      msg: `发票"${label}"：住宿费缺少水单/账单明细，请补充`
    })
  }
}

/**
 * 规则4：电子发票完整性检查
 * 除火车票外，每张 PDF 必须配套 XML
 * @param {Object} inv - 发票数据
 * @param {Array} issues - 问题数组（就地追加）
 */
function checkElectronicInvoiceCompleteness(inv, issues) {
  const label = inv.invoiceNo || inv.fileName

  // 如果有配套 XML 标记，则通过
  if (inv.hasCompanionXml || inv.companionFileHandle || inv.pairedWith || inv.companionFileName) {
    return
  }

  // 如果发票来源为纯 PDF 且没有 XML 配套，则提示
  if (inv.fileType === 'pdf' || inv.fileName?.toLowerCase().endsWith('.pdf')) {
    issues.push({
      code: 'electronic_invoice_xml_missing',
      severity: 'warn',
      msg: `发票"${label}"：电子发票缺少配套 XML 文件，请补充`
    })
  }
}

/**
 * 规则5：专票适用性检查
 * 餐饮费/礼品费/替票之外的类别，若开成普票则提示「建议改开专票」
 * @param {Object} inv - 发票数据
 * @param {Array} issues - 问题数组（就地追加）
 */
function checkSpecialInvoiceApplicability(inv, issues) {
  const label = inv.invoiceNo || inv.fileName

  // 餐饮费(07)用普票是正常的，不需要提示
  const excludedCategories = ['07'] // 餐饮费
  if (excludedCategories.includes(inv.category)) {
    return
  }

  // 检查是否为电子普票
  if (inv.invoiceType === '电子普票') {
    issues.push({
      code: 'special_invoice_suggestion',
      severity: 'info',
      msg: `发票"${label}"：当前为电子普票，建议改开专票（可抵税）`
    })
  }
}

/**
 * 规则7：预付卡发票检测
 * 识别到预付卡/储值卡发票则警告
 * @param {Object} inv - 发票数据
 * @param {Array} issues - 问题数组（就地追加）
 */
function checkPrepaidCard(inv, issues) {
  const label = inv.invoiceNo || inv.fileName

  // 检查销售方名称
  const sellerMatch = inv.seller && PREPAID_CARD_KEYWORDS.some(kw => inv.seller.includes(kw))

  // 检查商品明细
  const itemsMatch = inv.items && inv.items.some(item =>
    PREPAID_CARD_KEYWORDS.some(kw =>
      (item.name || '').includes(kw) || (item.itemName || '').includes(kw)
    )
  )

  // 检查备注
  const remarkMatch = inv.remark && PREPAID_CARD_KEYWORDS.some(kw => inv.remark.includes(kw))

  if (sellerMatch || itemsMatch || remarkMatch) {
    issues.push({
      code: 'prepaid_card_detected',
      severity: 'warn',
      msg: `发票"${label}"：检测到预付卡/储值卡发票，会额外代扣 20% 个税，建议避免`
    })
  }
}

/**
 * 规则8：替票检测
 * 通过发票类别与内容不匹配来推测
 * @param {Object} inv - 发票数据
 * @param {Array} issues - 问题数组（就地追加）
 */
function checkSubstituteInvoice(inv, issues) {
  const label = inv.invoiceNo || inv.fileName

  // 替票推测规则：
  // 1. 销售方是办公用品店但类别不是办公用品费(06)或复印装订费(04)
  // 2. 销售方是超市但类别不是办公用品费(06)
  const officeKeywords = ['办公用品', '文具', '办公设备']
  const supermarketKeywords = ['超市', '商场', '百货']

  const isOfficeSeller = inv.seller && officeKeywords.some(kw => inv.seller.includes(kw))
  const isSupermarketSeller = inv.seller && supermarketKeywords.some(kw => inv.seller.includes(kw))

  if (isOfficeSeller && !['04', '06'].includes(inv.category)) {
    issues.push({
      code: 'substitute_invoice_suspected',
      severity: 'info',
      msg: `发票"${label}"：销售方为办公用品类，但分类为"${inv.category}"，疑似替票。如确为替票，需另附说明表备注实际费用`
    })
  }

  if (isSupermarketSeller && !['06'].includes(inv.category)) {
    issues.push({
      code: 'substitute_invoice_suspected',
      severity: 'info',
      msg: `发票"${label}"：销售方为超市类，但分类为"${inv.category}"，疑似替票。如确为替票，需另附说明表备注实际费用`
    })
  }
}

/**
 * 规则9：发票编号跨任务去重检查
 * 检查当前发票编号是否已在历史报销记录中出现过
 * @param {Object} inv - 发票数据
 * @param {Set<string>} historicalInvoiceNos - 历史任务中的发票编号集合
 * @param {Array} issues - 问题数组（就地追加）
 */
function checkDuplicateInvoiceNo(inv, historicalInvoiceNos, issues) {
  if (!inv.invoiceNo) return
  if (historicalInvoiceNos.has(inv.invoiceNo)) {
    issues.push({
      code: 'duplicate_invoice_no',
      severity: 'warn',
      msg: `发票"${inv.invoiceNo}"：该发票编号在历史报销记录中已存在，疑似重复报销`
    })
  }
}
