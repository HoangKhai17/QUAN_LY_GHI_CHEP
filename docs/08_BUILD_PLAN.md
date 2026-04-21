# 🏗️ BUILD PLAN CHI TIẾT — QUAN LY GHI CHEP
> Phiên bản: 2.0 | Cập nhật: 2026-04-21 (bổ sung Security + Observability + Roadmap)

---

## 📌 NGUYÊN TẮC BUILD

```
Core trước → Features sau → Polish cuối
Backend API ổn định trước khi làm Frontend
Test từng phần nhỏ, không build "hết rồi test"
```

**Thứ tự ưu tiên:** Data Pipeline → API → UI cơ bản → Features → Realtime → Report → Search

---

## 🗂️ CẤU TRÚC THƯ MỤC ĐỀ XUẤT

```
QUAN_LY_GHI_CHEP/
├── backend/                   ← Node.js + Express
│   ├── src/
│   │   ├── config/            ← env, DB config
│   │   ├── db/
│   │   │   ├── migrations/    ← SQL migration files (001→006)
│   │   │   └── seeds/         ← seed data
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js      ← JWT verify
│   │   │   ├── rbac.middleware.js      ← Phân quyền role
│   │   │   ├── rateLimiter.js          ← Rate limiting
│   │   │   └── zaloSignature.js        ← HMAC-SHA256 verify
│   │   ├── modules/
│   │   │   ├── zalo/          ← Webhook receiver, parser
│   │   │   ├── records/       ← CRUD records
│   │   │   ├── reports/       ← Tạo báo cáo
│   │   │   ├── search/        ← Full-text search
│   │   │   ├── auth/          ← Authentication + JWT
│   │   │   └── notifications/ ← WebSocket / Socket.io
│   │   ├── services/
│   │   │   ├── ocr.service.js
│   │   │   ├── storage.service.js    ← Signed URL generation
│   │   │   ├── report.service.js
│   │   │   └── audit.service.js      ← Ghi audit log
│   │   └── app.js
│   ├── .env.example           ← COMMIT lên git (không có giá trị thật)
│   ├── .env                   ← KHÔNG commit (.gitignore)
│   └── package.json
│
├── frontend/                  ← React + Vite + Ant Design
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login/
│   │   │   ├── Dashboard/
│   │   │   ├── Records/       ← Danh sách + chi tiết
│   │   │   ├── QuickReview/
│   │   │   ├── Search/
│   │   │   └── Reports/
│   │   ├── components/        ← Shared UI components
│   │   ├── services/          ← API calls
│   │   ├── store/             ← State management (Zustand/Redux)
│   │   └── App.jsx
│   └── package.json
│
├── docker-compose.yml         ← PostgreSQL + Redis local
├── docs/
└── README.md
```

---

## 📅 PHASE 0 — FOUNDATION & SETUP
> **Thời gian:** 2 ngày | **Mục tiêu:** Môi trường sẵn sàng để code

### Step 0.1 — Khởi tạo project structure
```bash
# Tạo thư mục backend
mkdir backend && cd backend
npm init -y
npm install express cors dotenv helmet morgan pg uuid

# Tạo thư mục frontend
npx create-vite@latest frontend --template react
cd frontend && npm install antd @ant-design/icons axios zustand react-router-dom
```

**Packages backend cần cài:**
| Package | Mục đích |
|---------|---------|
| `express` | Web framework |
| `pg` | PostgreSQL client |
| `dotenv` | Biến môi trường |
| `helmet` | Security headers |
| `morgan` | HTTP logging |
| `multer` | Upload file |
| `uuid` | Generate UUID |
| `jsonwebtoken` | JWT auth |
| `socket.io` | Realtime |
| `exceljs` | Export Excel |
| `pdfkit` | Export PDF |
| `@google-cloud/vision` | OCR |
| `aws-sdk` hoặc `cloudinary` | File storage |
| `axios` | HTTP client (gọi Zalo API) |

### Step 0.2 — Docker Compose local
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: quan_ly_ghi_chep
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:          # dùng cho job queue báo cáo sau này
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

```bash
docker-compose up -d
```

### Step 0.3 — Database migrations
Tạo và chạy theo thứ tự:

```
backend/src/db/migrations/
├── 001_create_users.sql
├── 002_create_categories.sql
├── 003_create_records.sql
├── 004_create_edit_logs.sql
├── 005_create_report_jobs.sql
└── 006_create_audit_logs.sql    ← BẮT BUỘC (security compliance)
```

**Migration 006 — audit_logs:**
```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(50) NOT NULL,   -- 'approve','flag','delete','login','edit'
  resource    VARCHAR(50),            -- 'record','user','report'
  resource_id UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
-- IMMUTABLE: không có UPDATE/DELETE quyền trên bảng này
-- Dùng PostgreSQL RLS để enforce
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_insert_only ON audit_logs FOR INSERT WITH CHECK (true);
```

**Script migration runner** (`backend/src/db/migrate.js`):
```js
// Chạy tuần tự từng file .sql theo thứ tự số
// node src/db/migrate.js
```

**Kiểm tra:** Connect DBeaver/TablePlus vào localhost:5432, xác nhận đủ 5 bảng.

### Step 0.4 — Cấu hình .env
```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=quan_ly_ghi_chep
DB_USER=admin
DB_PASSWORD=secret

# JWT — Access Token ngắn + Refresh Token dài (theo 05_SECURITY.md)
JWT_ACCESS_SECRET=your_access_secret_here
JWT_ACCESS_EXPIRES=15m          # 15 phút
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_REFRESH_EXPIRES=7d          # 7 ngày

# Zalo
ZALO_OA_TOKEN=
ZALO_WEBHOOK_SECRET=            # Dùng để verify HMAC-SHA256

# Storage (chọn 1)
CLOUDINARY_URL=
# hoặc AWS_S3_BUCKET= / AWS_REGION= / AWS_ACCESS_KEY_ID= / AWS_SECRET_ACCESS_KEY=
SIGNED_URL_EXPIRES=3600         # URL ảnh hết hạn sau 1 giờ

# OCR
GOOGLE_VISION_KEY_FILE=./credentials/google-vision.json

# Monitoring
SENTRY_DSN=                     # Lấy từ sentry.io (tạo free account)

# Redis (cho job queue báo cáo)
REDIS_URL=redis://localhost:6379
```

**Thêm vào .gitignore:**
```
.env
credentials/
*.key
*.pem
```

### Step 0.5 — Security headers (Helmet)

**File:** `src/app.js`
```js
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

app.use(helmet())  // Tự động thêm X-Frame-Options, X-Content-Type, HSTS...

// Rate limiting: 100 request/phút/IP
const limiter = rateLimit({ windowMs: 60_000, max: 100 })
app.use('/api/', limiter)

// Webhook có rate limit riêng (loose hơn vì Zalo gọi nhiều)
const webhookLimiter = rateLimit({ windowMs: 60_000, max: 500 })
app.use('/webhook/', webhookLimiter)
```

```bash
npm install express-rate-limit
```

---

## 📅 PHASE 1 — CORE BACKEND: MULTI-PLATFORM CONNECTOR PIPELINE
> **Thời gian:** 5 ngày | **Mục tiêu:** Nhận tin nhắn từ Telegram/Zalo → lưu DB tự động

### Kiến trúc Connector Pattern (đã implement)

```
POST /webhook/telegram  ─►  TelegramConnector.verify() → .parse()  ─►
POST /webhook/zalo      ─►  ZaloConnector.verify()     → .parse()  ─►  MessageProcessor → DB
POST /webhook/discord   ─►  DiscordConnector (tương lai)           ─►

src/connectors/
├── index.js                  ← Registry: { zalo, telegram, discord... }
├── normalized-message.js     ← Format chuẩn hóa dùng chung
├── base.connector.js         ← Interface: verify() / parse() / downloadImage() / reply()
├── zalo/
│   ├── zalo.connector.js     ← HMAC-SHA256 verify, Zalo API download
│   └── zalo.parser.js        ← Zalo payload → NormalizedMessage
└── telegram/
    ├── telegram.connector.js ← Secret token verify, getFile download
    └── telegram.parser.js    ← Telegram Update → NormalizedMessage

src/modules/webhook/
├── webhook.router.js         ← POST /webhook/:platform (tự động route)
└── message.processor.js      ← NormalizedMessage → OCR → DB → WebSocket
```

**Thêm platform mới sau này chỉ cần:**
1. Tạo `src/connectors/<platform>/` implement BaseConnector
2. Đăng ký 1 dòng trong `connectors/index.js`
3. Thêm env var token vào `.env`

### Step 1.1 — Express app skeleton
```
src/app.js              ← Express setup, middleware, route loader
src/config/db.js        ← pg Pool connection
src/config/env.js       ← validate required env vars
```

Cấu trúc mỗi module:
```
src/modules/records/
├── records.router.js   ← route definitions
├── records.service.js  ← business logic
└── records.repo.js     ← DB queries (raw SQL với pg)
```

### Step 1.2 — Zalo Webhook receiver

**File:** `src/modules/zalo/zalo.router.js`

```
POST /webhook/zalo
  ├── Xác thực chữ ký Zalo (HMAC-SHA256) — BẮT BUỘC
  ├── Parse body JSON từ Zalo
  └── Gọi zalo.service.js để xử lý
```

**Middleware xác thực chữ ký — `src/middlewares/zaloSignature.js`:**
```js
const crypto = require('crypto')

function verifyZaloSignature(req, res, next) {
  const signature = req.headers['x-zalo-signature']
  const body = JSON.stringify(req.body)
  const expected = crypto
    .createHmac('sha256', process.env.ZALO_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')

  // Dùng timingSafeEqual để chống timing attack
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature || ''),
    Buffer.from(expected)
  )
  if (!isValid) return res.status(403).json({ error: 'Invalid signature' })
  next()
}
```

**Ngrok cho local dev:**
```bash
# Cài ngrok: https://ngrok.com
ngrok http 3000
# → URL: https://abc123.ngrok.io
# → Vào Zalo OA Dashboard → cấu hình Webhook URL = https://abc123.ngrok.io/webhook/zalo
# → Xem request log: http://localhost:4040 (ngrok inspector — có thể replay)
```

**Zalo message types cần handle:**
| Type từ Zalo | Hành động |
|-------------|-----------|
| `text` | Lưu note, không có ảnh |
| `image` | Download ảnh, chạy OCR |
| `photo` + caption | Lưu cả ảnh + text |
| `sticker`, `audio`, `video` | Log & bỏ qua |

**Lưu ý:** Zalo OA API cần verify webhook URL trước khi nhận events thật.
Dùng `ngrok` để expose localhost khi dev.

### Step 1.3 — Message Parser

**File:** `src/modules/zalo/zalo.parser.js`

```js
function parseZaloMessage(payload) {
  return {
    zalo_message_id: payload.event_data.message.msg_id,
    sender_zalo_id: payload.sender.id,
    sender_name: payload.sender.display_name,
    zalo_group_id: payload.recipient.id,
    message_type: detectType(payload),  // 'image_text' | 'image_only' | 'text_only' | 'ignore'
    image_attachment: extractImage(payload),
    text_note: extractText(payload),
    received_at: new Date(payload.timestamp * 1000)
  }
}
```

### Step 1.4 — Storage Service

**File:** `src/services/storage.service.js`

```
uploadImage(buffer, filename)
  └── Upload lên Cloudinary / S3
  └── Trả về { image_url, thumbnail_url }
```

**Lưu ý Cloudinary:** Tự động tạo thumbnail bằng transformation URL, không cần upload riêng.

### Step 1.5 — OCR Service

**File:** `src/services/ocr.service.js`

```
extractText(imageUrl)
  ├── Gọi Google Vision API annotateImage
  ├── [Success] → return { text, confidence }
  └── [Error]   → return { text: null, confidence: 0, error: msg }
```

**Fallback:** Nếu không có Google Vision key, dùng Tesseract.js (offline, chậm hơn):
```bash
npm install tesseract.js
```

### Step 1.6 — Zalo Service (orchestrator)

**File:** `src/modules/zalo/zalo.service.js`

```
processIncomingMessage(parsedMsg)
  1. Kiểm tra duplicate (zalo_message_id đã tồn tại chưa?)
  2. Upsert user vào bảng users (tạo mới nếu chưa có)
  3. Nếu có ảnh:
     a. Download ảnh từ Zalo API
     b. Upload lên Storage → lấy image_url
     c. Chạy OCR → lấy ocr_text
  4. INSERT vào bảng records (status = 'new')
  5. Emit WebSocket event 'new_record' cho Dashboard
```

**Kiểm tra Phase 1:**
- [ ] Gửi ảnh vào Zalo Group → record xuất hiện trong DB
- [ ] Gửi text vào Zalo Group → record lưu note
- [ ] Gửi sticker → không tạo record
- [ ] Duplicate message → không insert lần 2

---

## 📅 PHASE 2 — BACKEND API
> **Thời gian:** 4 ngày | **Mục tiêu:** API đầy đủ cho Frontend gọi

### Step 2.1 — Authentication (JWT Access + Refresh Token)

Theo thiết kế trong `05_SECURITY.md`: Access Token ngắn (15 phút) + Refresh Token dài (7 ngày).

```
POST /api/auth/login
  Body: { username, password }
  → Verify password (bcrypt)
  → Generate access_token (JWT, 15 phút, ký bằng JWT_ACCESS_SECRET)
  → Generate refresh_token (JWT, 7 ngày, ký bằng JWT_REFRESH_SECRET)
  → Lưu hash(refresh_token) vào DB (bảng refresh_tokens)
  Response: { access_token, refresh_token, user: { id, name, role } }

POST /api/auth/refresh
  Body: { refresh_token }
  → Verify refresh_token
  → Kiểm tra hash tồn tại trong DB (chống reuse sau logout)
  → Generate access_token mới
  Response: { access_token }

POST /api/auth/logout
  → Xóa refresh_token khỏi DB
  Response: { success: true }

GET /api/auth/me          ← Lấy thông tin user hiện tại (cần access_token)
```

**Middleware auth — `src/middlewares/auth.middleware.js`:**
```js
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' })
  }
}
```

**Middleware RBAC — `src/middlewares/rbac.middleware.js`:**
```js
// Dùng: router.get('/users', requireRole('admin'), ...)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}
```

**Bảng thêm vào migration:**
```sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,           -- sha256(refresh_token), không lưu raw
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

**Account lockout sau 5 lần sai:** Lưu `login_attempts` + `locked_until` vào bảng users.

Middleware `requireAuth` dùng cho tất cả routes bên dưới.

### Step 2.2 — Records API

```
GET  /api/records
  Query params:
    status=new|reviewed|approved|flagged
    sender_id=uuid
    category_id=uuid
    date_from=YYYY-MM-DD
    date_to=YYYY-MM-DD
    page=1 (default)
    limit=20 (default)
  Response: { data: [...], total, page, total_pages }

GET  /api/records/:id
  Response: record đầy đủ (kèm sender info, category info)

PATCH /api/records/:id/status
  Body: { status: 'approved'|'flagged', flag_reason?: string }
  Side effect: nếu flagged → gửi thông báo Zalo lại cho nhân viên

PATCH /api/records/:id
  Body: { note?, category_id? }
  Side effect: insert vào edit_logs

DELETE /api/records/:id
  Soft delete: status = 'deleted'
```

### Step 2.2b — Audit Log tự động

Mọi action quan trọng phải ghi vào `audit_logs`. Tạo service tái dùng:

```js
// src/services/audit.service.js
async function logAudit({ userId, action, resource, resourceId, oldData, newData, req }) {
  await db.query(
    `INSERT INTO audit_logs (user_id, action, resource, resource_id, old_data, new_data, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [userId, action, resource, resourceId,
     JSON.stringify(oldData), JSON.stringify(newData),
     req.ip, req.headers['user-agent']]
  )
}
```

**Các action cần log:**
| Action | Khi nào |
|--------|---------|
| `login` | Đăng nhập (cả thành công lẫn thất bại) |
| `approve` | Duyệt record |
| `flag` | Flag record |
| `edit` | Sửa note/category |
| `delete` | Xóa record |
| `report_create` | Tạo báo cáo |

### Step 2.3 — Dashboard Summary API

```
GET /api/dashboard/summary
  Response:
  {
    today: { total, new, reviewed, approved, flagged },
    this_week: { total },
    pending_review: 8   ← số records status='new' chưa đọc
  }
```

### Step 2.4 — Search API

```
GET /api/search
  Query params:
    q=từ khóa                    ← full-text search note + ocr_text
    sender_name=Nguyễn A         ← filter tên
    date_from, date_to
    status
    category_id
    page, limit
  
  SQL dùng PostgreSQL full-text search:
  WHERE to_tsvector('simple', note || ' ' || ocr_text) @@ plainto_tsquery('simple', $q)
```

### Step 2.5 — Categories API

```
GET  /api/categories          ← Lấy danh sách categories
POST /api/categories          ← Tạo category mới
PUT  /api/categories/:id      ← Cập nhật
```

### Step 2.6 — Users API (nội bộ)

```
GET /api/users                ← Danh sách nhân viên (để filter báo cáo)
```

**Kiểm tra Phase 2:** Dùng Postman/Insomnia test tất cả endpoints, kèm collection export lưu vào `docs/api.postman_collection.json`.

---

## 📅 PHASE 3 — FRONTEND: AUTH & LAYOUT
> **Thời gian:** 2 ngày | **Mục tiêu:** Login hoạt động, layout sidebar cơ bản

### Step 3.1 — Setup Router & Layout

```
src/App.jsx
  ├── / → redirect /dashboard
  ├── /login → <LoginPage>
  └── /app/* → <AppLayout> (yêu cầu đã login)
       ├── /app/dashboard → <DashboardPage>
       ├── /app/records/:id → <RecordDetailPage>
       ├── /app/quick-review → <QuickReviewPage>
       ├── /app/search → <SearchPage>
       └── /app/reports → <ReportsPage>
```

### Step 3.2 — Login Page

```
src/pages/Login/index.jsx
  ├── Form: username + password
  ├── Gọi POST /api/auth/login
  ├── Lưu token vào localStorage
  └── Redirect về /app/dashboard
```

### Step 3.3 — App Layout (Sidebar + Header)

```
src/components/AppLayout/
├── Sidebar.jsx     ← Ant Design <Layout.Sider>
│   ├── 🏠 Dashboard
│   ├── ⚡ Rà soát nhanh
│   ├── 🔍 Tìm kiếm
│   └── 📊 Báo cáo
└── Header.jsx      ← Tên user + 🔔 Bell badge + Logout
```

### Step 3.4 — API Service layer

```
src/services/api.js
  ├── axios instance với baseURL + token interceptor
  ├── Auto 401 → redirect login

src/services/records.api.js
src/services/search.api.js
src/services/reports.api.js
```

### Step 3.5 — Global State (Zustand)

```
src/store/auth.store.js       ← user info, token
src/store/notifications.store.js  ← số records mới chưa đọc
```

---

## 📅 PHASE 4 — DASHBOARD & RECORD REVIEW
> **Thời gian:** 4 ngày | **Mục tiêu:** Quản lý xem và duyệt được records

### Step 4.1 — Dashboard Page

```
src/pages/Dashboard/index.jsx
  ├── SummaryCards (Hôm nay: Tổng / Mới / Duyệt / Flag)
  ├── RecordList component
  └── Filters (status, date range, sender)
```

**SummaryCards:** Gọi `GET /api/dashboard/summary` mỗi 30 giây (polling cơ bản, WebSocket thêm sau).

### Step 4.2 — RecordList Component

```
src/components/RecordList/
├── RecordList.jsx        ← Ant Design <Table> hoặc <List>
│   Columns: [Thumbnail | Người gửi | Thời gian | Preview ghi chú | Trạng thái | Actions]
├── RecordRow.jsx         ← Từng dòng record
└── StatusBadge.jsx       ← Badge màu: Mới/Xem/Duyệt/Flag
```

**Phân trang:** Ant Design Table pagination, gọi API khi đổi trang.

### Step 4.3 — Record Detail (Modal / Drawer)

```
src/components/RecordDetail/
├── RecordDetail.jsx
│   ├── Ảnh full-size (load từ Signed URL — hết hạn sau 1 giờ)
│   ├── Thông tin: người gửi, thời gian, category
│   ├── Ghi chú (note) — editable
│   ├── OCR text (readonly) — hiển thị confidence %
│   └── ActionBar: [✅ Duyệt] [🚩 Flag] [✏️ Sửa] [🗑️ Xóa]
```

**Signed URL flow (theo 05_SECURITY.md):**
- API `GET /api/records/:id` trả về `image_url` là Signed URL (có `?sig=xxx&expires=...`)
- URL này hết hạn sau 1 giờ → không thể share/bookmark tùy tiện
- Frontend load ảnh trực tiếp từ S3/Cloudinary qua Signed URL — không đi qua backend

**Flag Dialog:** Khi click 🚩, mở modal nhỏ để nhập `flag_reason`.

### Step 4.4 — Action Handlers

```
onApprove(recordId)
  → PATCH /api/records/:id/status { status: 'approved' }
  → Cập nhật local state (optimistic update)
  → Toast: "Đã duyệt thành công"

onFlag(recordId, reason)
  → PATCH /api/records/:id/status { status: 'flagged', flag_reason: reason }
  → Toast: "Đã đánh dấu, thông báo đã gửi cho nhân viên"

onEdit(recordId, { note, category_id })
  → PATCH /api/records/:id
  → Toast: "Đã lưu thay đổi"

onDelete(recordId)
  → Confirm dialog: "Bạn có chắc muốn xóa?"
  → DELETE /api/records/:id
  → Remove khỏi list
```

**Kiểm tra Phase 4:**
- [ ] Xem danh sách records từ DB
- [ ] Click xem chi tiết record với ảnh
- [ ] Duyệt record → status đổi sang 'approved'
- [ ] Flag record với lý do
- [ ] Sửa ghi chú record

---

## 📅 PHASE 5 — REALTIME NOTIFICATIONS
> **Thời gian:** 2 ngày | **Mục tiêu:** Dashboard tự cập nhật khi có record mới

### Step 5.1 — Socket.io Server

**File:** `backend/src/modules/notifications/socket.js`

```js
// Khi backend xử lý xong record mới từ Zalo:
io.emit('new_record', {
  record: { id, sender_name, received_at, status },
  count: await getPendingCount()
})

// Khi record bị update:
io.emit('record_updated', { record_id, new_status })
```

### Step 5.2 — Socket.io Client (Frontend)

```
src/services/socket.js
  ├── Connect khi login (kèm JWT token trong auth handshake)
  ├── Listen 'new_record' → update notification store
  └── Listen 'record_updated' → update record trong list

src/components/NotificationBell/
  ├── Bell icon với badge số (từ notifications.store)
  └── Dropdown list 5 records mới nhất
```

### Step 5.3 — Toast Notification

Khi có `new_record` event:
```
Ant Design notification.open({
  message: "Có ghi chép mới",
  description: "Nguyễn A vừa gửi 1 ảnh hóa đơn",
  duration: 4
})
```

---

## 📅 PHASE 6 — QUICK REVIEW MODE
> **Thời gian:** 2 ngày | **Mục tiêu:** Duyệt nhanh hàng loạt records

### Step 6.1 — Quick Review Page

```
src/pages/QuickReview/index.jsx
  ├── Load danh sách records status='new', sort received_at ASC
  ├── Hiển thị 1 record toàn màn hình
  │   ├── Ảnh lớn (50% màn hình)
  │   ├── Thông tin record bên phải
  │   └── Navigation: [← Trước] Record 3/24 [Tiếp →]
  └── Action bar: [✅ Duyệt] [🚩 Flag] [⏩ Bỏ qua] [✏️ Sửa]
```

### Step 6.2 — Keyboard Shortcuts

| Phím | Hành động |
|------|-----------|
| `A` hoặc `Enter` | Duyệt (Approve) |
| `F` | Flag |
| `Space` | Bỏ qua (Skip) |
| `→` | Record tiếp theo |
| `←` | Record trước |
| `E` | Mở inline edit |

### Step 6.3 — Completion Screen

```
Khi hết records:
  ✅ Đã rà soát xong! 24 records
  [Quay về Dashboard]
```

---

## 📅 PHASE 7 — SEARCH
> **Thời gian:** 2 ngày | **Mục tiêu:** Tìm kiếm đầy đủ theo nhiều tiêu chí

### Step 7.1 — Search Page

```
src/pages/Search/index.jsx
  ├── SearchBar (input lớn + button Tìm)
  ├── AdvancedFilterPanel (collapsible)
  │   ├── Date range picker
  │   ├── Sender select (dropdown danh sách nhân viên)
  │   ├── Category select
  │   └── Status checkboxes
  └── SearchResults
      ├── Đếm: "Tìm thấy 12 kết quả"
      └── RecordList (tái dùng component Phase 4)
```

### Step 7.2 — Keyword Highlighting

Highlight từ khóa tìm kiếm trong `note` và `ocr_text`:
```jsx
// Dùng react-highlight-words hoặc custom highlight component
<Highlighter
  searchWords={[keyword]}
  textToHighlight={record.note}
/>
```

### Step 7.3 — URL State Sync

Đồng bộ filter vào URL query params để có thể share link kết quả:
```
/app/search?q=hóa+đơn&date_from=2026-04-01&status=approved
```

---

## 📅 PHASE 8 — REPORTS
> **Thời gian:** 3 ngày | **Mục tiêu:** Xuất báo cáo Excel/PDF

### Step 8.1 — Report Config Form (Frontend)

```
src/pages/Reports/index.jsx
  ├── ReportConfigForm
  │   ├── Loại báo cáo: [Ngày/Tuần/Tháng/Quý/Tùy chọn]
  │   ├── Date range picker
  │   ├── Filter nhân viên (optional)
  │   ├── Filter danh mục (optional)
  │   ├── Filter trạng thái (optional)
  │   └── Xuất dạng: [Excel] [PDF]
  └── ReportHistoryList (danh sách báo cáo đã tạo)
```

### Step 8.2 — Report Generation (Backend)

**File:** `src/services/report.service.js`

**Excel với ExcelJS:**
```js
async generateExcel(reportConfig) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Báo cáo')

  // Header style
  // Data rows (từ DB query)
  // Summary sheet (tổng hợp)
  // Lưu file → upload lên Storage → trả về URL
}
```

**PDF với PDFKit:**
```js
async generatePDF(reportConfig) {
  const doc = new PDFDocument()
  // Logo + tiêu đề
  // Bảng tổng hợp
  // Bảng chi tiết theo nhân viên
  // Lưu buffer → upload → trả về URL
}
```

### Step 8.3 — Async Job Queue (tùy chọn nếu data lớn)

Nếu báo cáo tạo > 2 giây, dùng async:
```
POST /api/reports/generate
  → Tạo report_job record (status='pending')
  → Return { job_id }
  → Background: xử lý → cập nhật status='done', file_url
  → WebSocket emit 'report_ready' → Frontend tự download

GET /api/reports/:id/download
  → Redirect về file_url
```

---

## 📅 PHASE 8b — OBSERVABILITY SETUP
> **Thời gian:** 1 ngày | **Làm song song khi có thời gian, không chặn các phase khác**

### Setup Sentry (Error Tracking)

**Backend:**
```bash
npm install @sentry/node
```
```js
// src/app.js — import trước tất cả
const Sentry = require('@sentry/node')
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Xóa auth headers trước khi gửi lên Sentry
    if (event.request?.headers) delete event.request.headers['authorization']
    return event
  }
})
```

**Frontend:**
```bash
npm install @sentry/react
```
```js
// src/main.jsx
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  replaysOnErrorSampleRate: 1.0,  // Ghi lại màn hình khi có lỗi
  integrations: [Sentry.replayIntegration({ maskAllText: true })]
})
```

### Structured Logging (Backend)
```bash
npm install winston
```
```js
// src/config/logger.js
const winston = require('winston')
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()       // JSON cho Loki/Grafana
      : winston.format.prettyPrint() // Đẹp khi dev
  ),
  transports: [new winston.transports.Console()]
})
```

**Dùng trong code:**
```js
logger.info('record.created', { record_id, sender_name, has_image, ocr_status, processing_ms })
logger.warn('ocr.failed', { record_id, error: err.message, attempt: 2 })
logger.error('db.connection.failed', { error: err.message })
```

### Quick Debug Commands

```bash
# Xem log realtime
docker compose logs -f backend --tail=100

# Test webhook Zalo locally (không cần Zalo thật)
curl -X POST http://localhost:3000/webhook/zalo \
  -H "Content-Type: application/json" \
  -H "X-Zalo-Signature: <computed>" \
  -d '{"event_name":"user_send_image","sender":{"id":"123","display_name":"Nguyen A"}}'

# Xem slow queries PostgreSQL
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
```

---

## 📅 PHASE 9 — POLISH & DEPLOY
> **Thời gian:** 3 ngày

### Step 9.1 — Error Handling & Loading States

- [ ] Frontend: Loading skeleton cho mọi data-fetching
- [ ] Frontend: Error boundary component
- [ ] Backend: Global error handler middleware
- [ ] Backend: Request validation (joi / zod)

### Step 9.2 — Empty States

```
RecordList trống → "Chưa có ghi chép nào. Nhân viên gửi ảnh qua Zalo để bắt đầu."
Search không có kết quả → "Không tìm thấy kết quả phù hợp"
Quick Review hết → "Tuyệt! Đã xem hết rồi."
```

### Step 9.3 — Responsive

Dashboard phải dùng được trên tablet (iPad). Ant Design Grid system.

### Step 9.4 — Seed Data

```
backend/src/db/seeds/seed_demo.js
  ├── Tạo 1 manager user
  ├── Tạo 3-5 staff users
  ├── Tạo 5 categories
  └── Tạo 50 records mẫu (mixed statuses)
```

### Step 9.5 — Security Checklist trước Go-live (từ 05_SECURITY.md)

```
□ HTTPS enforced — HTTP redirect 301 sang HTTPS
□ Helmet headers active (X-Frame-Options: DENY, CSP, HSTS...)
□ Rate limiting đã cấu hình cho /api/ và /webhook/
□ Zalo webhook signature verification hoạt động
□ .env, credentials/ không có trong git (npm audit secrets)
□ Database không expose ra internet (chỉ private network)
□ S3/Cloudinary bucket ở chế độ Private (không public)
□ Signed URL cho ảnh hoạt động đúng (hết hạn sau 1h)
□ Error messages không lộ stack trace ra ngoài
□ Log không chứa password, token
□ Backup DB tự động + đã test restore
□ npm audit --production (không có critical vulnerabilities)
```

### Step 9.6 — Deployment Checklist

- [ ] Backend: Dockerfile
- [ ] Frontend: Build static files (`npm run build`) → serve qua Nginx
- [ ] Cấu hình HTTPS (Nginx + Let's Encrypt / Cloudflare)
- [ ] Môi trường production `.env` (không copy từ dev)
- [ ] Zalo OA Webhook URL cập nhật sang production URL
- [ ] Sentry DSN production khác với development
- [ ] Deploy server tại Việt Nam (VNG Cloud / FPT Cloud) nếu cần tuân thủ Nghị định 13/2023

---

## 📊 TỔNG KẾT TIMELINE

| Phase | Nội dung | Thời gian | Kết quả kiểm tra |
|-------|----------|-----------|-----------------|
| 0 | Foundation & DB Setup (6 bảng + Security) | 2 ngày | Docker + DB + Security headers |
| 1 | Zalo Pipeline + OCR + ngrok | 5 ngày | Gửi ảnh Zalo → record vào DB |
| 2 | Backend API đầy đủ + JWT + Audit | 4 ngày | Postman test all endpoints |
| 3 | Frontend Auth + Layout + Sentry | 2 ngày | Login (Access+Refresh), layout đẹp |
| 4 | Dashboard & Review (Signed URL) | 4 ngày | Duyệt/Flag/Sửa được records |
| 5 | Realtime WebSocket | 2 ngày | Badge tự cập nhật |
| 6 | Quick Review Mode | 2 ngày | Keyboard shortcut hoạt động |
| 7 | Search | 2 ngày | Tìm kiếm full-text có highlight |
| 8 | Reports Excel/PDF | 3 ngày | Download file báo cáo |
| 8b | Observability (Sentry + Winston) | 1 ngày | Log structured, Sentry nhận event |
| 9 | Polish & Security Checklist & Deploy | 3 ngày | Production sẵn sàng |
| **Tổng** | | **~30 ngày** (~6 tuần) | |

---

## 🚦 THỨ TỰ DEPENDENCY

```
Phase 0 (DB)
    └─► Phase 1 (Zalo Pipeline)
    └─► Phase 2 (API)
            └─► Phase 3 (Frontend Login)
                    └─► Phase 4 (Dashboard)
                            ├─► Phase 5 (Realtime)
                            ├─► Phase 6 (Quick Review)
                            ├─► Phase 7 (Search)
                            └─► Phase 8 (Reports)
                                    └─► Phase 9 (Deploy)
```

---

## ❓ CÁC QUYẾT ĐỊNH CẦN XÁC NHẬN TRƯỚC KHI BẮT ĐẦU

| # | Câu hỏi | Lựa chọn | Ảnh hưởng |
|---|---------|----------|-----------|
| 1 | Backend ngôn ngữ? | **Node.js** (nhanh hơn, JS full-stack) hoặc Python FastAPI | Tech stack |
| 2 | File Storage? | **Cloudinary** (dễ, free tier) hoặc AWS S3 | Phase 1 |
| 3 | OCR? | **Google Vision** (chính xác) hoặc Tesseract.js (offline, miễn phí) | Phase 1 |
| 4 | Auth Manager? | **Username/Password** (đơn giản) hoặc Zalo OAuth | Phase 3 |
| 5 | Report async? | **Sync** (< 5s, đủ dùng) hoặc Job Queue với Redis | Phase 8 |
| 6 | Deploy platform? | **VPS + Docker** hoặc Railway/Render | Phase 9 |
| 7 | Deploy region? | **Việt Nam** (VNG Cloud/FPT) nếu cần tuân thủ NĐ 13/2023, hoặc AWS Singapore | Phase 9 |

---

## 🚀 ROADMAP SAU MVP — V1.1 (từ Competitive Analysis)

> Dựa trên `07_COMPETITIVE_ANALYSIS.md` — các cải tiến ưu tiên cao sau khi MVP ổn định

### 🔴 IMP-01: Custom Fields theo danh mục (Ưu tiên cao nhất)

```
Vấn đề: Record hiện tại chỉ có ảnh + ghi chú text → mất cấu trúc
Giải pháp: Mỗi Category có danh sách fields tùy chỉnh

DB thêm:
  CREATE TABLE category_fields (
    id           UUID PRIMARY KEY,
    category_id  UUID REFERENCES categories(id),
    field_name   VARCHAR(50),
    field_type   ENUM('text','number','date','select'),
    is_required  BOOLEAN DEFAULT FALSE,
    sort_order   INT
  );
  
  -- Lưu giá trị field của từng record
  CREATE TABLE record_field_values (
    record_id    UUID REFERENCES records(id),
    field_id     UUID REFERENCES category_fields(id),
    value        TEXT,
    PRIMARY KEY (record_id, field_id)
  );
```

**Kết quả:** Dashboard hiển thị bảng có cột động theo từng category (hóa đơn: Số HĐ / Nhà CC / Số tiền).

### 🔴 IMP-02: Zalo Bot Conversational (Ưu tiên cao)

```
Thay vì: nhân viên gửi ảnh + text tự do (không cấu trúc)
Thành:   bot dẫn dắt từng bước

Flow:
NV: "/hoadon" (hoặc gõ "hóa đơn")
Bot: "Vui lòng gửi ảnh hóa đơn"
NV: [Ảnh]
Bot: "Số tiền là bao nhiêu?"
NV: "2.500.000"
Bot: "✅ Đã lưu hóa đơn 2.500.000đ"

→ Cần: Zalo Bot session state (lưu Redis) + conversation flow engine
```

### 🟡 IMP-03: Digest Notification (Ưu tiên trung bình)

```
Thay vì: 20 nhân viên gửi → 20 thông báo pop-up
Thành:   Gom lại thành 1 thông báo mỗi 30 phút:
         "Có 8 ghi chép mới từ 4 nhân viên cần xem"

Implementation: cron job mỗi 30 phút kiểm tra count records mới
→ Emit 1 notification thay vì nhiều
```

### 🟡 IMP-04: Comment thread trên record

```
Quản lý: "Ảnh mờ, chụp lại nhé" [gửi từ Dashboard]
  → Backend gọi Zalo Bot API gửi tin nhắn lại cho nhân viên
  → Lưu comment vào DB để có thread history

DB thêm:
  CREATE TABLE record_comments (
    id          UUID PRIMARY KEY,
    record_id   UUID REFERENCES records(id),
    user_id     UUID REFERENCES users(id),
    content     TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
  );
```

### 🟡 IMP-06: PWA Mobile cho Manager

```
Thêm vào frontend/vite.config.js:
  import { VitePWA } from 'vite-plugin-pwa'

Manager cài Dashboard như app trên điện thoại:
  → Xem records, duyệt/flag trực tiếp trên mobile
  → Nhận push notification khi có record mới
```

---

## 🧪 TESTING STRATEGY (từ 06_DEBUGGING_OBSERVABILITY.md)

```
LEVEL       MỤC TIÊU                          TOOLS
──────────  ────────────────────────────────  ───────────────
Unit        Test từng service/function        Jest (backend)
            Nhanh, chạy khi commit            Vitest (frontend)

Integration Test API endpoint + DB thật      Supertest + Jest
            Không dùng mock DB               PostgreSQL test DB

E2E         Test flow hoàn chỉnh             Playwright
            Ít nhất 3 flow chính:
            1. Gửi Zalo → xem Dashboard
            2. Duyệt record → status thay đổi
            3. Tạo báo cáo → download file
```

**Chạy trước khi merge:**
```bash
npm test                    # Unit tests
npm run test:integration    # Integration tests (cần DB)
npm run test:e2e            # E2E (cần server chạy)
npm audit                   # Security scan dependencies
```
