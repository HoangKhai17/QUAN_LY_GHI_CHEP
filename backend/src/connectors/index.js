/**
 * Connector Registry — đăng ký tất cả platform connectors.
 *
 * Để thêm platform mới (Discord, Slack, Line...):
 *   1. Tạo thư mục src/connectors/<platform>/
 *   2. Implement <platform>.connector.js extends BaseConnector
 *   3. Thêm 1 dòng vào registry bên dưới
 *   4. Thêm env var TELEGRAM_BOT_TOKEN (hoặc tương đương) vào .env
 */
const registry = {
  zalo:     require('./zalo/zalo.connector'),
  telegram: require('./telegram/telegram.connector'),
  // discord: require('./discord/discord.connector'),
  // slack:   require('./slack/slack.connector'),
}

function getConnector(platform) {
  return registry[platform] || null
}

function listPlatforms() {
  return Object.keys(registry)
}

module.exports = { getConnector, listPlatforms }
