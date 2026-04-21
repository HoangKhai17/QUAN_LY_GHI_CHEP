CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff');

CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Platform identity (hỗ trợ Telegram, Zalo, Discord, ...)
  platform         VARCHAR(20) NOT NULL DEFAULT 'telegram',  -- 'telegram'|'zalo'|'discord'|'web'
  platform_user_id VARCHAR(100),                              -- ID user trên platform

  -- Web login (chỉ dùng cho Manager đăng nhập Dashboard)
  username         VARCHAR(50) UNIQUE,
  password_hash    TEXT,

  name             VARCHAR(100) NOT NULL,
  role             user_role NOT NULL DEFAULT 'staff',
  avatar_url       TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  login_attempts   INT NOT NULL DEFAULT 0,
  locked_until     TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Cùng platform không được trùng platform_user_id
  UNIQUE (platform, platform_user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_platform_uid ON users(platform, platform_user_id)
  WHERE platform_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
  WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
