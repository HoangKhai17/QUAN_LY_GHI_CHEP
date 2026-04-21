-- Migration 007: Chuyển schema sang platform-agnostic
-- Hỗ trợ nhiều nền tảng: zalo, telegram, discord, web, ...

-- ── 1. Thêm platform vào users ───────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform        VARCHAR(20) NOT NULL DEFAULT 'zalo',
  ADD COLUMN IF NOT EXISTS platform_user_id VARCHAR(100);

-- Migrate dữ liệu zalo_id hiện có sang platform_user_id
UPDATE users SET platform_user_id = zalo_id WHERE zalo_id IS NOT NULL;

-- Unique constraint: cùng platform không trùng platform_user_id
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_zalo_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_platform_uid
  ON users(platform, platform_user_id)
  WHERE platform_user_id IS NOT NULL;

-- ── 2. Đổi records sang platform-agnostic ────────────────────────
ALTER TABLE records
  ADD COLUMN IF NOT EXISTS platform            VARCHAR(20) NOT NULL DEFAULT 'zalo',
  ADD COLUMN IF NOT EXISTS platform_message_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS source_chat_id      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS source_chat_type    VARCHAR(20) DEFAULT 'group';

-- Migrate dữ liệu cũ
UPDATE records SET
  platform_message_id = zalo_message_id,
  source_chat_id      = zalo_group_id
WHERE zalo_message_id IS NOT NULL;

-- Unique: cùng platform không nhận duplicate message
ALTER TABLE records DROP CONSTRAINT IF EXISTS records_zalo_message_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_records_platform_msg
  ON records(platform, platform_message_id)
  WHERE platform_message_id IS NOT NULL;

-- Index mới theo platform
CREATE INDEX IF NOT EXISTS idx_records_platform ON records(platform);

-- ── 3. Tạo bảng platform_configs ─────────────────────────────────
-- Lưu cấu hình từng nền tảng (token, webhook secret, ...)
CREATE TABLE IF NOT EXISTS platform_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    VARCHAR(20) NOT NULL UNIQUE,   -- 'zalo', 'telegram', 'discord'
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  config      JSONB NOT NULL DEFAULT '{}',   -- token, secrets (encrypted ở tầng app)
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO platform_configs (platform, is_active, config) VALUES
  ('zalo',     FALSE, '{"note": "Cần ZALO_OA_TOKEN và ZALO_WEBHOOK_SECRET"}'),
  ('telegram', FALSE, '{"note": "Cần TELEGRAM_BOT_TOKEN"}'),
  ('web',      TRUE,  '{"note": "Web form upload - luôn bật"}')
ON CONFLICT (platform) DO NOTHING;
