import express from 'express'
import { db } from '../db.js'
import { authRequired } from '../middleware/auth.js'

const router = express.Router()

router.use(authRequired)

function rowToTask(row) {
  try {
    return JSON.parse(row.data)
  } catch {
    return null
  }
}

/**
 * 获取当前用户的全部任务记录（按生成时间倒序）
 */
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT data FROM tasks WHERE user_id = ? ORDER BY generated_at DESC')
    .all(req.user.id)
  res.json({ tasks: rows.map(rowToTask).filter(Boolean) })
})

/**
 * 新增或覆盖一条任务记录
 */
router.post('/', (req, res) => {
  const task = req.body?.task
  if (!task || typeof task !== 'object' || !task.id) {
    return res.status(400).json({ message: '任务数据无效。' })
  }
  const now = new Date().toISOString()
  const data = JSON.stringify(task)
  db.prepare(
    `INSERT INTO tasks (id, user_id, data, generated_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, generated_at = excluded.generated_at, updated_at = excluded.updated_at`
  ).run(task.id, req.user.id, data, task.generatedAt || now, now, now)
  res.status(201).json({ task })
})

/**
 * 更新任务字段（浅合并）
 */
router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  if (!row) return res.status(404).json({ message: '任务不存在。' })
  const current = rowToTask(row) || {}
  const patch = req.body?.patch
  if (!patch || typeof patch !== 'object') {
    return res.status(400).json({ message: '缺少更新内容。' })
  }
  const merged = { ...current, ...patch, id: current.id }
  db.prepare('UPDATE tasks SET data = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(
    JSON.stringify(merged),
    new Date().toISOString(),
    req.params.id,
    req.user.id
  )
  res.json({ task: merged })
})

/**
 * 删除任务
 */
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  if (info.changes === 0) return res.status(404).json({ message: '任务不存在。' })
  res.json({ ok: true })
})

export default router