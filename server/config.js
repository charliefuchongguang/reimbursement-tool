import path from 'node:path'

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || '',
  adminPhone: (process.env.ADMIN_PHONE || '').trim(),
  adminPassword: (process.env.ADMIN_PASSWORD || '').trim(),
  adminNickname: (process.env.ADMIN_NICKNAME || '管理员').trim(),
  dbPath: process.env.DB_PATH || path.join(process.cwd(), 'data', 'app.db'),
  defaultLlmModel: process.env.DEFAULT_LLM_MODEL || 'deepseek-chat',
  defaultLlmBaseUrl: process.env.DEFAULT_LLM_BASE_URL || 'https://api.deepseek.com',
  defaultLlmApiKey: process.env.DEFAULT_LLM_API_KEY || ''
}