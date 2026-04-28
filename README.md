# BBOTECH — Quản Lý Ghi Chép

Hệ thống quản lý chứng từ nội bộ doanh nghiệp: nhận ảnh từ **Telegram / Zalo**, dùng **AI (Gemini 2.5 Flash)** trích xuất nội dung tự động, manager duyệt qua dashboard web.

---

## Tính năng chính

| Module | Mô tả |
|--------|-------|
| **Webhook đa nền tảng** | Nhận tin nhắn / ảnh từ Telegram, Zalo, Discord |
| **AI OCR** | Gemini 2.5 Flash tự động nhận dạng và phân loại chứng từ |
| **Dynamic Document Types** | Định nghĩa loại tài liệu & trường dữ liệu không cần sửa code |
| **Workflow duyệt** | new → reviewed → approved / flagged — audit trail đầy đủ |
| **File Storage** | Upload lên Cloudinary, signed URL có thời hạn |
| **Realtime** | Socket.io — badge cập nhật tức thì khi có record mới |
| **Báo cáo (9 tabs)** | Tổng quan, Tài chính, Nhân viên, Heatmap, SLA, Tồn đọng, Xu hướng, Audit, Xuất file |
| **Xuất báo cáo** | Excel XLSX (header có style, freeze row, auto-filter) + CSV UTF-8 BOM |
| **RBAC** | 3 cấp: admin / manager / staff |
| **Audit logging** | Ghi lại mọi thao tác, archive cold storage định kỳ |

---

## Tech stack

```
Backend         Node.js 20 + Express 5
Database        PostgreSQL 15 (Docker) + Redis 7
Auth            JWT access (15m) + Refresh token (7d, rotation)
AI              Google Gemini 2.5 Flash (OCR + phân loại)
Storage         Cloudinary (signed URL)
Realtime        Socket.io
Excel export    ExcelJS
Logging         Winston (file) + audit_logs table (PostgreSQL RLS)
Frontend        React 19 + Vite 8 + Zustand + Ant Design 6
```

---

## Kiến trúc

```
┌──────────────────────────────────────────────────────────────┐
│  Nguồn dữ liệu                                               │
│  Telegram Bot ──┐                                            │
│  Zalo OA ───────┼──▶  POST /webhook  ──▶  message.processor │
│  Web (manual) ──┘              │                             │
│                                ▼                             │
│                    AI OCR (Gemini 2.5 Flash)                 │
│                    Cloudinary upload                         │
│                    records + record_field_values             │
│                                │                             │
│                    Socket.io ──▶  Dashboard / Frontend       │
└──────────────────────────────────────────────────────────────┘

Database (13 migrations):
  users  ·  categories  ·  records  ·  record_field_values
  document_types  ·  document_type_fields
  audit_logs  ·  audit_logs_archive  ·  edit_logs
  refresh_tokens  ·  system_settings  ·  report_jobs
```

---

## Cài đặt & Chạy

### Yêu cầu

- **Node.js** ≥ 20
- **Docker Desktop** (cho PostgreSQL + Redis)
- Tài khoản **Cloudinary** (free tier đủ dùng)
- API key **Google Gemini** — lấy miễn phí tại [aistudio.google.com](https://aistudio.google.com)

---

### 1. Clone & cấu hình

```bash
git clone <repo-url>
cd QUAN_LY_GHI_CHEP
```

Tạo `backend/.env` theo mẫu trong phần **Biến môi trường** bên dưới.

---

### 2. Khởi động Database

```bash
docker compose up -d
```

Khởi động:
- **PostgreSQL 15** tại `localhost:5433` — container `qlgc_postgres`
- **Redis 7** tại `localhost:6379` — container `qlgc_redis`

```bash
docker compose ps   # cả 2 phải ở trạng thái healthy
```

---

### 3. Backend

```bash
cd backend
npm install

# Tạo toàn bộ schema (chạy 13 migrations theo thứ tự)
npm run migrate

# Tạo tài khoản admin lần đầu
npm run create-admin -- --username admin --password "Admin@2026!"

# (Tùy chọn) Seed dữ liệu demo
npm run seed:demo

# Chạy dev server với hot-reload
npm run dev
```

Backend: `http://localhost:3000`
Swagger UI: `http://localhost:3000/api-docs`

---

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

---

### 5. Telegram Webhook (tùy chọn)

Cần URL public. Trong môi trường dev dùng ngrok:

```bash
ngrok http 3000
```

Cập nhật `backend/.env`:

```env
TELEGRAM_BOT_TOKEN=<token từ @BotFather>
WEBHOOK_BASE_URL=https://<id>.ngrok-free.app
```

Khởi động lại backend — webhook tự đăng ký khi server start.

---

## Biến môi trường (`backend/.env`)

| Biến | Bắt buộc | Mô tả |
|------|:--------:|-------|
| `PORT` | | Cổng backend, mặc định `3000` |
| `NODE_ENV` | | `development` \| `production` |
| `FRONTEND_URL` | ✅ | Origin frontend — dùng cho CORS |
| `DB_HOST` | ✅ | PostgreSQL host (mặc định `localhost`) |
| `DB_PORT` | ✅ | PostgreSQL port (mặc định `5433`) |
| `DB_NAME` | ✅ | Tên database |
| `DB_USER` | ✅ | PostgreSQL user |
| `DB_PASSWORD` | ✅ | PostgreSQL password |
| `JWT_ACCESS_SECRET` | ✅ | Secret ký access token |
| `JWT_ACCESS_EXPIRES` | | Hết hạn access token, mặc định `15m` |
| `JWT_REFRESH_SECRET` | ✅ | Secret ký refresh token |
| `JWT_REFRESH_EXPIRES` | | Hết hạn refresh token, mặc định `7d` |
| `CLOUDINARY_URL` | ✅ | URL kết nối Cloudinary (lấy từ dashboard) |
| `STORAGE_PROVIDER` | | `cloudinary` (mặc định) |
| `SIGNED_URL_EXPIRES` | | Thời gian signed URL (giây), mặc định `3600` |
| `AI_PROVIDER` | | `gemini` (mặc định) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `GEMINI_MODEL` | | Model ID, mặc định `gemini-2.5-flash` |
| `TELEGRAM_BOT_TOKEN` | | Token bot Telegram (từ @BotFather) |
| `WEBHOOK_BASE_URL` | | URL public nhận webhook (ngrok khi dev) |
| `SETTINGS_ENCRYPTION_KEY` | ✅ | Hex 64 ký tự — mã hoá secrets trong `system_settings`. **Không thay đổi sau khi đã có dữ liệu.** |
| `REDIS_URL` | | Redis URL, mặc định `redis://localhost:6379` |

---

## Cấu trúc thư mục

```
QUAN_LY_GHI_CHEP/
├── backend/
│   ├── src/
│   │   ├── app.js                  # Entry point — Express + Socket.io
│   │   ├── config/
│   │   │   ├── db.js               # pg Pool singleton
│   │   │   └── swagger.js          # OpenAPI 3.0 spec (viết tay, ~2300 lines)
│   │   ├── db/
│   │   │   ├── migrate.js          # Runner chạy migrations theo thứ tự
│   │   │   ├── migrations/         # 001 → 013 SQL files (idempotent)
│   │   │   └── seeds/              # Dữ liệu demo + tạo admin
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js  # requireAuth — xác thực JWT
│   │   │   └── rbac.middleware.js  # requireRole(...roles)
│   │   ├── modules/
│   │   │   ├── auth/               # login, refresh, logout, change-password
│   │   │   ├── users/              # CRUD user, reset PW, đổi role
│   │   │   ├── records/            # Core workflow — tạo, xem, duyệt, xóa
│   │   │   ├── document-types/     # Loại tài liệu động + field definitions
│   │   │   ├── categories/         # Danh mục phân loại
│   │   │   ├── reports/            # 9 endpoints phân tích + export file
│   │   │   ├── dashboard/          # Thống kê nhanh (today, week, pending)
│   │   │   ├── search/             # Full-text search (PostgreSQL GIN index)
│   │   │   ├── notifications/      # Badge pending count
│   │   │   ├── settings/           # System settings (AES-256-GCM encrypted)
│   │   │   └── webhook/            # Telegram / Zalo message processor
│   │   └── services/
│   │       └── audit.service.js    # logAudit() — fire-and-forget
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard/          # Overview cards + timeline
│   │   │   ├── Records/            # Danh sách + chi tiết record
│   │   │   ├── Reports/            # 9 tabs báo cáo
│   │   │   ├── Settings/           # Cài đặt hệ thống
│   │   │   └── ...
│   │   ├── services/               # axios wrappers cho từng module API
│   │   ├── store/                  # Zustand global state
│   │   └── components/             # Shared UI components
│   └── package.json
│
├── docker-compose.yml              # PostgreSQL 15 + Redis 7
└── docs/                           # Tài liệu nội bộ, build plan
```

---

## API Quick Start

```bash
# 1. Đăng nhập lấy token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@2026!"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Lấy danh sách records (trang 1, 20 records)
curl "http://localhost:3000/api/records?limit=20&page=1" \
  -H "Authorization: Bearer $TOKEN"

# 3. Xuất báo cáo Excel (records tháng 4/2026)
curl "http://localhost:3000/api/reports/export?type=records&format=xlsx&date_from=2026-04-01&date_to=2026-04-30" \
  -H "Authorization: Bearer $TOKEN" \
  --output report.xlsx

# 4. Swagger UI đầy đủ (38 endpoints)
open http://localhost:3000/api-docs
```

---

## Phân quyền RBAC

| Quyền | admin | manager | staff |
|-------|:-----:|:-------:|:-----:|
| Xem records | ✅ | ✅ | ✅ |
| Tạo record thủ công | ✅ | ✅ | ✅ |
| Duyệt / Flag record | ✅ | ✅ | ❌ |
| Tạo user | ✅ | ✅ | ❌ |
| Deactivate / Reset PW / Đổi role | ✅ | ❌ | ❌ |
| Tạo / sửa DocumentType & Category | ✅ | ✅ | ❌ |
| Xóa field DocumentType | ✅ | ❌ | ❌ |
| Xem báo cáo & xuất file | ✅ | ✅ | ❌ |
| Xem / Xuất Audit logs | ✅ | ✅ | ❌ |
| Archive audit logs cũ | ✅ | ❌ | ❌ |

---

## Migrations

Migrations chạy theo thứ tự số tiền tố, mỗi file phải **idempotent** (`IF NOT EXISTS` / `IF EXISTS`).

```bash
# Chạy tất cả migrations chưa chạy
npm run migrate --prefix backend

# Thêm migration mới
# 1. Tạo file: backend/src/db/migrations/014_your_change.sql
# 2. Viết SQL idempotent
# 3. Chạy lại npm run migrate
```

| # | File | Mô tả |
|---|------|-------|
| 001 | `create_users` | Bảng users, roles, auth fields |
| 002 | `create_categories` | Danh mục phân loại |
| 003 | `create_records` | Bảng records chính + status enum |
| 004 | `create_edit_logs` | Lịch sử chỉnh sửa field values |
| 005 | `create_report_jobs` | Hàng đợi tạo báo cáo |
| 006 | `create_audit_logs` | Nhật ký hoạt động (RLS, chỉ INSERT + SELECT) |
| 007 | `platform_agnostic` | Hỗ trợ đa nền tảng, thêm cột `platform` |
| 008 | `cleanup_zalo_columns` | Dọn dẹp schema sau platform refactor |
| 009 | `auth_hardening` | Account lockout, `must_change_pw`, refresh tokens |
| 010 | `document_schema` | Loại tài liệu động + `record_field_values` |
| 011 | `performance_indexes` | GIN full-text, composite indexes |
| 012 | `system_settings` | Bảng cài đặt hệ thống, AES-256-GCM |
| 013 | `audit_archive` | Bảng cold storage `audit_logs_archive` |

---

## Truy cập Database

```bash
# Vào psql trong container Docker
docker exec -it qlgc_postgres psql -U admin -d quan_ly_ghi_chep

# Xem danh sách bảng
\dt

# Thống kê nhanh
SELECT status, COUNT(*) FROM records GROUP BY status ORDER BY count DESC;

# Thoát
\q
```

---

## Lưu ý vận hành

**Encryption key** — `SETTINGS_ENCRYPTION_KEY` không được thay đổi sau khi có dữ liệu trong `system_settings`. Mất key đồng nghĩa với mất khả năng đọc secrets đã lưu.

**Audit logs** — Bảng được bảo vệ bởi Row Level Security (chỉ INSERT + SELECT, không UPDATE/DELETE). Để dọn dẹp định kỳ, dùng endpoint `POST /api/reports/audit/archive?months=12` (admin only) — dữ liệu chuyển sang `audit_logs_archive`, không bị xóa vĩnh viễn.

**Token theft detection** — Refresh token xoay vòng mỗi lần dùng. Nếu token cũ bị tái sử dụng, toàn bộ session của user bị thu hồi.

**Rate limiting** — 100 req/phút cho `/api/*`, 500 req/phút cho `/webhook`.
