import bcrypt from 'bcryptjs'

/**
 * 生成密码哈希
 */
export function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), 10)
}

/**
 * 校验密码
 */
export function verifyPassword(plain, hash) {
  if (!hash) return false
  return bcrypt.compareSync(String(plain), hash)
}

/**
 * 手机号后六位作为默认密码
 */
export function defaultPasswordFromPhone(phone) {
  return String(phone).slice(-6)
}