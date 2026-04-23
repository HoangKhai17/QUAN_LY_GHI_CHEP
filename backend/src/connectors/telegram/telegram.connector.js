const crypto = require('crypto')
const axios = require('axios')
const BaseConnector = require('../base.connector')
const { parseTelegramUpdate } = require('./telegram.parser')
const logger = require('../../config/logger')

class TelegramConnector extends BaseConnector {
  constructor() {
    super('telegram')
    this.token = process.env.TELEGRAM_BOT_TOKEN || ''
    this.secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || ''
    this.apiBase = `https://api.telegram.org/bot${this.token}`
  }

  verify(req) {
    // Telegram hỗ trợ X-Telegram-Bot-Api-Secret-Token header (tuỳ chọn)
    if (!this.secretToken) return true
    const header = req.headers['x-telegram-bot-api-secret-token'] || ''
    try {
      const a = Buffer.from(header)
      const b = Buffer.from(this.secretToken)
      // timingSafeEqual throws nếu length khác nhau → phải check trước
      if (a.length !== b.length) return false
      return crypto.timingSafeEqual(a, b)
    } catch {
      return false
    }
  }

  parse(payload) {
    const msg = parseTelegramUpdate(payload)
    return msg ? [msg] : []
  }

  async downloadImage(fileId) {
    if (!this.token) throw new Error('TELEGRAM_BOT_TOKEN not configured')

    // Bước 1: lấy file path từ Telegram
    const { data } = await axios.get(`${this.apiBase}/getFile`, {
      params: { file_id: fileId },
      timeout: 10_000,
    })
    const filePath = data.result?.file_path
    if (!filePath) throw new Error('Telegram getFile returned no file_path')

    // Bước 2: download file thật
    const fileUrl = `https://api.telegram.org/file/bot${this.token}/${filePath}`
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
    })
    return Buffer.from(response.data)
  }

  async reply(chatId, text) {
    if (!this.token) {
      logger.warn('telegram.reply.skip', { reason: 'TELEGRAM_BOT_TOKEN not configured' })
      return
    }
    await axios.post(`${this.apiBase}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    })
  }

  /**
   * Đăng ký webhook URL với Telegram
   * Gọi 1 lần khi deploy hoặc khi URL thay đổi
   */
  async registerWebhook(webhookUrl) {
    const url = `${webhookUrl}/webhook/telegram`
    const { data } = await axios.post(`${this.apiBase}/setWebhook`, {
      url,
      // message: DM + group (khi privacy mode off) + supergroup
      // channel_post: bài đăng trong channel
      // edited_message: tin nhắn được sửa (bỏ qua ở parser, nhưng Telegram vẫn gửi)
      allowed_updates: ['message', 'channel_post', 'edited_message'],
      ...(this.secretToken && { secret_token: this.secretToken }),
    })
    logger.info('telegram.webhook.registered', { url, result: data.description })
    return data
  }

  /**
   * Kiểm tra thông tin webhook hiện tại
   */
  async getWebhookInfo() {
    const { data } = await axios.get(`${this.apiBase}/getWebhookInfo`)
    return data.result
  }
}

module.exports = new TelegramConnector()
