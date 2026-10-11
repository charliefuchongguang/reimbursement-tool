import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { config } from '../config.js'
import { getUserById } from '../db.js'

// 未配置 JWT_SECRET 时生成临时密钥（仅开发用；重启后 token 失效）
let jwtSecret = config.jwtSecret
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString('hex')
  console.warn('[auth] 未配置 JWT_SECRET，已生成临时密钥；生产环境请在 .env 中设置固定值。')
}

export function signToken(user) {
  return jwt.sign({ uid: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' })
}

/**
 * 统一用户公开信息
 */
export function publicUser(u) {
  return {
    id: u.id,
    phone: u.phone,
    nickname: u.nickname,
    role: u.role,
    mustChangePassword: !!u.must_change_password,
    department: u.department || '',
    reimburser: u.reimburser || ''
  }
}

/**
 * 需要登录：校验 Bearer Token 并挂载 req.user
 */
export function authRequired(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    return res.status(401).json({ message: '未登录或登录已过期，请重新登录。' })
  }
  try {
    const payload = jwt.verify(token, jwtSecret)
    const user = getUserById(payload.uid)
    if (!user) {
      return res.status(401).json({ message: '账号不存在，请重新登录。' })
    }
    req.user = user
    next()
  } catch {
    return res.status(401).json({ message: '登录已过期，请重新登录。' })
  }
}

/**
 * 需要管理员权限（需先经过 authRequired）
 */
export function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: '需要管理员权限。' })
  }
  next()
}