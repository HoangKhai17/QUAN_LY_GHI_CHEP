-- Archive table for old audit logs (cold storage, append-only after archiving)
CREATE TABLE IF NOT EXISTS audit_logs_archive (
  id           UUID PRIMARY KEY,
  user_id      UUID,
  action       VARCHAR(50) NOT NULL,
  resource     VARCHAR(50),
  resource_id  UUID,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMP NOT NULL,
  archived_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_archive_user    ON audit_logs_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_archive_action  ON audit_logs_archive(action);
CREATE INDEX IF NOT EXISTS idx_audit_archive_created ON audit_logs_archive(created_at DESC);
