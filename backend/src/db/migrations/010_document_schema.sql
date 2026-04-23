-- Migration 010: Dynamic Document Schema
-- Adds document_types, document_type_fields, record_field_values.
-- ALTERs records table (all columns nullable → zero breaking changes).

-- ── document_types ──────────────────────────────────────────────────────────
CREATE TABLE document_types (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code                VARCHAR(50)  UNIQUE NOT NULL,
  name                VARCHAR(200) NOT NULL,
  description         TEXT,
  default_category_id UUID         REFERENCES categories(id) ON DELETE SET NULL,
  is_active           BOOLEAN      DEFAULT TRUE,
  created_at          TIMESTAMP    DEFAULT NOW()
);

-- ── document_type_fields ────────────────────────────────────────────────────
CREATE TABLE document_type_fields (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id UUID         NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
  field_key        VARCHAR(100) NOT NULL,
  label            VARCHAR(200) NOT NULL,
  data_type        VARCHAR(20)  NOT NULL
                   CHECK (data_type IN ('text','number','date','datetime','boolean','json','money')),
  unit             VARCHAR(50),
  is_required      BOOLEAN      DEFAULT FALSE,
  is_filterable    BOOLEAN      DEFAULT FALSE,
  is_reportable    BOOLEAN      DEFAULT FALSE,
  aggregation_type VARCHAR(20)  DEFAULT 'none'
                   CHECK (aggregation_type IN ('none','sum','avg','count','min','max')),
  display_order    INT          DEFAULT 0,
  config           JSONB        DEFAULT '{}',
  created_at       TIMESTAMP    DEFAULT NOW(),
  UNIQUE (document_type_id, field_key)
);

-- ── record_field_values ─────────────────────────────────────────────────────
-- One row per (record, field). Typed columns avoid JSONB cast complexity
-- while keeping the schema flexible for any data_type.
CREATE TABLE record_field_values (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id      UUID         NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  field_id       UUID         NOT NULL REFERENCES document_type_fields(id) ON DELETE CASCADE,
  value_text     TEXT,
  value_number   NUMERIC,
  value_date     DATE,
  value_datetime TIMESTAMP,
  value_boolean  BOOLEAN,
  value_json     JSONB,
  confidence     NUMERIC(5,2),
  source         VARCHAR(20)  DEFAULT 'ai'
                 CHECK (source IN ('ai','human','rule')),
  created_at     TIMESTAMP    DEFAULT NOW(),
  updated_at     TIMESTAMP    DEFAULT NOW(),
  UNIQUE (record_id, field_id)
);

-- ── Extend records (all nullable — no existing rows break) ──────────────────
ALTER TABLE records
  ADD COLUMN document_type_id          UUID         REFERENCES document_types(id) ON DELETE SET NULL,
  ADD COLUMN suggested_category_id     UUID         REFERENCES categories(id)     ON DELETE SET NULL,
  ADD COLUMN classification_confidence NUMERIC(5,2),
  ADD COLUMN extraction_status         VARCHAR(20)  DEFAULT 'pending'
                                       CHECK (extraction_status IN
                                             ('pending','done','needs_review','failed')),
  ADD COLUMN extracted_data            JSONB,
  ADD COLUMN schema_version            INT          DEFAULT 1;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_records_document_type_id  ON records(document_type_id);
CREATE INDEX idx_records_extraction_status ON records(extraction_status)
  WHERE extraction_status IS NOT NULL;
CREATE INDEX idx_rfv_record_id             ON record_field_values(record_id);
CREATE INDEX idx_rfv_field_id              ON record_field_values(field_id);
CREATE INDEX idx_rfv_value_number          ON record_field_values(value_number)
  WHERE value_number IS NOT NULL;
CREATE INDEX idx_dtf_type_order            ON document_type_fields(document_type_id, display_order);
