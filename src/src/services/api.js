import * as storage from '@/utils/storage'

const TOKEN_KEY = 'authToken'
const BASE = '/api'

export function getToken() {
  return storage.get(TOKEN_KEY) || ''
}

export function setToken(token) {
  if (token) storage.set(TOKEN_KEY, token)
  else storage.remove(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(message, status = 0, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/**
 * 统一 API 请求封装
 * @param {string} path - 以 / 开头，不含 /api 前缀
 * @param {object} [opts] - { method, body, auth }
 */
export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new ApiError('网络连接失败，请检查网络后重试。', 0)
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    // 无 JSON 响应体
  }

  if (!res.ok) {
    throw new ApiError(data?.message || `请求失败（${res.status}）`, res.status, data?.code)
  }
  return data
}