-- Migration 012: System settings — API keys and integration config
-- Secrets (tokens, passwords) are stored as AES-256-GCM ciphertext by the app layer.
-- Non-secrets (model names, flags) are stored as plain text in value_plain.

CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value_plain TEXT,                                      -- plaintext (for non-secrets)
  value_enc   TEXT,                                      -- AES-256-GCM ciphertext (hex)
  value_iv    TEXT,                                      -- GCM IV (hex, 12 bytes)
  value_tag   TEXT,                                      -- GCM auth tag (hex, 16 bytes)
  is_secret   BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed known keys with metadata only — no values stored initially.
-- The app falls back to .env vars until the admin sets values via UI.
INSERT INTO system_settings (key, is_secret, description) VALUES
  ('telegram_bot_token',      TRUE,  'Telegram Bot Token — lấy từ @BotFather'),
  ('telegram_webhook_secret', TRUE,  'Telegram Webhook Secret — chuỗi bí mật xác thực header'),
  ('zalo_oa_token',           TRUE,  'Zalo OA Access Token'),
  ('zalo_webhook_secret',     TRUE,  'Zalo Webhook Secret — HMAC key xác thực webhook'),
  ('gemini_api_key_primary',  TRUE,  'Gemini AI API Key — chính (aistudio.google.com)'),
  ('gemini_api_key_fallback', TRUE,  'Gemini AI API Key — dự phòng khi key chính lỗi'),
  ('gemini_model',            FALSE, 'Tên model Gemini (mặc định: gemini-2.5-flash)'),
  ('ai_fallback_enabled',     FALSE, 'Tự động chuyển sang key dự phòng khi key chính lỗi (true/false)')
ON CONFLICT (key) DO NOTHING;
