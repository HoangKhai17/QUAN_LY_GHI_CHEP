const { createNormalizedMessage } = require('../normalized-message')

const IGNORED_TYPES = ['sticker', 'voice', 'video_note', 'location', 'contact', 'poll']

function getChatType(chat) {
  if (chat.type === 'private')    return 'private'
  if (chat.type === 'channel')    return 'channel'
  return 'group'
}

function parseTelegramUpdate(update) {
  // Telegram gửi update object, message nằm trong update.message
  const message = update.message || update.channel_post
  if (!message) return null

  const from    = message.from || {}
  const chat    = message.chat || {}

  // Bỏ qua các loại không liên quan
  for (const type of IGNORED_TYPES) {
    if (message[type]) return null
  }

  const hasPhoto = !!(message.photo?.length)
  const hasText  = !!(message.caption || message.text)?.trim()

  let messageType
  if (hasPhoto && hasText)  messageType = 'image_text'
  else if (hasPhoto)        messageType = 'image_only'
  else if (hasText)         messageType = 'text_only'
  else return null

  // Telegram gửi mảng photo sizes, lấy size lớn nhất
  const photoFileId = hasPhoto
    ? message.photo[message.photo.length - 1].file_id
    : null

  const textContent = message.caption || message.text || null

  // Tên người gửi
  const senderName = from.username
    ? `@${from.username}`
    : [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Telegram User'

  return createNormalizedMessage({
    platform:           'telegram',
    platform_message_id: String(message.message_id),
    platform_user_id:   String(from.id || chat.id),
    sender_name:        senderName,
    source_chat_id:     String(chat.id),
    source_chat_type:   getChatType(chat),
    message_type:       messageType,
    image_file_id:      photoFileId,
    image_url:          null,   // Telegram không có URL trực tiếp, cần gọi getFile
    text_note:          textContent,
    received_at:        message.date ? new Date(message.date * 1000) : new Date(),
    raw:                update,
  })
}

module.exports = { parseTelegramUpdate }
