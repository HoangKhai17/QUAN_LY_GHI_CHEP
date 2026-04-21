CREATE TYPE report_type   AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'custom');
CREATE TYPE report_status AS ENUM ('pending', 'processing', 'done', 'failed');
CREATE TYPE file_type     AS ENUM ('excel', 'pdf');

CREATE TABLE IF NOT EXISTS report_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Cấu hình báo cáo
  report_type     report_type NOT NULL,
  date_from       DATE NOT NULL,
  date_to         DATE NOT NULL,
  filter_platform VARCHAR(20),                                  -- NULL = tất cả platform
  filter_user     UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL = tất cả nhân viên
  filter_cat      UUID REFERENCES categories(id) ON DELETE SET NULL,
  filter_status   VARCHAR(20),                                  -- NULL = tất cả trạng thái

  -- Kết quả
  status          report_status NOT NULL DEFAULT 'pending',
  file_url        TEXT,
  file_type       file_type NOT NULL DEFAULT 'excel',
  error_msg       TEXT,

  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_jobs_user   ON report_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_report_jobs_status ON report_jobs(status);
