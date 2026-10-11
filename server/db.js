import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { hashPassword, defaultPasswordFromPhone } from './utils/password.js'

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true })

export const db = new DatabaseSync(config.dbPath)

/**
 * 初始化数据库结构与种子数据
 */
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL UNIQUE,
      nickname TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      must_change_password INTEGER NOT NULL DEFAULT 1,
      department TEXT NOT NULL DEFAULT '',
      reimburser TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      generated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
  `)

  seedSettings()
  seedAdmin()
}

// ─── settings ───

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : null
}

export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value == null ? '' : String(value))
}

function seedSettings() {
  if (getSetting('llm_model') == null) setSetting('llm_model', config.defaultLlmModel)
  if (getSetting('llm_base_url') == null) setSetting('llm_base_url', config.defaultLlmBaseUrl)
  if (getSetting('llm_api_key') == null) setSetting('llm_api_key', config.defaultLlmApiKey)
}

// ─── users ───

export function getUserByPhone(phone) {
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) || null
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null
}

export function createUser({ phone, nickname, password, role = 'user', mustChangePassword = 1 }) {
  const now = new Date().toISOString()
  const info = db
    .prepare(
      `INSERT INTO users (phone, nickname, password_hash, role, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(phone, nickname, hashPassword(password), role, mustChangePassword ? 1 : 0, now)
  return getUserById(info.lastInsertRowid)
}

export function updateUserPassword(userId, plainPassword, { mustChangePassword = 0 } = {}) {
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?').run(
    hashPassword(plainPassword),
    mustChangePassword ? 1 : 0,
    userId
  )
}

export function updateUserProfile(userId, { department, reimburser, nickname }) {
  const user = getUserById(userId)
  if (!user) return null
  db.prepare('UPDATE users SET department = ?, reimburser = ?, nickname = ? WHERE id = ?').run(
    department ?? user.department,
    reimburser ?? user.reimburser,
    nickname ?? user.nickname,
    userId
  )
  return getUserById(userId)
}

function seedAdmin() {
  if (!config.adminPhone) {
    console.warn('[db] 未配置 ADMIN_PHONE，跳过管理员播种。')
    return
  }
  const existing = getUserByPhone(config.adminPhone)
  if (existing) {
    if (existing.role !== 'admin') {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id)
      console.log(`[db] 已将 ${config.adminPhone} 提升为管理员。`)
    }
    return
  }
  const password = config.adminPassword || defaultPasswordFromPhone(config.adminPhone)
  createUser({
    phone: config.adminPhone,
    nickname: config.adminNickname,
    password,
    role: 'admin',
    mustChangePassword: 1
  })
  console.log(`[db] 已创建管理员账号：${config.adminPhone}`)
}