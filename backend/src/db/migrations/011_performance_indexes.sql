-- Migration 011: Performance indexes for scale
-- Adds composite and partial indexes that are missing for common filter patterns.
-- All indexes are CONCURRENT-safe via IF NOT EXISTS; no table lock on existing data.

-- ── records: composite indexes for date-range + filter combinations ───────────

-- Most common query pattern: filter by date range AND status (every page load)
CREATE INDEX IF NOT EXISTS idx_records_received_status
  ON records(received_at DESC, status);

-- Date range + platform (platform-specific dashboard / reports)
CREATE INDEX IF NOT EXISTS idx_records_received_platform
  ON records(received_at DESC, platform);

-- sender_name for exact/ANY filter (sender dropdown filter)
CREATE INDEX IF NOT EXISTS idx_records_sender_name
  ON records(sender_name)
  WHERE sender_name IS NOT NULL;

-- ── record_field_values: composite for report aggregations ────────────────────

-- Financial report: aggregate value_number grouped by field_id
-- Partial index avoids indexing NULL rows (most fields are NULL for a given record)
CREATE INDEX IF NOT EXISTS idx_rfv_field_value_number
  ON record_field_values(field_id, value_number)
  WHERE value_number IS NOT NULL;

-- ── document_type_fields: field_key lookup for EXISTS subquery ────────────────

-- Used by buildFvCondition: IN (SELECT id FROM document_type_fields WHERE field_key = $N)
CREATE INDEX IF NOT EXISTS idx_dtf_field_key
  ON document_type_fields(field_key);

-- ── users: listing with role/active filter + chronological sort ───────────────

CREATE INDEX IF NOT EXISTS idx_users_active_created
  ON users(is_active, created_at DESC);

-- ── categories: active-only listing sorted by name ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_categories_active_name
  ON categories(is_active, name);
