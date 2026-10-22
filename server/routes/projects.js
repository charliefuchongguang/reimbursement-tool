import express from 'express'
import { db } from '../db.js'
import { authRequired } from '../middleware/auth.js'

const router = express.Router()

router.use(authRequired)

/**
 * 获取当前用户使用过的项目名称（用于项目简写输入框的历史联想）
 * 数据来源 = 显式记忆的 projects 表 ∪ 历史任务中记录的 projectCode
 */
router.get('/', (req, res) => {
  const uid = req.user.id
  const map = new Map()

  for (const r of db.prepare('SELECT code, use_count, updated_at FROM projects WHERE user_id = ?').all(uid)) {
    map.set(r.code, { code: r.code, useCount: r.use_count, updatedAt: r.updated_at })
  }

  // 合并历史任务里的项目简写（老数据也能被联想）
  try {
    const rows = db
      .prepare(
        `SELECT json_extract(data, '$.projectCode') AS code, MAX(generated_at) AS ts
         FROM tasks
         WHERE user_id = ?
           AND json_extract(data, '$.projectCode') IS NOT NULL
           AND json_extract(data, '$.projectCode') <> ''
         GROUP BY code`
      )
      .all(uid)
    for (const r of rows) {
      if (!r.code) continue
      if (!map.has(r.code)) {
        map.set(r.code, { code: r.code, useCount: 1, updatedAt: r.ts || '' })
      }
    }
  } catch (e) {
    console.warn('[projects] 合并历史任务项目名失败：', e.message)
  }

  const projects = [...map.values()].sort(
    (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || (b.useCount || 0) - (a.useCount || 0)
  )
  res.json({ projects })
})

/**
 * 记忆一个项目名称（用户填写/选择时调用）
 */
router.post('/', (req, res) => {
  const code = String(req.body?.code || '').trim()
  if (!code) return res.status(400).json({ message: '项目名称不能为空。' })
  if (code.length > 50) return res.status(400).json({ message: '项目名称不能超过 50 个字符。' })

  db.prepare(
    `INSERT INTO projects (user_id, code, use_count, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(user_id, code) DO UPDATE SET use_count = use_count + 1, updated_at = excluded.updated_at`
  ).run(req.user.id, code, new Date().toISOString())

  res.status(201).json({ ok: true })
})

export default router