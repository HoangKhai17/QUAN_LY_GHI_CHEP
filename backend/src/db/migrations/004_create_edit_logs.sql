CREATE TABLE IF NOT EXISTS edit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  edited_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  field_name  VARCHAR(50) NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  edited_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edit_logs_record ON edit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_edit_logs_editor ON edit_logs(edited_by);
