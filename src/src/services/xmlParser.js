/**
 * 解析电子发票 XML 文件
 * 使用浏览器原生 DOMParser，兼容多种国税/地税 XML 格式
 */

/**
 * 从 XML 文档中按多个候选标签名依次查找，返回第一个匹配的文本内容
 * 兼容不同命名空间和标签命名风格
 * @param {Document} doc - DOMParser 解析后的 XML Document
 * @param {string[]} tagNames - 候选标签名列表（按优先级排序）
 * @returns {string} 找到的文本内容，未找到返回空字符串
 */
function getTextByTagNames(doc, tagNames) {
  for (const tag of tagNames) {
    // 先尝试带命名空间查找
    const nsElements = doc.getElementsByTagNameNS('*', tag)
    if (nsElements.length > 0 && nsElements[0].textContent?.trim()) {
      return nsElements[0].textContent.trim()
    }
    // 再尝试普通查找
    const elements = doc.getElementsByTagName(tag)
    if (elements.length > 0 && elements[0].textContent?.trim()) {
      return elements[0].textContent.trim()
    }
  }
  return ''
}

/**
 * 清洗金额字符串：去除中文符号、空格、逗号，转为数字
 * @param {string} str - 原始金额字符串
 * @returns {number} 解析后的数字，解析失败返回 0
 */
function parseAmount(str) {
  if (!str) return 0
  const cleaned = str
    .replace(/[￥¥元，、\s]/g, '')  // 去除货币符号和中文标点
    .replace(/,/g, '')               // 去除千位分隔符
    .replace(/[（(].*?[）)]/g, '')   // 去除括号内容
    .trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * 格式化日期字符串为 YYYY-MM-DD
 * 支持多种输入格式：YYYYMMDD、YYYY年MM月DD日、YYYY-MM-DD 等
 * @param {string} str - 原始日期字符串
 * @returns {string} YYYY-MM-DD 格式日期，解析失败返回原字符串
 */
function formatDate(str) {
  if (!str) return ''
  // 已经是 YYYY-MM-DD 格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  // YYYYMMDD 格式
  const compact = str.replace(/[\s-/年月日]/g, '')
  if (/^\d{8}$/.test(compact)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  }
  // YYYY年MM月DD日 格式
  const m = str.match(/(\d{4})\D*(\d{1,2})\D*(\d{1,2})/)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  return str
}

/**
 * 判断发票类型：根据 XML 中的发票代码或类型标签推断
 * @param {Document} doc - XML Document
 * @returns {string} 发票类型描述
 */
function detectInvoiceType(doc) {
  // 优先从标签直接获取
  const typeFromTag = getTextByTagNames(doc, [
    'InvoiceType', 'FpDm', 'InvoiceTypeName', 'Kplx', 'TypeCode'
  ])
  if (typeFromTag) {
    if (/专/.test(typeFromTag) || /^0[01]/.test(typeFromTag)) return '增值税专用发票'
    if (/普/.test(typeFromTag) || /^0[4-6]/.test(typeFromTag)) return '增值税普通发票'
    if (/电子.*专/.test(typeFromTag)) return '电子专票'
    if (/电子.*普/.test(typeFromTag)) return '电子普票'
    return typeFromTag
  }
  return ''
}

/**
 * 解析发票明细项
 * @param {Document} doc - XML Document
 * @returns {Array<{name: string, amount: number, taxRate: number}>}
 */
function parseItems(doc) {
  const items = []
  // 常见的明细行标签名
  const itemTags = [
    'InvoiceDetail', 'GoodsDetail', 'EInvoiceDetail',
    'FpmxNssb', 'Item', 'Detail', 'Mx'
  ]

  let itemElements = []
  for (const tag of itemTags) {
    const found = doc.getElementsByTagNameNS('*', tag)
    if (found.length > 0) {
      itemElements = Array.from(found)
      break
    }
    const found2 = doc.getElementsByTagName(tag)
    if (found2.length > 0) {
      itemElements = Array.from(found2)
      break
    }
  }

  if (itemElements.length > 0) {
    for (const el of itemElements) {
      const name = getTextFromElement(el, ['ItemName', 'GoodsName', 'SpMc', 'Name', 'ProductName'])
      const amount = parseAmount(getTextFromElement(el, ['Amount', 'Je', 'ItemAmount', 'LineAmount']))
      const taxRateStr = getTextFromElement(el, ['TaxRate', 'Shuilv', 'Sl', 'TaxRateCode'])
      const taxRate = parseFloat(taxRateStr) || 0
      if (name || amount) {
        items.push({ name: name || '未命名项目', amount, taxRate })
      }
    }
  }

  return items
}

/**
 * 从某个 XML 元素内部查找文本（用于明细行子字段）
 * @param {Element} parent - 父元素
 * @param {string[]} tagNames - 候选标签名
 * @returns {string}
 */
function getTextFromElement(parent, tagNames) {
  for (const tag of tagNames) {
    const nsEl = parent.getElementsByTagNameNS('*', tag)
    if (nsEl.length > 0 && nsEl[0].textContent?.trim()) {
      return nsEl[0].textContent.trim()
    }
    const el = parent.getElementsByTagName(tag)
    if (el.length > 0 && el[0].textContent?.trim()) {
      return el[0].textContent.trim()
    }
  }
  return ''
}

/**
 * 解析电子发票 XML 文件
 * @param {string} xmlText - XML 文件的文本内容
 * @returns {Object} 解析后的结构化发票数据
 */
export function parseInvoiceXml(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')

  // 检查 XML 解析错误
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`XML 解析失败：${parseError.textContent?.slice(0, 200) || '格式错误'}`)
  }

  // 提取字段（兼容多种标签命名）
  const invoiceNo = getTextByTagNames(doc, [
    'InvoiceNo', 'FpHm', 'InvoiceNumber', 'EInvoiceNo', 'Fpdm'
  ])
  const invoiceCode = getTextByTagNames(doc, [
    'InvoiceCode', 'FpDm', 'InvoiceCodeNumber', 'EInvoiceCode'
  ])
  const issueDate = formatDate(getTextByTagNames(doc, [
    'InvoiceDate', 'Kprq', 'IssueDate', 'MakeDate', 'BillingDate', 'KpDate'
  ]))
  const amount = parseAmount(getTextByTagNames(doc, [
    'TotalAmount', 'Jshj', 'AmountInFiguers', 'AmountIncludingTax',
    'PriceTax', 'Hjje', 'TotalAmountIncludingTax', 'Jshjxx'
  ]))
  const amountExcludeTax = parseAmount(getTextByTagNames(doc, [
    'AmountWithoutTax', 'Hjje', 'AmountExcludingTax', 'NetAmount',
    'TotalAmountExcludingTax', 'Je', 'HjjeWxz'
  ]))
  const amountTax = parseAmount(getTextByTagNames(doc, [
    'TotalTax', 'Hjse', 'TaxAmount', 'TotalTaxAmount', 'Se'
  ]))
  const seller = getTextByTagNames(doc, [
    'SellerName', 'Xhfmc', 'Seller', 'PayeeName', 'SalesName', 'Xfmc'
  ])
  const buyer = getTextByTagNames(doc, [
    'BuyerName', 'Ghfmc', 'Buyer', 'PurchaserName', 'Gmfmc', 'PayerName'
  ])
  const remark = getTextByTagNames(doc, [
    'Remarks', 'Bz', 'Remark', 'Note', 'Memo'
  ])
  const invoiceType = detectInvoiceType(doc)
  const items = parseItems(doc)

  return {
    invoiceNo,
    invoiceCode,
    issueDate,
    amount,
    amountExcludeTax,
    amountTax,
    seller,
    buyer,
    remark,
    invoiceType,
    items
  }
}
