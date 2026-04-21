/**
 * NormalizedMessage — format chuẩn hóa từ mọi nền tảng
 *
 * Mọi connector (Zalo, Telegram, Discord...) phải convert
 * payload gốc của platform về format này trước khi xử lý.
 *
 * message_type:
 *   'image_text'  — có cả ảnh lẫn ghi chú text
 *   'image_only'  — chỉ có ảnh
 *   'text_only'   — chỉ có text
 *   'ignore'      — sticker, voice, video, ... → bỏ qua
 */

function createNormalizedMessage({
  platform,
  platform_message_id,
  platform_user_id,
  sender_name,
  source_chat_id,
  source_chat_type = 'group',   // 'private' | 'group' | 'channel'
  message_type,
  image_file_id = null,         // ID nội bộ platform để download ảnh
  image_url = null,             // URL trực tiếp (nếu có sẵn)
  text_note = null,
  received_at = new Date(),
  raw = {},                     // payload gốc, dùng để debug
}) {
  return {
    platform,
    platform_message_id: String(platform_message_id),
    platform_user_id: String(platform_user_id),
    sender_name: sender_name || 'Unknown',
    source_chat_id: String(source_chat_id),
    source_chat_type,
    message_type,
    image_file_id,
    image_url,
    text_note: text_note?.trim() || null,
    received_at,
    raw,
  }
}

module.exports = { createNormalizedMessage }
