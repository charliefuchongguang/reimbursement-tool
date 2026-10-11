/**
 * 报销单 Excel 生成服务
 * 基于新模板（长沙报销单）填写数据，保留公式和样式
 */
import ExcelJS from 'exceljs'
import dayjs from 'dayjs'

/**
 * 将数值四舍五入到最多2位小数，避免浮点精度误差
 */
function round2(val) {
  return Math.round((val || 0) * 100) / 100
}

/**
 * 生成报销单 Excel
 * @param {Object} params
 * @param {Object} params.profile - { department, reimburser }
 * @param {Object} params.formData - form store 的全部数据（含计算属性）
 * @param {Array} params.invoices - 分类后的发票数组
 * @returns {Promise<ArrayBuffer>} Excel 文件的 ArrayBuffer
 */
export async function generateExcel(params) {
  const { profile, formData, invoices } = params

  // 1. 加载模板
  const response = await fetch('/template.xlsx')
  const templateBuffer = await response.arrayBuffer()

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(templateBuffer)

  const sheet = workbook.getWorksheet('长沙报销单') || workbook.getWorksheet(1)

  // 2. 填写表头区
  // D3 = 部门
  sheet.getCell('D3').value = profile.department || ''

  // J3 = 当前日期（格式：2026年5月14日）
  const today = dayjs()
  sheet.getCell('J3').value = `${today.year()}年${today.month() + 1}月${today.date()}日`

  // O3 = 代理费及标书款金额
  if (formData.agencyFee > 0) {
    sheet.getCell('O3').value = round2(formData.agencyFee)
  }

  // E4 = 出差人姓名
  sheet.getCell('E4').value = profile.reimburser || ''

  // N5 = 出差事由
  sheet.getCell('N5').value = formData.reason || ''

  // O21 = 出差人姓名（领款人）
  sheet.getCell('O21').value = profile.reimburser || ''

  // 3. 填写交通费明细（第7-16行，最多10条）
  // 排除行程单
  const transportInvoices = invoices
    .filter(inv => inv.category === '01' && isActualInvoice(inv))
    .sort((a, b) => {
      const dateA = a.travelDate || a.issueDate || ''
      const dateB = b.travelDate || b.issueDate || ''
      return dateA.localeCompare(dateB)
    })

  for (let i = 0; i < Math.min(transportInvoices.length, 10); i++) {
    const inv = transportInvoices[i]
    const row = 7 + i

    // B列=出发月, C列=出发日：优先用实际出行日期，机票开票日期≠出发日期
    const dateForRow = inv.travelDate || inv.issueDate
    if (dateForRow) {
      const d = dayjs(dateForRow)
      sheet.getCell(row, 2).value = d.month() + 1   // B列
      sheet.getCell(row, 3).value = d.date()           // C列
    }

    // D列=出发时
    if (inv.departureTime) {
      const hour = parseInt(String(inv.departureTime).split(':')[0], 10)
      if (!isNaN(hour)) {
        sheet.getCell(row, 4).value = hour
      }
    }

    // E列=出发地名
    sheet.getCell(row, 5).value = inv.origin || ''

    // F列=到达月（默认与出发月相同）, G列=到达日（默认与出发日相同）
    if (dateForRow) {
      const d = dayjs(dateForRow)
      sheet.getCell(row, 6).value = d.month() + 1   // F列
      sheet.getCell(row, 7).value = d.date()           // G列
    }

    // H列=到达时
    if (inv.arrivalTime) {
      const hour = parseInt(String(inv.arrivalTime).split(':')[0], 10)
      if (!isNaN(hour)) {
        sheet.getCell(row, 8).value = hour
      }
    }

    // I列=到达地名
    sheet.getCell(row, 9).value = inv.destination || ''

    // J列=交通工具
    sheet.getCell(row, 10).value = inv.transportTool || ''

    // K列=金额
    sheet.getCell(row, 11).value = round2(inv.amount)
  }

  // 4. 填写出差补助区（第7行）
  if (formData.tripDays > 0) {
    sheet.getCell('L7').value = formData.tripDays   // 天数
    sheet.getCell('M7').value = round2(formData.subsidy)     // 补助金额 = tripDays × subsidyPerDay
  }

  // 5. 填写其他费用区（第7-15行，N-P列）
  // N列项目名已预设，只填O列张数和P列金额
  fillOtherExpenseRow(sheet, 7, '02', 'station', invoices)   // 打车费(往返车站)
  fillOtherExpenseRow(sheet, 8, '02', 'city', invoices)      // 打车费(市内)
  fillOtherExpenseRow(sheet, 9, '03', null, invoices)        // 住宿费
  fillOtherExpenseRow(sheet, 10, '04', null, invoices)       // 复印装订费
  fillOtherExpenseRow(sheet, 11, '05', null, invoices)       // 专家评审费
  fillOtherExpenseRow(sheet, 12, '06', null, invoices)       // 办公用品费
  fillOtherExpenseRow(sheet, 13, '07', null, invoices)       // 餐饮费
  fillOtherExpenseRow(sheet, 14, '08', null, invoices)       // 会议费
  fillOtherExpenseRow(sheet, 15, '09', null, invoices)       // 快递费

  // 6. 填写底部结算区
  // N18 = 预借旅费金额（兜底写入0，防止null导致公式比较异常）
  sheet.getCell('N18').value = round2(formData.prepaidAmount) || 0

  // 注意：第17行合计行和第18-20行结算区的其他单元格已有公式，不要覆盖
  // K17=SUM(K7:K16), M17=M7, P17=SUM(P7:P15)
  // E18=大写转换, O19=补领, O20=退还

  // 7. 可选：填入附件张数（总发票张数，排除行程单）
  const totalCount = invoices.filter(inv => isActualInvoice(inv)).length
  if (totalCount > 0) {
    sheet.getCell('Q7').value = totalCount
  }

  // 8. 确保O19/O20公式不被ExcelJS丢失（ExcelJS读写模板后可能清除未显式设置的公式）
  sheet.getCell('O19').value = {
    formula: '"补领金额:￥"&IF(ROUND(K17+M17+P17,2)>IFERROR(N18,0),ROUND(ROUND(K17+M17+P17,2)-IFERROR(N18,0),2),"")'
  }
  sheet.getCell('O20').value = {
    formula: '"退还金额:￥"&IF(ROUND(K17+M17+P17,2)<IFERROR(N18,0),ROUND(IFERROR(N18,0)-ROUND(K17+M17+P17,2),2),"")'
  }

  // 9. 导出
  const buffer = await workbook.xlsx.writeBuffer()
  return buffer
}

/**
 * 填写其他费用行（N列已有名称标签，只填O列张数和P列金额）
 * @param {ExcelJS.Worksheet} sheet
 * @param {number} row - 行号
 * @param {string} categoryId - 类别 ID
 * @param {string|null} taxiType - 打车子类型（'station'|'city'|null）
 * @param {Array} invoices - 发票数组
 */
function fillOtherExpenseRow(sheet, row, categoryId, taxiType, invoices) {
  let filtered
  if (taxiType) {
    filtered = invoices.filter(inv => inv.category === categoryId && inv.taxiType === taxiType && isActualInvoice(inv))
  } else {
    filtered = invoices.filter(inv => inv.category === categoryId && isActualInvoice(inv))
  }

  if (filtered.length > 0) {
    sheet.getCell(row, 15).value = filtered.length  // O列=张数
    sheet.getCell(row, 16).value = round2(filtered.reduce((sum, inv) => sum + (inv.amount || 0), 0))  // P列=金额
  }
}

/**
 * 判断是否为实际计费发票（排除行程单）
 */
function isActualInvoice(inv) {
  const type = (inv.invoiceType || '').trim()
  return !type.includes('行程单')
}
