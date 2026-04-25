require('./config/env')
const express = require('express')
const http = require('http')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const jwt = require('jsonwebtoken')
const { Server: SocketIO } = require('socket.io')
const swaggerUi = require('swagger-ui-express')
const swaggerSpec = require('./config/swagger')

const logger = require('./config/logger')
const { errorHandler, notFound } = require('./middlewares/errorHandler')

const app = express()
const server = http.createServer(app)

// ── Realtime ────────────────────────────────────────────────────
const io = new SocketIO(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
})
app.set('io', io)

// Socket auth middleware — verify JWT on handshake
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('Unauthorized'))
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    socket.userId   = payload.sub
    socket.userRole = payload.role || 'staff'
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

io.on('connection', (socket) => {
  // Join personal + role rooms for targeted emits
  socket.join(`user:${socket.userId}`)
  socket.join(`role:${socket.userRole}`)
  logger.info('socket.connected', { id: socket.id, userId: socket.userId, role: socket.userRole })
  socket.on('disconnect', () =>
    logger.info('socket.disconnected', { id: socket.id, userId: socket.userId })
  )
})

// Trust proxy headers từ ngrok/nginx (cần để rate-limit nhận đúng IP)
app.set('trust proxy', 1)

// ── Security & Middleware ────────────────────────────────────────
app.use(helmet())
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
  // Ngrok URL khi dev (WEBHOOK_BASE_URL bỏ trailing slash)
  ...(process.env.WEBHOOK_BASE_URL
    ? [process.env.WEBHOOK_BASE_URL.replace(/\/+$/, '')]
    : []),
]
app.use(cors({
  origin: (origin, cb) => {
    // Cho phép: no-origin (curl/Postman), hoặc origin trong whitelist
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }))

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true })
const webhookLimiter = rateLimit({ windowMs: 60_000, max: 500, standardHeaders: true })
app.use('/api/', apiLimiter)
app.use('/webhook/', webhookLimiter)

// ── Docs ─────────────────────────────────────────────────────────
// helmet CSP mặc định block inline scripts của Swagger UI — tắt cho route /api-docs
app.use('/api-docs', (req, res, next) => {
  res.setHeader('Content-Security-Policy', '')
  next()
}, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Quản Lý Ghi Chép — API Docs',
  swaggerOptions: { persistAuthorization: true },
}))

// ── Routes ───────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }))

app.use('/api/auth',           require('./modules/auth/auth.router'))
app.use('/api/users',          require('./modules/users/users.router'))
app.use('/api/records',        require('./modules/records/records.router'))
app.use('/api/categories',     require('./modules/categories/categories.router'))
app.use('/api/document-types', require('./modules/document-types/document-types.router'))
app.use('/api/dashboard',      require('./modules/dashboard/dashboard.router'))
app.use('/api/search',         require('./modules/search/search.router'))
app.use('/api/reports',        require('./modules/reports/reports.router'))
app.use('/api/notifications',  require('./modules/notifications/notifications.router'))
app.use('/api/settings',       require('./modules/settings/settings.router'))

// ── Multi-platform webhook (/webhook/zalo, /webhook/telegram, ...) ──
app.use('/webhook',       require('./modules/webhook/webhook.router'))

// ── Error handlers ───────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  logger.info('server.started', { port: PORT, env: process.env.NODE_ENV })
  registerPlatformWebhooks()
})

async function registerPlatformWebhooks() {
  const baseUrl = (process.env.WEBHOOK_BASE_URL || '').replace(/\/+$/, '') // trim trailing slash
  if (!baseUrl) {
    logger.warn('webhook.register.skip', { reason: 'WEBHOOK_BASE_URL not set in .env' })
    return
  }

  // Telegram
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const telegramConnector = require('./connectors/telegram/telegram.connector')
      const result = await telegramConnector.registerWebhook(baseUrl)
      logger.info('telegram.webhook.ok', { url: `${baseUrl}/webhook/telegram`, result: result.description })
    } catch (err) {
      logger.error('telegram.webhook.failed', { error: err.message })
    }
  }
}

module.exports = { app, server }
