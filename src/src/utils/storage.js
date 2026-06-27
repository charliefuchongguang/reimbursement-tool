const PREFIX = 'reimbursement-helper.'

/**
 * 读取 localStorage
 * @param {string} key - 不含前缀的 key
 * @returns {*} 解析后的值，不存在返回 null
 */
export function get(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * 写入 localStorage
 * @param {string} key - 不含前缀的 key
 * @param {*} value - 要存储的值
 */
export function set(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (e) {
    console.error('localStorage 写入失败:', e)
  }
}

/**
 * 删除 localStorage 中的指定 key
 * @param {string} key - 不含前缀的 key
 */
export function remove(key) {
  localStorage.removeItem(PREFIX + key)
}
