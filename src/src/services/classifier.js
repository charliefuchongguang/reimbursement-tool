/**
 * 发票分类服务
 * 根据 AI 识别结果对发票进行分类和二次校验
 */
import { CATEGORIES, STATION_KEYWORDS } from '../utils/constants'

// invoiceType 到 category 的映射关系
const INVOICE_TYPE_CATEGORY_MAP = {
  '火车票': '01',       // 交通费
  '机票行程单': '01',   // 交通费
  '打车行程单': '02'    // 打车费
}

// invoiceType 中包含关键字时的模糊匹配
const INVOICE_TYPE_KEYWORD_MAP = [
  { keyword: '机票', categoryId: '01' },
  { keyword: '火车', categoryId: '01' },
  { keyword: '打车', categoryId: '02' },
  { keyword: '出租', categoryId: '02' },
  { keyword: '滴滴', categoryId: '02' }
]

/**
 * 根据 AI 识别结果确定发票最终分类
 * @param {Object} invoice - 识别后的发票数据对象
 * @returns {string} 类别 ID，如 '01'、'02' 等
 */
export function classifyInvoice(invoice) {
  // 第一步（最高优先级）：根据 invoiceType 精确匹配
  // invoiceType 是 AI 对发票类型的直接判断（火车票、机票行程单等），
  // 可靠性高于 category 字段，因此优先使用
  if (invoice.invoiceType) {
    const trimmedType = invoice.invoiceType.trim()

    // 精确匹配：火车票→01, 机票行程单→01, 打车行程单→02
    const exactMatch = INVOICE_TYPE_CATEGORY_MAP[trimmedType]
    if (exactMatch) return exactMatch

    // 模糊匹配：invoiceType 包含关键字
    for (const rule of INVOICE_TYPE_KEYWORD_MAP) {
      if (trimmedType.includes(rule.keyword)) {
        return rule.categoryId
      }
    }
  }

  // 第二步：invoiceType 无精确匹配时，fallback 到 category 字段
  if (invoice.category) {
    const trimmedCategory = invoice.category.trim()
    // AI 返回的是中文名称（如"交通费"），尝试匹配
    const byName = CATEGORIES.find(c => c.name === trimmedCategory)
    if (byName) return byName.id

    // AI 返回的可能是 ID（如"01"），尝试匹配
    const byId = CATEGORIES.find(c => c.id === trimmedCategory)
    if (byId) return byId.id
  }

  // 第三步：无法匹配 → 其他费用(10)
  return '10'
}

/**
 * 打车费子分类：往返车站 vs 市内
 * @param {Object} invoice - 含 origin/destination 的发票数据
 * @returns {'station' | 'city'}
 */
export function classifyTaxiType(invoice) {
  // 判断逻辑（按PRD优先级）：
  // 1. 优先看行程单的起点/终点
  // 2. 起点或终点包含 STATION_KEYWORDS 中任意关键字 → 'station'（往返车站）
  // 3. 起终点都不含车站关键字 → 'city'（市内）
  // 4. 行程单混合多段（既有车站也有市内）→ 'city'
  // 5. 没有行程单的纯发票 → 'city'（兜底）

  const { origin, destination } = invoice
  if (!origin && !destination) return 'city' // 无信息，兜底市内

  const hasStationKeyword = (text) => {
    if (!text) return false
    return STATION_KEYWORDS.some(kw => text.includes(kw))
  }

  if (hasStationKeyword(origin) || hasStationKeyword(destination)) {
    return 'station'
  }
  return 'city'
}

/**
 * 批量分类所有发票
 * @param {Array} invoices - 发票数组
 * @returns {Array} 带 category 和 taxiType 的发票数组
 */
export function classifyAll(invoices) {
  return invoices.map(inv => {
    const category = classifyInvoice(inv)
    const taxiType = category === '02' ? classifyTaxiType(inv) : null
    return { ...inv, category, taxiType }
  })
}
