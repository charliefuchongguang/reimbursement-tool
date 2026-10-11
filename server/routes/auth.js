import express from 'express'
import {
  getUserByPhone,
  getUserById,
  createUser,
  updateUserPassword,
  updateUserProfile
} from '../db.js'
import { verifyPassword, defaultPasswordFromPhone } from '../utils/password.js'
import { signToken, authRequired, publicUser } from '../middleware/auth.js'

const router = express.Router()

const PHONE_RE = /^1[3-9]\d{9}$/
const MIN_PASSWORD_LEN = 6

/**
 * 注册：昵称 + 手机号，初始密码 = 手机号后六位
 */
router.post('/register', (req, res) => {
  const nickname = String(req.body?.nickname || '').trim()
  const phone = String(req.body?.phone || '').trim()

  if (!nickname) return res.status(400).json({ message: '请填写昵称。' })
  if (nickname.length > 30) return res.status(400).json({ message: '昵称不能超过 30 个字符。' })
  if (!PHONE_RE.test(phone)) return res.status(400).json({ message: '请输入有效的 11 位手机号。' })
  if (getUserByPhone(phone)) return res.status(409).json({ message: '该手机号已注册，请直接登录。' })

  const user = createUser({
    phone,
    nickname,
    password: defaultPasswordFromPhone(phone),
    role: 'user',
    mustChangePassword: 1
  })

  res.status(201).json({ token: signToken(user), user: publicUser(user) })
})

/**
 * 登录：手机号 + 密码
 */
router.post('/login', (req, res) => {
  const phone = String(req.body?.phone || '').trim()
  const password = String(req.body?.password || '')

  if (!PHONE_RE.test(phone) || !password) {
    return res.status(400).json({ message: '请输入手机号和密码。' })
  }
  const user = getUserByPhone(phone)
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ message: '手机号或密码错误。' })
  }
  res.json({ token: signToken(user), user: publicUser(user) })
})

/**
 * 当前登录用户
 */
router.get('/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

/**
 * 修改密码（首次登录强制改密也走这里）
 */
router.post('/change-password', authRequired, (req, res) => {
  const oldPassword = String(req.body?.oldPassword || '')
  const newPassword = String(req.body?.newPassword || '')

  if (!verifyPassword(oldPassword, req.user.password_hash)) {
    return res.status(400).json({ message: '原密码不正确。' })
  }
  if (newPassword.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({ message: `新密码至少 ${MIN_PASSWORD_LEN} 位。` })
  }
  if (newPassword === oldPassword) {
    return res.status(400).json({ message: '新密码不能与原密码相同。' })
  }
  updateUserPassword(req.user.id, newPassword, { mustChangePassword: 0 })
  const user = getUserById(req.user.id)
  res.json({ user: publicUser(user) })
})

/**
 * 更新个人资料（部门 / 出差人 / 昵称）
 */
router.put('/profile', authRequired, (req, res) => {
  const nickname = req.body?.nickname != null ? String(req.body.nickname).trim() : undefined
  if (nickname !== undefined && !nickname) {
    return res.status(400).json({ message: '昵称不能为空。' })
  }
  const user = updateUserProfile(req.user.id, {
    nickname,
    department: req.body?.department != null ? String(req.body.department).trim() : undefined,
    reimburser: req.body?.reimburser != null ? String(req.body.reimburser).trim() : undefined
  })
  res.json({ user: publicUser(user) })
})

export default router