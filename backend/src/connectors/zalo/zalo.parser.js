const { createNormalizedMessage } = require('../normalized-message')

const IGNORED_TYPES = ['sticker', 'gif', 'audio', 'video', 'location', 'contact']

function detectMessageType(payload) {
  const msg = payload.event_data?.message || {}
  const hasImage = !!msg.attachments?.find(a => a.type === 'photo')
  const hasText  = !!msg.text?.trim()

  if (IGNORED_TYPES.includes(msg.type)) return 'ignore'
  if (hasImage && hasText)  return 'image_text'
  if (hasImage)             return 'image_only'
  if (hasText)              return 'text_only'
  return 'ignore'
}

function parseZaloPayload(payload) {
  const msg      = payload.event_data?.message || {}
  const sender   = payload.sender || {}
  const recipient = payload.recipient || {}

  const msgType = detectMessageType(payload)
  if (msgType === 'ignore') return null

  const photo = msg.attachments?.find(a => a.type === 'photo')

  return createNormalizedMessage({
    platform:           'zalo',
    platform_message_id: msg.msg_id || payload.event_data?.message_id,
    platform_user_id:   sender.id,
    sender_name:        sender.display_name || sender.name || 'Zalo User',
    source_chat_id:     recipient.id,
    source_chat_type:   recipient.type === 'group' ? 'group' : 'private',
    message_type:       msgType,
    image_url:          photo?.payload?.url || null,
    image_file_id:      photo?.payload?.url || null,
    text_note:          msg.text || null,
    received_at:        payload.timestamp ? new Date(payload.timestamp * 1000) : new Date(),
    raw:                payload,
  })
}

module.exports = { parseZaloPayload }
