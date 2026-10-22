import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { initDb } from './db.js'
import authRoutes from './routes/auth.js'
import taskRoutes from './routes/tasks.js'
import projectRoutes from './routes/projects.js'
import adminRoutes from './routes/admin.js'
import aiRoutes from './routes/ai.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

initDb()

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '50mb' }))

// 登录/注册限流，防止弱口令爆破
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: '尝试过于频繁，请 15 分钟后再试。' }
})

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/ai', aiRoutes)

// 未知 API 路径
app.use('/api', (req, res) => res.status(404).json({ message: '接口不存在。' }))

// 托管前端构建产物（src/dist），并支持 SPA 回退
const distDir = path.resolve(__dirname, '..', 'src', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')))
} else {
  app.get('/', (req, res) =>
    res
      .status(200)
      .send('后端已启动，但未找到前端构建产物。请先在 src 目录执行 `npm run build`。')
  )
}

// 统一错误处理
app.use((err, req, res, next) => {
  console.error('[server] 未捕获错误:', err)
  if (res.headersSent) return next(err)
  res.status(500).json({ message: '服务器内部错误。' })
})

app.listen(config.port, () => {
  console.log(`[server] 报销助手后端已启动：http://localhost:${config.port}`)
  console.log(`[server] 数据库：${config.dbPath}`)
  if (!config.jwtSecret) console.warn('[server] 警告：未设置 JWT_SECRET，生产环境请务必配置。')
  if (!config.adminPhone) console.warn('[server] 警告：未设置 ADMIN_PHONE，将没有管理员账号。')
})