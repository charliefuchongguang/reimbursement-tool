import express from 'express'
import { getSetting, setSetting } from '../db.js'
import { authRequired, adminRequired } from '../middleware/auth.js'

const router = express.Router()

router.use(authRequired, adminRequired)

/**
 * 读取统一大模型配置（API Key 做掩码处理）
 */
router.get('/llm', (req, res) => {
  const apiKey = getSetting('llm_api_key') || ''
  res.json({
    configured: !!apiKey,
    apiKeyMasked: apiKey ? `****${apiKey.slice(-4)}` : '',
    model: getSetting('llm_model') || '',
    baseUrl: getSetting('llm_base_url') || ''
  })
})

/**
 * 更新统一大模型配置
 */
router.put('/llm', (req, res) => {
  const { apiKey, model, baseUrl } = req.body || {}
  if (apiKey != null) setSetting('llm_api_key', String(apiKey).trim())
  if (model != null) setSetting('llm_model', String(model).trim())
  if (baseUrl != null) setSetting('llm_base_url', String(baseUrl).trim().replace(/\/+$/, ''))
  const key = getSetting('llm_api_key') || ''
  res.json({
    configured: !!key,
    apiKeyMasked: key ? `****${key.slice(-4)}` : '',
    model: getSetting('llm_model') || '',
    baseUrl: getSetting('llm_base_url') || ''
  })
})

export default router