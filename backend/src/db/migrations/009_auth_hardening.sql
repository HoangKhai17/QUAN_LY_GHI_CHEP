-- Auth hardening: thêm các cột cần thiết cho security model đầy đủ

-- users: thêm auth state columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_pw      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_login_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;

-- refresh_tokens: thêm rotation + reuse detection support
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS family_id   UUID        NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS revoked_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS device_hint VARCHAR(200);

-- token_hash phải unique để tìm nhanh và tránh collision
ALTER TABLE refresh_tokens
  DROP CONSTRAINT IF EXISTS refresh_tokens_token_hash_key;
ALTER TABLE refresh_tokens
  ADD CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash);

-- Index để lookup theo family_id khi revoke toàn family
CREATE INDEX IF NOT EXISTS idx_rt_family_id ON refresh_tokens(family_id);
