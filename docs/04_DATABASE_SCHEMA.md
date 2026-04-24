# 💾 DATABASE SCHEMA — QUAN LY GHI CHEP
> Phiên bản: 3.0 | Cập nhật: 2026-04-24 (thêm document_types, record_field_values; cập nhật records)

---

## 📊 Entity Relationship Overview

```
┌──────────────────┐       ┌───────────────────────┐       ┌──────────────┐
│  users           │──1:N──│       records         │──N:1──│  categories  │
│  (web + platform)│       └────────┬──────────────┘       └──────────────┘
└──────────────────┘                │
                          ┌─────────┼──────────────┐
                          │         │              │
                   ┌──────────┐  ┌──────────┐  ┌──────────────────┐
                   │edit_logs │  │report_job│  │  document_types  │
                   └──────────┘  └──────────┘  └────────┬─────────┘
                                                         │
                                              ┌──────────┴──────────┐
                                              │                     │
                                  ┌───────────────────┐  ┌────────────────────┐
                                  │document_type_field│  │ record_field_values│
                                  │s (schema/trường)  │  │ (giá trị trích xuất│
                                  └───────────────────┘  └────────────────────┘

┌──────────────────┐
│   audit_logs     │
│   (immutable)    │
└──────────────────┘
```

---

## 📋 TABLE: users

```sql
CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Platform identity (platform-agnostic)
  platform         VARCHAR(20) NOT NULL DEFAULT 'web',   -- 'zalo'|'telegram'|'discord'|'web'
  platform_user_id VARCHAR(100),                          -- ID của user trên platform đó
  -- Web login
  username         VARCHAR(50) UNIQUE,
  password_hash    TEXT,
  must_change_pw   BOOLEAN DEFAULT FALSE,
  name             VARCHAR(100) NOT NULL,
  role             user_role NOT NULL DEFAULT 'staff',    -- 'admin'|'manager'|'staff'
  avatar_url       TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  login_attempts   INT DEFAULT 0,
  locked_until     TIMESTAMP,
  last_login_at    TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE (platform, platform_user_id)
);
```

| Column | Type | Mô tả |
|--------|------|-------|
| `platform` | VARCHAR | Nền tảng: `zalo`, `telegram`, `discord`, `web` |
| `platform_user_id` | VARCHAR | User ID trên platform |
| `username` | VARCHAR | Dùng đăng nhập web (admin/manager/staff) |
| `must_change_pw` | BOOLEAN | Buộc đổi mật khẩu lần đăng nhập tiếp |
| `role` | ENUM | `admin`, `manager`, `staff` |
| `login_attempts` | INT | Đếm số lần sai mật khẩu; reset khi đăng nhập thành công |
| `locked_until` | TIMESTAMP | Khoá tạm thời nếu sai quá 5 lần |

---

## 📋 TABLE: refresh_tokens

```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,   -- SHA-256 của token thật
  family_id   UUID NOT NULL,          -- nhóm token cùng chuỗi rotate
  expires_at  TIMESTAMP NOT NULL,
  revoked_at  TIMESTAMP,              -- NULL = còn hiệu lực
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## 📋 TABLE: categories

```sql
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color       VARCHAR(7),    -- hex color, ví dụ "#52c41a"
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## 📋 TABLE: document_types

```sql
CREATE TABLE document_types (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 VARCHAR(80) NOT NULL UNIQUE,   -- snake_case, bất biến
  name                 VARCHAR(150) NOT NULL,
  description          TEXT,
  default_category_id  UUID REFERENCES categories(id),
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);
```

| Column | Mô tả |
|--------|-------|
| `code` | Mã nội bộ snake_case, không thay đổi sau khi tạo (ví dụ: `bank_transfer`) |
| `default_category_id` | Danh mục tự gán khi AI phân loại vào loại này |
| `is_active` | false = ẩn khỏi filter bar và dropdown |

---

## 📋 TABLE: document_type_fields

```sql
CREATE TABLE document_type_fields (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id UUID NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
  field_key        VARCHAR(80) NOT NULL,      -- [a-zA-Z0-9_], unique trong cùng type
  label            VARCHAR(150) NOT NULL,     -- nhãn hiển thị trên UI
  data_type        field_data_type NOT NULL,  -- 'text'|'number'|'date'|'datetime'|'boolean'|'json'|'money'
  unit             VARCHAR(30),               -- đơn vị (VD: 'VND', 'kg')
  is_required      BOOLEAN NOT NULL DEFAULT FALSE,
  is_filterable    BOOLEAN NOT NULL DEFAULT FALSE,  -- hiện trong filter bar pivot view
  is_reportable    BOOLEAN NOT NULL DEFAULT FALSE,  -- tính vào báo cáo tài chính
  aggregation_type VARCHAR(10) NOT NULL DEFAULT 'none', -- 'none'|'sum'|'avg'|'count'|'min'|'max'
  display_order    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (document_type_id, field_key)
);
```

---

## 📋 TABLE: records (BẢNG CHÍNH)

```sql
CREATE TABLE records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nguồn (platform-agnostic)
  platform             VARCHAR(20) NOT NULL DEFAULT 'telegram',  -- 'telegram'|'zalo'|'discord'|'manual'
  platform_message_id  VARCHAR(100),      -- ID tin nhắn trên platform (chống duplicate)
  source_chat_id       VARCHAR(100),
  source_chat_type     VARCHAR(20),       -- 'private'|'group'|'channel'
  sender_id            UUID REFERENCES users(id),
  sender_name          VARCHAR(100),      -- Cache tên tại thời điểm gửi

  -- Nội dung
  image_url            TEXT,             -- URL ảnh full (Cloudinary / S3)
  image_key            TEXT,             -- public_id / key trên storage (để delete/transform)
  thumbnail_url        TEXT,             -- URL thumbnail nhỏ
  ocr_text             TEXT,             -- Text nhận dạng từ ảnh (raw)
  note                 TEXT,             -- Ghi chú text kèm theo
  category_id          UUID REFERENCES categories(id),

  -- Phân loại AI
  document_type_id        UUID REFERENCES document_types(id),
  suggested_category_id   UUID REFERENCES categories(id),       -- AI gợi ý (chưa confirm)
  classification_confidence DECIMAL(5,4),                        -- 0.00–1.00
  schema_version          INTEGER DEFAULT 1,                     -- phiên bản schema khi trích xuất

  -- Kết quả trích xuất (JSON snapshot)
  extraction_status    VARCHAR(20) NOT NULL DEFAULT 'pending',   -- 'pending'|'done'|'needs_review'|'failed'
  extracted_data       JSONB,            -- snapshot toàn bộ field values tại thời điểm AI trả về

  -- Trạng thái record
  status               record_status NOT NULL DEFAULT 'new',     -- 'new'|'reviewed'|'approved'|'flagged'|'deleted'
  flag_reason          TEXT,

  -- Phê duyệt
  reviewed_by          UUID REFERENCES users(id),
  reviewed_at          TIMESTAMP,
  approved_by          UUID REFERENCES users(id),
  approved_at          TIMESTAMP,

  -- OCR metadata
  ocr_status           ocr_status NOT NULL DEFAULT 'pending',    -- 'pending'|'success'|'failed'
  ocr_confidence       DECIMAL(5,2),                             -- 0.00–100.00

  -- Timestamps
  received_at          TIMESTAMP NOT NULL,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW(),

  UNIQUE (platform, platform_message_id)
);

-- Indexes
CREATE INDEX idx_records_platform   ON records(platform);
CREATE INDEX idx_records_sender     ON records(sender_id);
CREATE INDEX idx_records_status     ON records(status);
CREATE INDEX idx_records_received   ON records(received_at DESC);
CREATE INDEX idx_records_category   ON records(category_id);
CREATE INDEX idx_records_doctype    ON records(document_type_id);
CREATE INDEX idx_records_fts        ON records USING gin(
  to_tsvector('simple',
    coalesce(note,'') || ' ' || coalesce(ocr_text,'') || ' ' || coalesce(sender_name,'')
  ));
```

**Luồng `ocr_status` và `extraction_status`:**

```
Tạo record (manual có ảnh / webhook)
   ocr_status = 'pending'
   extraction_status = 'pending'
         │
         ▼ (setImmediate — chạy nền)
   OCR Engine (Gemini Vision / Google Vision)
         │
   ┌─────┴──────┐
   ▼            ▼
 success      failed
   │            │
   ▼            ▼
 normalize   ocr_status='failed'
 AI extract  extraction_status='failed'
   │
   ▼
 upsert record_field_values
 ocr_status='success'
 extraction_status='done' (hoặc 'needs_review' nếu confidence thấp)
```

---

## 📋 TABLE: record_field_values

```sql
CREATE TABLE record_field_values (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id    UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  field_id     UUID NOT NULL REFERENCES document_type_fields(id) ON DELETE CASCADE,

  -- Giá trị lưu theo cột tương ứng data_type
  value_text   TEXT,
  value_number NUMERIC,
  value_date   DATE,
  value_bool   BOOLEAN,
  value_json   JSONB,

  source       VARCHAR(10) NOT NULL DEFAULT 'ai',  -- 'ai'|'human'|'rule'
  confidence   DECIMAL(4,2),                        -- 0.00–1.00
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE (record_id, field_id)
);

CREATE INDEX idx_rfv_record ON record_field_values(record_id);
CREATE INDEX idx_rfv_field  ON record_field_values(field_id);
```

| Column | Mô tả |
|--------|-------|
| `value_text/number/date/bool/json` | Lưu đúng cột theo `data_type` của field — tránh cast khi query |
| `source` | `ai` = AI trích xuất, `human` = người dùng sửa thủ công, `rule` = rule-based |
| `confidence` | Độ tin cậy AI (0–1); NULL nếu `source = human` |

---

## 📋 TABLE: edit_logs

```sql
CREATE TABLE edit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   UUID REFERENCES records(id),
  edited_by   UUID REFERENCES users(id),
  field_name  VARCHAR(50),   -- 'note', 'category_id', 'status', 'document_type_id', ...
  old_value   TEXT,
  new_value   TEXT,
  edited_at   TIMESTAMP DEFAULT NOW()
);
```

---

## 📋 TABLE: audit_logs (immutable)

```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(50) NOT NULL,   -- 'approve', 'flag', 'delete', 'login', ...
  target_type VARCHAR(30),            -- 'record', 'user', ...
  target_id   UUID,
  meta        JSONB,                  -- context tuỳ action
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
-- Không có UPDATE / DELETE — ghi một lần, giữ mãi
```

---

## 📋 TABLE: report_jobs

```sql
CREATE TABLE report_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    UUID REFERENCES users(id),
  report_type   VARCHAR(20),         -- 'daily'|'weekly'|'monthly'|'quarterly'|'custom'
  date_from     DATE NOT NULL,
  date_to       DATE NOT NULL,
  filter_user   UUID REFERENCES users(id),
  filter_cat    UUID REFERENCES categories(id),
  filter_status VARCHAR(20),
  status        VARCHAR(20) DEFAULT 'pending',  -- 'pending'|'processing'|'done'|'failed'
  file_url      TEXT,
  file_type     VARCHAR(10),         -- 'excel'|'pdf'
  error_msg     TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  completed_at  TIMESTAMP
);
```

---

## 🔢 Ví dụ dữ liệu mẫu

```sql
-- Record từ Telegram (tạo qua webhook)
INSERT INTO records (
  platform, platform_message_id, source_chat_id, source_chat_type,
  sender_name, note, ocr_text, ocr_status, extraction_status, status, received_at
) VALUES (
  'telegram', '12345678', '-100123456789', 'group',
  'Nguyễn Văn A',
  'Hóa đơn mua vật tư tháng 4',
  'SỐ HĐ: 001234 | NGÀY: 15/04/2026 | TỔNG: 2,500,000đ',
  'success', 'done', 'new',
  '2026-04-15 09:30:00'
);

-- Record tạo thủ công qua Web Form (có ảnh, đang chờ OCR)
INSERT INTO records (
  platform, sender_id, sender_name, note,
  image_url, image_key, thumbnail_url,
  ocr_status, extraction_status, status, received_at
) VALUES (
  'manual', 'uuid-user-01', 'Trần Thị B', 'Biên lai thanh toán',
  'https://res.cloudinary.com/.../img.jpg',
  'records/2026-04/img_uuid',
  'https://res.cloudinary.com/.../thumb.jpg',
  'pending', 'pending', 'new', NOW()
);
```

---

## 📈 Data Retention Policy

| Loại dữ liệu | Thời gian lưu |
|-------------|---------------|
| Records (đã duyệt) | 3 năm |
| Records (đã xóa) | 6 tháng rồi purge |
| Ảnh gốc (Cloudinary) | 1 năm |
| Thumbnail | 1 năm |
| record_field_values | Theo vòng đời record |
| Edit logs | 1 năm |
| Audit logs | Vĩnh viễn (immutable) |
| Report files | 6 tháng |
