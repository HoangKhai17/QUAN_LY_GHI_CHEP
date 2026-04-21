# 💾 DATABASE SCHEMA — T&D COMPANY
> Phiên bản: 1.0 | Cập nhật: 2026-04-20

---

## 📊 Entity Relationship Overview

```
┌──────────┐       ┌──────────────┐       ┌──────────────┐
│  users   │──1:N──│   records    │──N:1──│  categories  │
└──────────┘       └──────┬───────┘       └──────────────┘
                          │
                    ┌─────┴──────┐
                    │            │
             ┌──────────┐  ┌──────────────┐
             │edit_logs │  │  report_jobs │
             └──────────┘  └──────────────┘
```

---

## 📋 TABLE: users

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zalo_id       VARCHAR(50) UNIQUE,        -- Zalo User ID
  name          VARCHAR(100) NOT NULL,
  role          ENUM('manager', 'staff') DEFAULT 'staff',
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | UUID | Primary key |
| `zalo_id` | VARCHAR | ID Zalo định danh người dùng |
| `name` | VARCHAR | Tên hiển thị từ Zalo |
| `role` | ENUM | `manager` hoặc `staff` |

---

## 📋 TABLE: categories

```sql
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  color       VARCHAR(7),    -- hex color, ví dụ "#FF5733"
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## 📋 TABLE: records (BẢNG CHÍNH)

```sql
CREATE TABLE records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Thông tin nguồn Zalo
  zalo_message_id VARCHAR(100) UNIQUE,   -- ID tin nhắn Zalo (tránh duplicate)
  sender_id       UUID REFERENCES users(id),
  sender_name     VARCHAR(100),          -- Cache tên tại thời điểm gửi
  zalo_group_id   VARCHAR(100),          -- ID Zalo Group nguồn

  -- Nội dung
  image_url       TEXT,                  -- URL ảnh trên Storage
  image_thumbnail TEXT,                  -- URL thumbnail nhỏ
  ocr_text        TEXT,                  -- Text nhận dạng từ ảnh
  note            TEXT,                  -- Ghi chú text kèm theo từ Zalo
  category_id     UUID REFERENCES categories(id),

  -- Trạng thái
  status          ENUM('new', 'reviewed', 'approved', 'flagged', 'deleted')
                  DEFAULT 'new',
  flag_reason     TEXT,                  -- Lý do flag (nếu có)

  -- Phê duyệt
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMP,
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMP,

  -- OCR metadata
  ocr_status      ENUM('pending', 'success', 'failed') DEFAULT 'pending',
  ocr_confidence  DECIMAL(5,2),          -- Độ tin cậy OCR (0-100%)

  -- Timestamps
  received_at     TIMESTAMP NOT NULL,    -- Thời điểm nhận từ Zalo
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Indexes cho tìm kiếm
CREATE INDEX idx_records_sender    ON records(sender_id);
CREATE INDEX idx_records_status    ON records(status);
CREATE INDEX idx_records_received  ON records(received_at);
CREATE INDEX idx_records_category  ON records(category_id);
CREATE INDEX idx_records_fts       ON records USING gin(to_tsvector('simple', coalesce(note,'') || ' ' || coalesce(ocr_text,'')));
```

---

## 📋 TABLE: edit_logs

```sql
CREATE TABLE edit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   UUID REFERENCES records(id),
  edited_by   UUID REFERENCES users(id),
  field_name  VARCHAR(50),     -- Trường bị sửa: 'note', 'category_id', 'status'
  old_value   TEXT,
  new_value   TEXT,
  edited_at   TIMESTAMP DEFAULT NOW()
);
```

---

## 📋 TABLE: report_jobs

```sql
CREATE TABLE report_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    UUID REFERENCES users(id),

  -- Cấu hình báo cáo
  report_type   ENUM('daily', 'weekly', 'monthly', 'quarterly', 'custom'),
  date_from     DATE NOT NULL,
  date_to       DATE NOT NULL,
  filter_user   UUID REFERENCES users(id),    -- NULL = tất cả
  filter_cat    UUID REFERENCES categories(id), -- NULL = tất cả
  filter_status VARCHAR(20),                   -- NULL = tất cả

  -- Kết quả
  status        ENUM('pending', 'processing', 'done', 'failed') DEFAULT 'pending',
  file_url      TEXT,          -- URL file Excel/PDF sau khi tạo xong
  file_type     ENUM('excel', 'pdf'),
  error_msg     TEXT,

  created_at    TIMESTAMP DEFAULT NOW(),
  completed_at  TIMESTAMP
);
```

---

## 🔢 Ví dụ dữ liệu mẫu

```sql
-- Record mẫu
INSERT INTO records (
  zalo_message_id, sender_name, note, ocr_text, status, received_at
) VALUES (
  'zalo_msg_001',
  'Nguyễn Văn A',
  'Hóa đơn mua vật tư tháng 4',
  'SỐ HĐ: 001234 | NGÀY: 15/04/2026 | TỔNG: 2,500,000đ',
  'new',
  '2026-04-15 09:30:00'
);
```

---

## 📈 Data Retention Policy

| Loại dữ liệu | Thời gian lưu |
|-------------|---------------|
| Records (đã duyệt) | 3 năm |
| Records (đã xóa) | 6 tháng rồi purge |
| Ảnh gốc | 1 năm |
| Thumbnail | 1 năm |
| Edit logs | 1 năm |
| Report files | 6 tháng |
