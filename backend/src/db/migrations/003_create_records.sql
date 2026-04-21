CREATE TYPE record_status AS ENUM ('new', 'reviewed', 'approved', 'flagged', 'deleted');
CREATE TYPE ocr_status    AS ENUM ('pending', 'success', 'failed');

CREATE TABLE IF NOT EXISTS records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nguồn Zalo
  zalo_message_id  VARCHAR(100) UNIQUE,
  sender_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_name      VARCHAR(100),
  zalo_group_id    VARCHAR(100),

  -- Nội dung
  image_url        TEXT,
  image_key        TEXT,
  image_thumbnail  TEXT,
  ocr_text         TEXT,
  note             TEXT,
  category_id      UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Trạng thái
  status           record_status NOT NULL DEFAULT 'new',
  flag_reason      TEXT,

  -- Phê duyệt
  reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMP,
  approved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMP,

  -- OCR metadata
  ocr_status       ocr_status NOT NULL DEFAULT 'pending',
  ocr_confidence   DECIMAL(5,2),

  -- Timestamps
  received_at      TIMESTAMP NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_records_sender    ON records(sender_id);
CREATE INDEX IF NOT EXISTS idx_records_status    ON records(status);
CREATE INDEX IF NOT EXISTS idx_records_received  ON records(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_category  ON records(category_id);
CREATE INDEX IF NOT EXISTS idx_records_zalo_msg  ON records(zalo_message_id);

-- Full-text search index (Vietnamese: unaccented + simple tokenizer)
CREATE INDEX IF NOT EXISTS idx_records_fts ON records
  USING gin(to_tsvector('simple',
    coalesce(note, '') || ' ' || coalesce(ocr_text, '') || ' ' || coalesce(sender_name, '')
  ));
