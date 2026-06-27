/**
 * DeepSeek API 客户端封装
 * 用于发票信息提取与分类
 */
import { useSettingsStore } from '../stores/settings'

const API_URL = 'https://api.deepseek.com/chat/completions'
const DEFAULT_MAX_TOKENS = 2048
const DEFAULT_TEMPERATURE = 0.1
const REQUEST_TIMEOUT = 30000        // 30秒超时（文本识别）
const VISION_REQUEST_TIMEOUT = 45000  // 45秒超时（视觉识别）
const MAX_RETRIES = 2                // 最大重试次数
const RETRY_DELAY = 2000             // 重试等待时间（毫秒）

/**
 * 带超时的 fetch 请求
 * @param {string} url - 请求地址
 * @param {RequestInit} options - fetch 参数
 * @param {number} timeout - 超时毫秒数
 * @returns {Promise<Response>}
 */
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
 * @param {string} name - 原始站名/城市名
 * @returns {string} 规范化后的城市名
 */
function normalizeCityName(name) {
  if (!name || typeof name !== 'string') return name
  // 去掉末尾的 站/南/西/东/北 及其组合（如 南站、西站）
  return name.replace(/(?:南?站|西?站|东?站|北?站|南站|西站|东站|北站|站|南|西|东|北)$/, '')
}

async function fetchWithTimeout(url, options, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    return response
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 调用 DeepSeek API
 * @param {string} systemPrompt - 系统提示
 * @param {string} userContent - 用户输入内容
 * @param {Object} options - 可选配置 { maxTokens, temperature }
 * @param {number} [retryCount=0] - 当前重试次数（内部使用）
 * @returns {Promise<string>} AI 回复的文本内容
 */
export async function callDeepSeek(systemPrompt, userContent, options = {}, retryCount = 0) {
  const settings = useSettingsStore()
  const apiKey = settings.deepseekApiKey

  if (!apiKey) {
    throw new Error('未配置 DeepSeek API Key，请在设置中填写。')
  }

  const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    max_tokens: maxTokens,
    temperature,
    stream: false
  }

  try {
    const response = await fetchWithTimeout(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    // 401 - API Key 无效
    if (response.status === 401) {
      throw new Error('API Key 无效或已过期，请检查设置。')
    }

    // 402 - 余额不足
    if (response.status === 402) {
      throw new Error('DeepSeek 账户余额不足，请充值后重试。')
    }

    // 429 - QPS 超限，自动重试
    if (response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
        return callDeepSeek(systemPrompt, userContent, options, retryCount + 1)
      }
      throw new Error('请求过于频繁，请稍后再试。')
    }

    // 500+ 服务器错误
    if (response.status >= 500) {
      if (retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
        return callDeepSeek(systemPrompt, userContent, options, retryCount + 1)
      }
      throw new Error(`DeepSeek 服务异常（${response.status}），请稍后再试。`)
    }

    // 其他非 2xx 错误
    if (!response.ok) {
      let errorMsg = `请求失败（${response.status}）`
      try {
        const errData = await response.json()
        if (errData?.error?.message) {
          errorMsg = errData.error.message
        }
      } catch {
        // 忽略 JSON 解析失败
      }
      throw new Error(errorMsg)
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('AI 返回内容为空，请重试。')
    }
    return content.trim()
  } catch (e) {
    // 超时 / 网络中断
    if (e.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接后重试。')
    }
    // 已经是友好错误信息，直接抛出
    if (e.message && !e.message.includes('fetch')) {
      throw e
    }
    throw new Error('网络连接失败，请检查网络后重试。')
  }
}

/**
 * 测试 API Key 是否有效
 * @param {string} apiKey - 要测试的 Key
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function testApiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'API Key 不能为空' }
  }

  try {
    const response = await fetchWithTimeout(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false
      })
    })

    if (response.status === 401) {
      return { success: false, error: 'API Key 无效或已过期' }
    }
    if (response.status === 402) {
      return { success: false, error: '账户余额不足' }
    }
    if (response.ok) {
      return { success: true }
    }
    return { success: false, error: `验证失败（${response.status}）` }
  } catch (e) {
    if (e.name === 'AbortError') {
      return { success: false, error: '网络连接超时' }
    }
    return { success: false, error: '网络连接失败' }
  }
}

/**
 * 从 AI 返回内容中提取 JSON
 * 处理可能的 markdown 代码块包裹（```json ... ```）
 * @param {string} content - AI 返回的原始文本
 * @returns {Object} 解析后的 JSON 对象
 */
function extractJsonFromAiContent(content) {
  // 尝试直接解析
  try {
    return JSON.parse(content)
  } catch {
    // 继续
  }

  // 尝试从 markdown 代码块中提取
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1])
    } catch {
      // 继续
    }
  }

  // 尝试找到第一个 { 到最后一个 } 之间的内容
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
 * @param {Object} rawData - { text, xmlData, fileName }
 * @returns {Promise<Object>} 清洗后的结构化发票数据
 */
export async function recognizeInvoice(rawData) {
  let userContent = ''

  if (rawData.xmlData) {
    // 优先使用 XML 结构化数据
    userContent = `以下是电子发票的XML结构化数据：\n`
    userContent += `文件名：${rawData.fileName || '未知'}\n`
    userContent += `XML数据：\n${JSON.stringify(rawData.xmlData)}\n`
    if (rawData.text) {
      userContent += `\nPDF原文（辅助参考）：\n${rawData.text}`
    }
  } else if (rawData.text) {
    // 仅文本
    userContent = `以下是发票的文本内容：\n`
    userContent += `文件名：${rawData.fileName || '未知'}\n`
    userContent += `文本内容：\n${rawData.text}`
  } else {
    throw new Error('没有可识别的发票数据')
  }

  let lastError = null

  // 最多尝试 2 次（首次 + 1 次重试）
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const aiContent = await callDeepSeek(INVOICE_SYSTEM_PROMPT, userContent)
      const result = extractJsonFromAiContent(aiContent)

      // 规范化后处理：对关键字段做 trim，避免空格/格式问题导致后续匹配失败
      if (typeof result.invoiceType === 'string') result.invoiceType = result.invoiceType.trim()
      if (typeof result.category === 'string') result.category = result.category.trim()

      // 根据车次号修正交通工具类型
      if (result.trainNo && (result.transportTool === '火车' || result.transportTool === '高铁' || result.transportTool === '动车' || result.transportTool === '城际')) {
        result.transportTool = getTransportTool(result.trainNo)
      }

      return result
    } catch (e) {
      lastError = e
      // 仅在 JSON 解析失败时重试，其他错误直接抛出
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
 * 将PDF渲染的图片发送给DeepSeek视觉模型进行识别
 * @param {string} imageBase64 - 纯base64字符串（不含data URL前缀）
 * @returns {Promise<Object>} 识别后的结构化发票数据
 */
export async function recognizeInvoiceByVision(imageBase64) {
  const settings = useSettingsStore()
  const apiKey = settings.deepseekApiKey

  if (!apiKey) {
    throw new Error('未配置 DeepSeek API Key，请在设置中填写。')
  }

  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: VISION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${imageBase64}`
            }
          },
          {
            type: 'text',
            text: '请识别这张发票/火车票图片，提取信息并以JSON格式返回。'
          }
        ]
      }
    ],
    max_tokens: DEFAULT_MAX_TOKENS,
    temperature: DEFAULT_TEMPERATURE,
    stream: false
  }

  let lastError = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchWithTimeout(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      }, VISION_REQUEST_TIMEOUT)

      // 错误处理（与 callDeepSeek 保持一致）
      if (response.status === 401) {
        throw new Error('API Key 无效或已过期，请检查设置。')
      }
      if (response.status === 402) {
        throw new Error('DeepSeek 账户余额不足，请充值后重试。')
      }
      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
          continue
        }
        throw new Error('请求过于频繁，请稍后再试。')
      }
      if (response.status >= 500) {
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
          continue
        }
        throw new Error(`DeepSeek 服务异常（${response.status}），请稍后再试。`)
      }
      if (!response.ok) {
        let errorMsg = `请求失败（${response.status}）`
        try {
          const errData = await response.json()
          if (errData?.error?.message) errorMsg = errData.error.message
        } catch { /* ignore */ }
        throw new Error(errorMsg)
      }

      const data = await response.json()
      const content = data?.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('AI 返回内容为空，请重试。')
      }

      const result = extractJsonFromAiContent(content.trim())

      // 规范化后处理
      if (typeof result.invoiceType === 'string') result.invoiceType = result.invoiceType.trim()
      if (typeof result.category === 'string') result.category = result.category.trim()
      // 城市名规范化
      result.origin = normalizeCityName(result.origin)
      result.destination = normalizeCityName(result.destination)

      // 根据车次号修正交通工具类型
      if (result.trainNo && (result.transportTool === '火车' || result.transportTool === '高铁' || result.transportTool === '动车' || result.transportTool === '城际')) {
        result.transportTool = getTransportTool(result.trainNo)
      }

      return result
    } catch (e) {
      lastError = e
      if (e.name === 'AbortError') {
        throw new Error('视觉识别请求超时，请检查网络连接后重试。')
      }
      if (e.message?.includes('JSON')) {
        console.warn(`视觉识别第 ${attempt + 1} 次尝试失败，JSON 解析错误`)
        continue
      }
      throw e
    }
  }

  throw new Error(`视觉识别失败：${lastError?.message || '未知错误'}`)
}
