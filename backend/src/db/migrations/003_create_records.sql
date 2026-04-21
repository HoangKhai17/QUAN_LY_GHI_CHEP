CREATE TYPE record_status AS ENUM ('new', 'reviewed', 'approved', 'flagged', 'deleted');
CREATE TYPE ocr_status    AS ENUM ('pending', 'success', 'failed');

CREATE TABLE IF NOT EXISTS records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nguồn (platform-agnostic)
  platform             VARCHAR(20) NOT NULL DEFAULT 'telegram', -- 'telegram'|'zalo'|'discord'
  platform_message_id  VARCHAR(100),       -- ID tin nhắn gốc (dùng chống duplicate)
  source_chat_id       VARCHAR(100),       -- ID group/channel/chat nguồn
  source_chat_type     VARCHAR(20) DEFAULT 'group', -- 'private'|'group'|'channel'
  sender_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_name          VARCHAR(100),       -- Cache tên tại thời điểm gửi

  -- Nội dung
  image_url            TEXT,              -- URL ảnh trên Storage (Signed URL)
  image_key            TEXT,              -- Storage key (để tạo lại Signed URL)
  image_thumbnail      TEXT,              -- URL thumbnail nhỏ
  ocr_text             TEXT,              -- Text nhận dạng từ ảnh
  note                 TEXT,              -- Ghi chú text kèm theo
  category_id          UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Trạng thái
  status               record_status NOT NULL DEFAULT 'new',
  flag_reason          TEXT,

  -- Phê duyệt
  reviewed_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at          TIMESTAMP,
  approved_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at          TIMESTAMP,

  -- OCR metadata
  ocr_status           ocr_status NOT NULL DEFAULT 'pending',
  ocr_confidence       DECIMAL(5,2),

  -- Timestamps
  received_at          TIMESTAMP NOT NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Chống duplicate: cùng platform không nhận lại cùng message
  UNIQUE (platform, platform_message_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_records_platform    ON records(platform);
CREATE INDEX IF NOT EXISTS idx_records_sender      ON records(sender_id);
CREATE INDEX IF NOT EXISTS idx_records_status      ON records(status);
CREATE INDEX IF NOT EXISTS idx_records_received    ON records(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_category    ON records(category_id);

-- Full-text search index (Vietnamese: unaccented + simple tokenizer)
CREATE INDEX IF NOT EXISTS idx_records_fts ON records
  USING gin(to_tsvector('simple',
    coalesce(note, '') || ' ' || coalesce(ocr_text, '') || ' ' || coalesce(sender_name, '')
  ));
