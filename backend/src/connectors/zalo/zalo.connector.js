const crypto = require('crypto')
const axios = require('axios')
const BaseConnector = require('../base.connector')
const { parseZaloPayload } = require('./zalo.parser')
const logger = require('../../config/logger')

class ZaloConnector extends BaseConnector {
  constructor() {
    super('zalo')
    this.webhookSecret = process.env.ZALO_WEBHOOK_SECRET || ''
    this.oaToken       = process.env.ZALO_OA_TOKEN       || ''
    this._ensureConfig().catch(() => {})
  }

  async _ensureConfig() {
    try {
      const { getSetting } = require('../../services/settings.service')
      const [oaToken, webhookSecret] = await Promise.all([
        getSetting('zalo_oa_token'),
        getSetting('zalo_webhook_secret'),
      ])
      this.oaToken       = oaToken       || ''
      this.webhookSecret = webhookSecret || ''
    } catch (err) {
      logger.warn('zalo.config.refresh_failed', { error: err.message })
    }
  }

  verify(req) {
    if (!this.webhookSecret) {
      logger.warn('zalo.verify.skip', { reason: 'ZALO_WEBHOOK_SECRET not configured' })
      return true
    }
    const signature = req.headers['x-zalo-signature'] || ''
    const body = JSON.stringify(req.body)
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
    } catch {
      return false
    }
  }

  parse(payload) {
    const msg = parseZaloPayload(payload)
    return msg ? [msg] : []
  }

  async downloadImage(imageUrl) {
    await this._ensureConfig()
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: { access_token: this.oaToken },
      timeout: 15_000,
    })
    return Buffer.from(response.data)
  }

  async reply(chatId, text) {
    await this._ensureConfig()
    if (!this.oaToken) {
      logger.warn('zalo.reply.skip', { reason: 'ZALO_OA_TOKEN not configured' })
      return
    }
    await axios.post(
      'https://openapi.zalo.me/v2.0/oa/message',
      { recipient: { user_id: chatId }, message: { text } },
      { headers: { access_token: this.oaToken } }
    )
  }
}

module.exports = new ZaloConnector()
