import express from 'express'
import { getSetting } from '../db.js'
import { authRequired, adminRequired } from '../middleware/auth.js'

const router = express.Router()

const REQUEST_TIMEOUT = 60000
const MAX_RETRIES = 2
const RETRY_DELAY = 2000

/**
 * 调用统一配置的大模型服务（OpenAI 兼容协议）
 */
async function callLlm({ baseUrl, apiKey, model, messages, maxTokens = 2048, temperature = 0.1 }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false
      }),
      signal: controller.signal
    })

    if (response.status === 401) {
      const err = new Error('统一 API Key 无效或已过期，请联系管理员。')
      err.status = 401
      throw err
    }
    if (response.status === 402) {
      const err = new Error('大模型账户余额不足，请联系管理员。')
      err.status = 402
      throw err
    }
    if (response.status === 429) {
      const err = new Error('请求过于频繁，请稍后再试。')
      err.status = 429
      throw err
    }
    if (response.status >= 500) {
      const err = new Error(`大模型服务异常（${response.status}），请稍后再试。`)
      err.status = response.status
      throw err
    }
    if (!response.ok) {
      let msg = `请求失败（${response.status}）`
      try {
        const data = await response.json()
        if (data?.error?.message) msg = data.error.message
      } catch {
        // ignore
      }
      const err = new Error(msg)
      err.status = response.status
      throw err
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      const err = new Error('AI 返回内容为空，请重试。')
      err.status = 502
      throw err
    }
    return content.trim()
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('请求超时，请检查网络连接后重试。')
      err.status = 504
      throw err
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

function isRetryable(status) {
  return status === 429 || status >= 500
}

/**
 * 代理大模型对话请求（服务端注入统一 Key，不下发前端）
 * body: { messages, model?, maxTokens?, temperature? }
 */
router.post('/chat', authRequired, async (req, res) => {
  const messages = req.body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: '缺少对话消息。' })
  }

  const apiKey = getSetting('llm_api_key') || ''
  if (!apiKey) {
    return res.status(400).json({ message: '管理员尚未配置统一大模型 API Key。' })
  }
  const baseUrl = getSetting('llm_base_url') || 'https://api.deepseek.com'
  const model = req.body?.model || getSetting('llm_model') || 'deepseek-chat'
  const maxTokens = req.body?.maxTokens || 2048
  const temperature = req.body?.temperature ?? 0.1

  let lastError
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const content = await callLlm({ baseUrl, apiKey, model, messages, maxTokens, temperature })
      return res.json({ content })
    } catch (e) {
      lastError = e
      if (attempt < MAX_RETRIES && isRetryable(e.status)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY))
        continue
      }
      break
    }
  }
  const status = lastError?.status && lastError.status >= 400 && lastError.status < 600 ? lastError.status : 502
  res.status(status).json({ message: lastError?.message || '大模型请求失败。' })
})

/**
 * 测试统一 Key 是否可用（管理员）
 * body: { apiKey?, model?, baseUrl? } —— 不传 apiKey 则测试已保存的
 */
router.post('/test', authRequired, adminRequired, async (req, res) => {
  const apiKey = (req.body?.apiKey || getSetting('llm_api_key') || '').trim()
  if (!apiKey) return res.json({ success: false, error: '未配置 API Key' })
  const baseUrl = (req.body?.baseUrl || getSetting('llm_base_url') || 'https://api.deepseek.com').replace(/\/+$/, '')
  const model = req.body?.model || getSetting('llm_model') || 'deepseek-chat'

  try {
    await callLlm({
      baseUrl,
      apiKey,
      model,
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 5,
      temperature: 0
    })
    res.json({ success: true })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

export default router