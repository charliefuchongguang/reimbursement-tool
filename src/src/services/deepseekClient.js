/**
 * 大模型客户端封装
 * 通过自有后端 /api/ai/* 代理调用，统一 API Key 由服务端保管，不下发前端。
 */
import { apiRequest } from './api'

const DEFAULT_MAX_TOKENS = 2048
const DEFAULT_TEMPERATURE = 0.1

/**
 * 根据车次号判断交通工具类型
 */
function getTransportTool(trainNo) {
  if (!trainNo) return '火车'
  const upper = String(trainNo).toUpperCase()
  if (upper.startsWith('G')) return '高铁'
  if (upper.startsWith('D')) return '动车'
  if (upper.startsWith('C')) return '城际'
  return '火车'
}

/**
 * 城市名规范化：去掉站名后缀
 * "北京西" → "北京"，"长沙南" → "长沙"，"广州南站" → "广州"
 */
function normalizeCityName(name) {
  if (!name || typeof name !== 'string') return name
  return name.replace(/(?:南?站|西?站|东?站|北?站|南站|西站|东站|北站|站|南|西|东|北)$/, '')
}

/**
 * 调用后端代理的大模型对话接口
 * @param {string} systemPrompt - 系统提示
 * @param {string|Array} userContent - 用户输入（文本或多模态数组）
 * @param {Object} options - { maxTokens, temperature }
 * @returns {Promise<string>} AI 回复文本
 */
export async function callDeepSeek(systemPrompt, userContent, options = {}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ]
  const res = await apiRequest('/ai/chat', {
    method: 'POST',
    body: {
      messages,
      maxTokens: options.maxTokens || DEFAULT_MAX_TOKENS,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE
    }
  })
  return res.content
}

/**
 * 测试统一 API Key 是否有效（仅管理员）
 * @param {string} [apiKey] - 不传则测试服务端已保存的 Key
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function testApiKey(apiKey) {
  try {
    const res = await apiRequest('/ai/test', {
      method: 'POST',
      body: apiKey ? { apiKey: String(apiKey).trim() } : {}
    })
    return res
  } catch (e) {
    return { success: false, error: e.message || '测试失败' }
  }
}

/**
 * 从 AI 返回内容中提取 JSON
 */
function extractJsonFromAiContent(content) {
  try {
    return JSON.parse(content)
  } catch {
    // 继续
  }

  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1])
    } catch {
      // 继续
    }
  }

  const firstBrace = content.indexOf('{')
  const lastBrace = content.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(content.slice(firstBrace, lastBrace + 1))
    } catch {
      // 放弃
    }
  }

  throw new Error('AI 返回内容无法解析为 JSON')
}

const INVOICE_SYSTEM_PROMPT = `你是一个发票识别助手。请根据提供的发票文本内容，提取以下信息并以JSON格式返回：
{
  "invoiceNo": "发票号码",
  "issueDate": "开票日期(YYYY-MM-DD格式)",
  "travelDate": "实际出行日期(YYYY-MM-DD格式,仅交通类填写,机票/火车票/打车等填写实际乘坐日期,注意机票开票日期往往早于实际出发日期,请区分)",
  "amount": 含税金额(数字),
  "amountExcludeTax": 不含税金额(数字),
  "amountTax": 税额(数字),
  "invoiceType": "电子专票|电子普票|火车票|机票行程单|打车行程单",
  "seller": "销售方名称",
  "remark": "备注内容",
  "category": "交通费|打车费|住宿费|复印装订费|专家评审费|办公用品费|餐饮费|会议费|快递费|其他费用",
  "origin": "出发地(交通/打车类填写)",
  "destination": "到达地(交通/打车类填写)",
  "transportTool": "飞机|高铁|动车|城际|火车|汽车|出租车(交通类填写，G开头高铁,D开头动车,C开头城际)",
  "passenger": "乘客姓名(交通类填写)",
  "flightNo": "航班号(机票填写)",
  "departureTime": "出发时间(HH:mm格式,交通类填写)",
  "trainNo": "车次(火车票填写)",
  "stayPerson": "住宿人(住宿费填写)",
  "checkInDate": "入住日期(住宿费填写)",
  "checkOutDate": "离店日期(住宿费填写)"
}
重要说明：travelDate与issueDate的区别——机票行程单的开票日期(issueDate)是购票日期，实际出行日期(travelDate)是行程单上的乘机日期，两者可能不同；请从行程信息中读取travelDate，不要混用。
只返回JSON，不要其他文字。无法识别的字段填null。`

/**
 * 发票识别专用：将发票文本/XML数据发给AI进行清洗和分类
 */
export async function recognizeInvoice(rawData) {
  let userContent = ''

  if (rawData.xmlData) {
    userContent = `以下是电子发票的XML结构化数据：\n`
    userContent += `文件名：${rawData.fileName || '未知'}\n`
    userContent += `XML数据：\n${JSON.stringify(rawData.xmlData)}\n`
    if (rawData.text) {
      userContent += `\nPDF原文（辅助参考）：\n${rawData.text}`
    }
  } else if (rawData.text) {
    userContent = `以下是发票的文本内容：\n`
    userContent += `文件名：${rawData.fileName || '未知'}\n`
    userContent += `文本内容：\n${rawData.text}`
  } else {
    throw new Error('没有可识别的发票数据')
  }

  let lastError = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const aiContent = await callDeepSeek(INVOICE_SYSTEM_PROMPT, userContent)
      const result = extractJsonFromAiContent(aiContent)

      if (typeof result.invoiceType === 'string') result.invoiceType = result.invoiceType.trim()
      if (typeof result.category === 'string') result.category = result.category.trim()

      if (result.trainNo && (result.transportTool === '火车' || result.transportTool === '高铁' || result.transportTool === '动车' || result.transportTool === '城际')) {
        result.transportTool = getTransportTool(result.trainNo)
      }

      return result
    } catch (e) {
      lastError = e
      if (e.message?.includes('JSON')) {
        console.warn(`发票识别第 ${attempt + 1} 次尝试失败，JSON 解析错误`)
        continue
      }
      throw e
    }
  }

  throw new Error(`发票识别失败：${lastError?.message || '未知错误'}`)
}

// ─── 视觉识别：扫描件/图片型发票 ───

const VISION_SYSTEM_PROMPT = `你是一个发票视觉识别助手。请识别提供的发票/火车票图片，提取信息并以JSON格式返回：
{
  "invoiceType": "火车票|机票行程单|打车行程单|电子专票|电子普票",
  "amount": 金额(数字),
  "amountExcludeTax": 不含税金额(数字,无法判断则null),
  "amountTax": 税额(数字,无法判断则null),
  "issueDate": "开票/购票日期(YYYY-MM-DD)",
  "travelDate": "实际出行日期(YYYY-MM-DD,从行程信息中读取,机票/火车票填写实际乘坐日期,与issueDate不同时以本字段为准)",
  "departureTime": "出发时间(HH:mm)",
  "origin": "出发城市(只保留城市名,去掉站/南/西/东/北等后缀)",
  "destination": "到达城市(只保留城市名,去掉站/南/西/东/北等后缀)",
  "trainNo": "车次号",
  "passenger": "乘客姓名",
  "seatType": "座位等级",
  "transportTool": "高铁|动车|城际|火车|飞机|汽车|出租车(G开头高铁,D开头动车,C开头城际)",
  "category": "交通费|打车费|住宿费|复印装订费|专家评审费|办公用品费|餐饮费|会议费|快递费|其他费用",
  "invoiceNo": "发票号码",
  "seller": "销售方名称",
  "flightNo": "航班号(机票填写)"
}
注意：
1. 城市名只保留城市，如"北京西"→"北京"，"长沙南"→"长沙"，"广州南站"→"广州"。
2. travelDate是实际乘坐/出行日期，issueDate是开票或购票日期，机票两者往往不同，请分别填写。
3. 只返回JSON，不要其他文字。
4. 无法识别的字段填null。`

/**
 * 视觉识别发票（用于扫描件/图片型PDF）
 * @param {string} imageBase64 - 纯 base64 字符串（不含 data URL 前缀）
 */
export async function recognizeInvoiceByVision(imageBase64) {
  const userContent = [
    {
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${imageBase64}` }
    },
    {
      type: 'text',
      text: '请识别这张发票/火车票图片，提取信息并以JSON格式返回。'
    }
  ]

  let lastError = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await callDeepSeek(VISION_SYSTEM_PROMPT, userContent)
      const result = extractJsonFromAiContent(content)

      if (typeof result.invoiceType === 'string') result.invoiceType = result.invoiceType.trim()
      if (typeof result.category === 'string') result.category = result.category.trim()
      result.origin = normalizeCityName(result.origin)
      result.destination = normalizeCityName(result.destination)

      if (result.trainNo && (result.transportTool === '火车' || result.transportTool === '高铁' || result.transportTool === '动车' || result.transportTool === '城际')) {
        result.transportTool = getTransportTool(result.trainNo)
      }

      return result
    } catch (e) {
      lastError = e
      if (e.message?.includes('JSON')) {
        console.warn(`视觉识别第 ${attempt + 1} 次尝试失败，JSON 解析错误`)
        continue
      }
      throw e
    }
  }

  throw new Error(`视觉识别失败：${lastError?.message || '未知错误'}`)
}