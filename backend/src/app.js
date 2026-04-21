require('./config/env')
const express = require('express')
const http = require('http')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const { Server: SocketIO } = require('socket.io')

const logger = require('./config/logger')
const { errorHandler, notFound } = require('./middlewares/errorHandler')

const app = express()
const server = http.createServer(app)

// ── Realtime ────────────────────────────────────────────────────
const io = new SocketIO(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
})
app.set('io', io)
io.on('connection', (socket) => {
  logger.info('socket.connected', { id: socket.id })
  socket.on('disconnect', () => logger.info('socket.disconnected', { id: socket.id }))
})

// ── Security & Middleware ────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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

// ── Routes ───────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }))

app.use('/api/auth',      require('./modules/auth/auth.router'))
app.use('/api/records',   require('./modules/records/records.router'))
app.use('/api/reports',   require('./modules/reports/reports.router'))
app.use('/api/search',    require('./modules/search/search.router'))
app.use('/api/notifications', require('./modules/notifications/notifications.router'))
app.use('/webhook',       require('./modules/zalo/zalo.router'))

// ── Error handlers ───────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  logger.info('server.started', { port: PORT, env: process.env.NODE_ENV })
})

module.exports = { app, server }
