import JSZip from 'jszip'

/**
 * 解析OFD文件，提取结构化发票数据
 * @param {ArrayBuffer} arrayBuffer - OFD文件的ArrayBuffer
 * @returns {Object} 解析后的发票数据对象
 */
export async function parseOfd(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)

  // 查找Attachs目录下的rai_issuer_*.xml文件
  let invoiceXmlContent = null
  for (const [path, file] of Object.entries(zip.files)) {
    if (path.includes('Attachs/') && path.includes('rai_issuer_') && path.endsWith('.xml')) {
      invoiceXmlContent = await file.async('string')
      break
    }
  }

  if (!invoiceXmlContent) {
    // 尝试其他可能的附件XML路径
    for (const [path, file] of Object.entries(zip.files)) {
      if (path.includes('Attachs/') && path.endsWith('.xml') && !path.includes('Attachments.xml')) {
        invoiceXmlContent = await file.async('string')
        break
      }
    }
  }

  if (!invoiceXmlContent) {
    throw new Error('OFD文件中未找到发票数据XML')
  }

  return parseRailwayInvoiceXml(invoiceXmlContent)
}

/**
 * 解析铁路电子客票XBRL格式XML
 */
function parseRailwayInvoiceXml(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')

  // 通用取值函数，兼容有无命名空间前缀
  function getText(tagName) {
    // 尝试带rai前缀
    let el = doc.getElementsByTagName(`rai:${tagName}`)[0]
    if (!el) el = doc.getElementsByTagName(tagName)[0]
    // 也尝试其他可能的前缀
    if (!el) el = doc.querySelector(`[*|${tagName}]`)
    return el ? el.textContent.trim() : ''
  }

  const origin = normalizeCityName(getText('DepartureStation'))
  const destination = normalizeCityName(getText('DestinationStation'))
  const fare = parseFloat(getText('Fare')) || 0
  const travelDate = getText('TravelDate')
  const issueDate = getText('DateOfIssue') || travelDate
  const departureTime = getText('DepartureTime')
  const trainNo = getText('TrainNumber')
  const passenger = getText('Name')
  const seatType = getText('SeatLevel')
  const invoiceNo = getText('ElectronicInvoiceRailwayETicketNumber')
  const amountExcludeTax = parseFloat(getText('TotalAmountExcludingTax')) || 0
  const taxAmount = parseFloat(getText('TaxAmount')) || 0

  return {
    invoiceType: '火车票',
    invoiceNo,
    issueDate: travelDate || issueDate,  // 优先使用乘车日期
    departureTime,
    origin,
    destination,
    trainNo,
    passenger,
    seatType,
    transportTool: getTransportTool(trainNo),
    amount: fare,
    amountExcludeTax,
    amountTax: taxAmount,
    category: '01', // 交通费
    // 标记为OFD解析，非AI识别
    recognitionSource: 'ofd'
  }
}

/**
 * 根据车次号判断交通工具类型
 */
function getTransportTool(trainNo) {
  if (!trainNo) return '火车'
  const upper = trainNo.toUpperCase()
  if (upper.startsWith('G')) return '高铁'
  if (upper.startsWith('D')) return '动车'
  if (upper.startsWith('C')) return '城际'
  return '火车'
}

/**
 * 城市名规范化：去掉站名后缀
 */
function normalizeCityName(stationName) {
  if (!stationName) return ''
  // 去掉常见后缀：南站、北站、西站、东站、南、北、西、东、站
  return stationName
    .replace(/(南站|北站|西站|东站|站)$/, '')
    .replace(/(南|北|西|东)$/, '')
    .trim()
}
