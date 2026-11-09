import express from 'express'
import { getSetting, setSetting, db } from '../db.js'
import { hashPassword } from '../utils/password.js'
import { authRequired, adminRequired } from '../middleware/auth.js'

const router = express.Router()

router.use(authRequired, adminRequired)

/**
 * 已注册账号列表（管理员）
 */
router.get('/users', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, phone, nickname, role, must_change_password, department, reimburser, created_at
       FROM users ORDER BY id ASC`
    )
    .all()

  // 各用户执行（保存）的任务数
  const taskCounts = new Map(
    db.prepare('SELECT user_id, COUNT(*) AS c FROM tasks GROUP BY user_id').all()
      .map((r) => [r.user_id, r.c])
  )

  res.json({
    users: rows.map((u) => ({
      id: u.id,
      phone: u.phone,
      nickname: u.nickname,
      role: u.role,
      mustChangePassword: !!u.must_change_password,
      department: u.department || '',
      reimburser: u.reimburser || '',
      createdAt: u.created_at,
      taskCount: taskCounts.get(u.id) || 0
    }))
  })
})

/**
 * 管理员协助修改某用户的密码
 */
router.put('/users/:id/password', (req, res) => {
  const id = Number(req.params.id)
  const password = String(req.body?.password || '')
  if (!Number.isInteger(id)) return res.status(400).json({ message: '用户 ID 无效。' })
  if (password.length < 6) return res.status(400).json({ message: '密码至少 6 位。' })

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id)
  if (!user) return res.status(404).json({ message: '用户不存在。' })

  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(
    hashPassword(password),
    id
  )
  res.json({ ok: true })
})

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