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
│   │   ├── config/            ← env, DB config, logger
│   │   ├── db/
│   │   │   ├── migrations/    ← SQL migration files (001→008)
│   │   │   └── seeds/         ← seed data
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js      ← JWT verify
│   │   │   ├── rbac.middleware.js      ← Phân quyền role
│   │   │   └── errorHandler.js         ← Global error handler
│   │   ├── connectors/                 ← Connector Pattern (đa nền tảng)
│   │   │   ├── index.js               ← Registry: { telegram, zalo, ... }
│   │   │   ├── normalized-message.js  ← Format chuẩn hóa
│   │   │   ├── base.connector.js      ← Interface: verify/parse/download/reply
│   │   │   ├── telegram/
│   │   │   │   ├── telegram.connector.js  ← Secret token verify, getFile API
│   │   │   │   └── telegram.parser.js     ← Update → NormalizedMessage
│   │   │   └── zalo/
│   │   │       ├── zalo.connector.js      ← HMAC-SHA256 verify, OA API
│   │   │       └── zalo.parser.js         ← Payload → NormalizedMessage
│   │   ├── modules/
│   │   │   ├── webhook/       ← Dynamic webhook router + MessageProcessor
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
| `@google/generative-ai` | AI document extraction (Gemini) |
| `cloudinary` | File storage |
| `axios` | HTTP client (Telegram API, image download) |

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
Tạo và chạy theo thứ tự (đã hoàn thành):

```
backend/src/db/migrations/
├── 001_create_users.sql          ← platform + platform_user_id (platform-agnostic)
├── 002_create_categories.sql
├── 003_create_records.sql        ← platform + platform_message_id (platform-agnostic)
├── 004_create_edit_logs.sql
├── 005_create_report_jobs.sql    ← có filter_platform
├── 006_create_audit_logs.sql     ← BẮT BUỘC (RLS immutable)
├── 007_platform_agnostic.sql     ← ADD COLUMN + migrate data (đã chạy)
└── 008_cleanup_zalo_columns.sql  ← DROP cột Zalo cũ (đã chạy)
```

**Script migration runner** (`backend/src/db/migrate.js`):
- Tracking qua bảng `_migrations` — chỉ chạy file chưa apply
- Dùng transaction: rollback tự động nếu file lỗi

```bash
cd backend && npm run migrate
```

**Kiểm tra:** Connect DBeaver/TablePlus vào `localhost:5433`, xác nhận đủ 8 bảng:
`users`, `refresh_tokens`, `categories`, `records`, `edit_logs`, `report_jobs`, `audit_logs`, `platform_configs`

### Step 0.4 — Cấu hình .env
```env
# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database (Docker port 5433 để tránh conflict với native PG)
DB_HOST=localhost
DB_PORT=5433
DB_NAME=quan_ly_ghi_chep
DB_USER=admin
DB_PASSWORD=secret

# JWT — Access Token ngắn + Refresh Token dài (theo 05_SECURITY.md)
JWT_ACCESS_SECRET=your_access_secret_here
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_REFRESH_EXPIRES=7d

# ── Telegram Bot (ưu tiên — dễ setup, nhận 100% message trong group) ──
TELEGRAM_BOT_TOKEN=             # Lấy từ @BotFather
TELEGRAM_WEBHOOK_SECRET=        # Random string bất kỳ (tự đặt)

# ── Zalo OA (tùy chọn — cần GPKD, chỉ nhận khi @mention) ──
ZALO_OA_TOKEN=
ZALO_WEBHOOK_SECRET=

# Storage (chọn 1)
CLOUDINARY_URL=                 # cloudinary://api_key:api_secret@cloud_name
# hoặc: AWS_S3_BUCKET= / AWS_REGION= / AWS_ACCESS_KEY_ID= / AWS_SECRET_ACCESS_KEY=
SIGNED_URL_EXPIRES=3600         # URL ảnh hết hạn sau 1 giờ

# AI / Document Extraction
AI_PROVIDER=gemini
GEMINI_API_KEY=                 # lấy từ aistudio.google.com
GEMINI_MODEL=gemini-2.5-flash   # hoặc gemini-2.5-pro

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

// Webhook có rate limit riêng (loose hơn vì platform gọi nhiều)
const webhookLimiter = rateLimit({ windowMs: 60_000, max: 500 })
app.use('/webhook/', webhookLimiter)
```

```bash
npm install express-rate-limit
```

---

## 📅 PHASE 1 — CORE BACKEND: MULTI-PLATFORM CONNECTOR PIPELINE ✅ ĐÃ XONG
> **Thời gian:** 5 ngày | **Mục tiêu:** Nhận tin nhắn từ Telegram (ưu tiên) + Zalo → lưu DB tự động
> **Trạng thái (2026-04-21):** Steps 1.1 → 1.7 hoàn thành. Telegram webhook đang live với ngrok.

### Kiến trúc Connector Pattern (đã implement xong)

```
POST /webhook/telegram  ─►  TelegramConnector.verify() → .parse()  ─►
POST /webhook/zalo      ─►  ZaloConnector.verify()     → .parse()  ─►  MessageProcessor → DB → WebSocket
POST /webhook/<new>     ─►  <NewConnector>             → .parse()  ─►  (thêm platform = 1 file mới)

src/connectors/
├── index.js                  ← Registry: { telegram, zalo }
├── normalized-message.js     ← NormalizedMessage contract (platform-agnostic)
├── base.connector.js         ← Abstract: verify() / parse() / downloadImage() / reply()
├── telegram/
│   ├── telegram.connector.js ← Secret-token verify, setWebhook, getFile download, reply
│   └── telegram.parser.js    ← Update → NormalizedMessage
└── zalo/
    ├── zalo.connector.js     ← HMAC-SHA256 verify, OA API download, reply
    └── zalo.parser.js        ← Payload → NormalizedMessage

src/modules/webhook/
├── webhook.router.js         ← POST /webhook/:platform (dynamic route)
│                                GET  /webhook/platforms (list active)
└── message.processor.js      ← NormalizedMessage → duplicate check → upsert user
                                 → download+upload image → OCR → INSERT record → emit WS
```

**Ưu điểm:** Thêm platform mới (Discord, Slack...) chỉ cần:
1. Tạo `src/connectors/<platform>/` implement `BaseConnector`
2. Đăng ký 1 dòng trong `connectors/index.js`
3. Thêm env var token vào `.env`

### Step 1.1 — Express app + config ✅ ĐÃ XONG

```
src/app.js              ← Express + Helmet + CORS + rate limiting + Socket.io + routes
src/config/db.js        ← pg Pool (port 5433), slow query warning >1s
src/config/env.js       ← Validate required env vars on startup
src/config/logger.js    ← Winston: JSON (prod) / colorized (dev)
```

### Step 1.2 — Connector Layer ✅ ĐÃ XONG

**Telegram** (ưu tiên — không cần GPKD, nhận 100% message trong group):
```
TelegramConnector
  ├── verify(req)         → timingSafeEqual header X-Telegram-Bot-Api-Secret-Token
  ├── parse(body)         → parseTelegramUpdate() → NormalizedMessage
  │                          Photo array → lấy file_id ảnh lớn nhất
  │                          Caption → text_note
  ├── downloadImage(fileId) → getFile API → download buffer
  ├── reply(chatId, text)   → sendMessage API
  └── registerWebhook(url)  → setWebhook với secret token (tự gọi khi server start)
```

**Zalo OA** (tùy chọn — cần GPKD, chỉ nhận khi @mention trong group):
```
ZaloConnector
  ├── verify(req)         → HMAC-SHA256 X-Zalo-Signature
  ├── parse(body)         → parseZaloPayload() → NormalizedMessage
  ├── downloadImage(fileId) → OA Access Token API
  └── reply(userId, text)   → OA sendMessage API
```

**NormalizedMessage — contract dùng chung:**
```js
{
  platform:            'telegram' | 'zalo' | 'discord',
  platform_message_id: string,    // chống duplicate
  platform_user_id:    string,
  sender_name:         string,
  source_chat_id:      string,
  source_chat_type:    'private' | 'group' | 'channel',
  message_type:        'image' | 'text' | 'image_text' | 'other',
  image_file_id:       string | null,
  image_url:           string | null,
  text_note:           string | null,
  received_at:         Date,
  raw:                 object
}
```

### Step 1.3 — Webhook Router ✅ ĐÃ XONG

**File:** `src/modules/webhook/webhook.router.js`

```
POST /webhook/:platform
  → Lookup connector từ registry (platform = 'telegram' | 'zalo' | ...)
  → connector.verify(req) — 403 nếu fail
  → Respond 200 NGAY (platform cần response nhanh < 5s)
  → Background: connector.parse(body) → MessageProcessor.process(msg, connector, io)

GET /webhook/platforms
  → Trả về danh sách platform đang active
```

### Step 1.4 — MessageProcessor ✅ ĐÃ XONG

**File:** `src/modules/webhook/message.processor.js`

```
process(normalizedMsg, connector, io)
  1. Kiểm tra duplicate: SELECT WHERE platform = ? AND platform_message_id = ?
  2. Upsert user: INSERT ... ON CONFLICT (platform, platform_user_id) DO UPDATE
  3. Download ảnh qua connector.downloadImage() → upload Storage → Signed URL
  4. OCR → ocrService.extractText(imageUrl)
  5. INSERT record (platform, platform_message_id, source_chat_id, sender_id, ...)
  6. io.emit('new_record', { record_id, sender_name, platform, ... })
```

### Step 1.5 — Storage Service ✅ ĐÃ XONG

**File:** `src/services/storage.service.js`

```
uploadImage(buffer, filename) → { image_url, thumbnail_url }
  └── Cloudinary: upload stream + auto thumbnail bằng transformation URL
  └── S3: putObject + getSignedUrl (expires = SIGNED_URL_EXPIRES)
```

```bash
# Cloudinary (dễ nhất, free tier 25GB)
npm install cloudinary
```

### Step 1.6 — AI Document Extraction Service ✅ ĐÃ XONG

**Files:**
- `src/services/ocr.service.js` — facade (cùng pattern với storage.service.js)
- `src/services/ocr/gemini.provider.js` — Gemini multimodal AI provider

```
extractText(imageUrl) → { text, confidence, status, provider, structured_data }
  └── Gemini 2.5 Flash: download ảnh → base64 → generateContent([prompt, inlineData])
      → parse JSON → trả { document_type, date, amount, currency, raw_text, ... }
      → confidence: 0.90 (text+structure) | 0.70 (text only) | 0.40 (parse failed)
  └── Thêm provider: AI_PROVIDER=<name> + src/services/ocr/<name>.provider.js
```

**structured_data fields** (trích xuất tự động từ chứng từ VN):
```json
{
  "document_type": "hóa_đơn | phiếu_chi | phiếu_thu | biên_bản | báo_cáo | hợp_đồng | khác",
  "date": "YYYY-MM-DD",
  "amount": "số tiền",
  "currency": "VND | USD | EUR",
  "document_number": "số chứng từ",
  "description": "mô tả chính",
  "parties": "các bên liên quan",
  "notes": "thông tin bổ sung",
  "raw_text": "toàn bộ text trong ảnh"
}
```

```bash
npm install @google/generative-ai axios   # đã cài
```

### Step 1.7 — Ngrok cho local testing

Telegram và Zalo đều cần HTTPS public URL để gọi webhook:

```bash
# Cài ngrok: https://ngrok.com/download
ngrok http 3000
# → URL: https://abc123.ngrok.io

# Telegram: server tự động setWebhook khi khởi động nếu TELEGRAM_BOT_TOKEN có
# Kiểm tra: GET https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Zalo: vào Zalo OA Dashboard → cấu hình webhook URL thủ công
# https://abc123.ngrok.io/webhook/zalo

# Xem request log realtime: http://localhost:4040 (có thể replay)
```

**Kiểm tra Phase 1 — Telegram (không cần Zalo):**
- [x] `npm run dev` → server start → Telegram setWebhook thành công ✅
- [x] ngrok http 3000 → WEBHOOK_BASE_URL cập nhật → Telegram nhận webhook ✅
- [x] Gửi ảnh vào Telegram group/chat với Bot → record xuất hiện trong DB
- [x] Gửi text vào Telegram → record lưu note, image trống
- [ ] Gửi sticker/voice → KHÔNG tạo record
- [x] Gửi lại cùng message → KHÔNG insert duplicate
- [x] `GET /webhook/platforms` → trả về `["telegram"]`

---

## 📅 PHASE 2 — BACKEND API ✅ ĐÃ XONG
> **Thời gian:** 4 ngày | **Mục tiêu:** API đầy đủ cho Frontend gọi
> **Trạng thái (2026-04-22):** Steps 2.1 → 2.6 hoàn thành. Toàn bộ endpoints đã test qua Swagger UI tại `/api-docs`.

### Step 2.1 — Authentication & User Management ✅ ĐÃ XONG

#### Mô hình auth được chọn

Đây là **internal business app** — không có public self-register. Mô hình:

```
[Bootstrap] → Admin đầu tiên tạo bằng seed script (CLI, không phải API)
    └─► Admin/Manager tạo tài khoản nội bộ qua API (admin-only)
            └─► Staff nhận credentials → login → đổi mật khẩu lần đầu
```

Không có: public signup, email verify, forgot password qua email, OAuth.
Có: admin reset password, admin deactivate account, refresh token rotation.

---

#### DB Schema — bổ sung vào users + refresh_tokens

**Thêm cột vào bảng `users`** (migration `009_auth_hardening.sql`):
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash      TEXT,
  ADD COLUMN IF NOT EXISTS is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS must_change_pw     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS login_attempts     INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login_at      TIMESTAMP,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;
```

**Bảng `refresh_tokens`** (migration `002_create_refresh_tokens.sql` nếu chưa có):
```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,   -- sha256(raw_token), KHÔNG lưu raw
  family_id    UUID NOT NULL,          -- rotation: cùng family bị revoke khi reuse
  expires_at   TIMESTAMP NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW(),
  revoked_at   TIMESTAMP,              -- NULL = còn hợp lệ
  device_hint  VARCHAR(100)            -- tùy chọn: user-agent snippet để debug
);

CREATE INDEX IF NOT EXISTS idx_rt_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_rt_user_id    ON refresh_tokens(user_id);
```

> **family_id**: Khi token bị reuse (đã revoke mà vẫn dùng) → revoke TOÀN BỘ
> token cùng family — buộc user login lại. Chống token theft.

---

#### Password Policy

- Tối thiểu 8 ký tự
- bcrypt rounds = 12 (production) / 10 (dev, nhanh hơn khi test)
- Không log password dưới bất kỳ hình thức nào
- Không trả error message phân biệt "sai username" vs "sai password" (→ luôn dùng chung: "Invalid credentials")

---

#### RBAC — Phân quyền theo action

| Action | admin | manager | staff |
|--------|:-----:|:-------:|:-----:|
| Login | ✅ | ✅ | ✅ |
| Xem profile của mình (`/me`) | ✅ | ✅ | ✅ |
| Đổi password của mình | ✅ | ✅ | ✅ |
| Tạo user mới | ✅ | ✅ | ❌ |
| Xem danh sách users | ✅ | ✅ | ❌ |
| Deactivate/activate user | ✅ | ❌ | ❌ |
| Reset password user khác | ✅ | ❌ | ❌ |
| Đổi role user | ✅ | ❌ | ❌ |

---

#### Bootstrap Admin đầu tiên

Không có API public. Chạy seed script một lần khi deploy lần đầu:

```bash
# Tạo admin đầu tiên — chạy 1 lần, không commit password vào code
node src/db/seeds/create_admin.js --username admin --name "Quản trị viên" --password "ChangeMe@2026"
```

Script tạo user với `role='admin'`, `must_change_pw=true` → admin phải đổi mật khẩu khi login lần đầu.

---

#### API Endpoints — Auth

**`POST /api/auth/login`** — Không cần auth
```
Body:     { username: string, password: string }
Flow:
  1. Tìm user theo username
  2. Kiểm tra is_active = true → 401 nếu false ("Account disabled")
  3. Kiểm tra locked_until > NOW() → 423 nếu còn locked
  4. Verify bcrypt(password, password_hash)
  5. Nếu sai: login_attempts++ → nếu >= 5: locked_until = NOW() + 15 phút
  6. Nếu đúng: reset login_attempts = 0, cập nhật last_login_at
  7. Generate access_token (JWT 15m) + refresh_token (JWT 7d)
  8. Lưu sha256(refresh_token) vào refresh_tokens với family_id mới
Response: {
  access_token: string,
  refresh_token: string,
  user: { id, name, role, must_change_pw }
}
Lỗi: 401 (sai credentials), 423 (account locked), 403 (account disabled)
```

**`POST /api/auth/refresh`** — Không cần auth
```
Body:     { refresh_token: string }
Flow:
  1. Verify JWT signature + expiry
  2. Tính sha256(refresh_token), tìm trong DB
  3. Nếu không tìm thấy → 401
  4. Nếu revoked_at IS NOT NULL → reuse attack: revoke TOÀN BỘ family → 401
  5. Kiểm tra user is_active = true
  6. Revoke token cũ (set revoked_at = NOW())
  7. Generate refresh_token MỚI cùng family_id, lưu vào DB
  8. Generate access_token mới
Response: { access_token: string, refresh_token: string }
Lỗi: 401 (invalid/expired/reused), 403 (user disabled)
```

> **Token rotation**: mỗi lần refresh → token cũ bị revoke, token mới được cấp.
> Client PHẢI lưu và dùng token mới, không dùng lại token cũ.

**`POST /api/auth/logout`** — Cần access_token
```
Body:     { refresh_token: string }
Flow:     Revoke token đó (set revoked_at = NOW())
Response: { success: true }
Note:     Access token cũ vẫn hợp lệ đến hết 15 phút — đây là trade-off chấp nhận được cho internal app.
          Nếu cần revoke ngay: dùng Redis blocklist (Phase 2.5 optional).
```

**`POST /api/auth/logout-all`** — Cần access_token *(optional, đưa vào nếu có thời gian)*
```
Flow:     Revoke TẤT CẢ refresh_tokens của user (set revoked_at = NOW() cho cả family)
Use case: User nghi ngờ bị lộ token → kick hết thiết bị
```

**`GET /api/auth/me`** — Cần access_token
```
Response: { id, username, name, role, is_active, must_change_pw, last_login_at }
```

**`POST /api/auth/change-password`** — Cần access_token
```
Body:     { current_password: string, new_password: string }
Flow:
  1. Verify current_password
  2. Validate new_password (min 8 ký tự, khác current)
  3. bcrypt hash new_password
  4. Cập nhật password_hash, password_changed_at = NOW(), must_change_pw = false
  5. Revoke TẤT CẢ refresh_tokens hiện có (buộc login lại trên thiết bị khác)
Response: { success: true }
```

---

#### API Endpoints — User Management (admin/manager only)

**`POST /api/users`** — Cần admin hoặc manager
```
Body:     { username, name, role: 'staff'|'manager', password? }
Flow:
  - Nếu không truyền password → tự sinh random password tạm (12 ký tự)
  - must_change_pw = true (user phải đổi khi login lần đầu)
  - is_active = true
Response: { id, username, name, role, temp_password? }
Note:     temp_password chỉ trả về 1 lần duy nhất khi tạo, không lưu vào DB
```

**`GET /api/users`** — Cần admin hoặc manager
```
Query:    page, limit, role, is_active
Response: { data: [{ id, username, name, role, is_active, last_login_at }], total }
```

**`GET /api/users/:id`** — Cần admin hoặc manager (hoặc chính user đó)
```
Response: thông tin user đầy đủ (không có password_hash)
```

**`PATCH /api/users/:id/activate`** — Cần admin
```
Body:     { is_active: boolean }
Flow:     Cập nhật is_active, nếu deactivate → revoke all refresh_tokens
Response: { success: true }
```

**`POST /api/users/:id/reset-password`** — Cần admin
```
Flow:
  - Sinh random password tạm (12 ký tự)
  - Hash + lưu, must_change_pw = true
  - Revoke all refresh_tokens của user đó
Response: { temp_password: string }  ← trả về 1 lần, admin tự thông báo cho user
```

**`PATCH /api/users/:id/role`** — Cần admin
```
Body:     { role: 'staff'|'manager'|'admin' }
Response: { success: true }
Note:     Không tự hạ role của chính mình
```

---

#### Middleware

**`requireAuth`** — `src/middlewares/auth.middleware.js`:
```js
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    // Kiểm tra user vẫn active (DB hit — dùng cache nếu cần tối ưu sau)
    const { rows } = await db.query('SELECT id, role, is_active FROM users WHERE id = $1', [payload.sub])
    if (!rows[0] || !rows[0].is_active) return res.status(403).json({ error: 'Account disabled' })
    req.user = { ...payload, role: rows[0].role }
    next()
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' })
  }
}
```

**`requireRole`** — `src/middlewares/rbac.middleware.js`:
```js
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}
// Dùng: router.post('/users', requireAuth, requireRole('admin', 'manager'), createUser)
```

---

#### Audit Log — bổ sung cho auth actions

| Action | Khi nào |
|--------|---------|
| `login_success` | Đăng nhập thành công |
| `login_failed` | Sai credentials (log IP, không log password) |
| `login_locked` | Account bị lock do sai quá nhiều lần |
| `logout` | Logout |
| `password_changed` | User đổi password |
| `password_reset` | Admin reset password user khác |
| `user_created` | Admin tạo user mới |
| `user_deactivated` | Admin deactivate user |
| `user_activated` | Admin activate user |
| `token_reuse_detected` | Phát hiện refresh token reuse (security alert) |

---

#### Checklist Test — Auth

```
Login:
  [x] Đúng username + password → 200 + tokens
  [ ] Sai password → 401 "Invalid credentials"
  [ ] Sai username → 401 "Invalid credentials" (cùng message, không phân biệt)
  [ ] Đúng sau 4 lần sai → login thành công, reset login_attempts
  [ ] Sai lần 5 → 423, locked_until set
  [ ] Login khi đang locked → 423
  [ ] User is_active=false → 403 "Account disabled"

Refresh Token:
  [ ] Token hợp lệ → 200 + access_token mới + refresh_token mới
  [ ] Token đã revoke (logout) → 401
  [ ] Token reuse (gửi lại token cũ sau khi đã refresh) → 401 + revoke cả family
  [ ] Token hết hạn → 401
  [ ] User bị deactivate → 403

Logout:
  [ ] Logout thành công → 200
  [ ] Sau logout, refresh bằng token cũ → 401

Change Password:
  [ ] current_password sai → 401
  [ ] new_password < 8 ký tự → 400
  [ ] Thành công → 200 + tất cả refresh_tokens bị revoke

User Management (admin):
  [ ] POST /api/users → tạo user, nhận temp_password
  [ ] User mới login → must_change_pw = true trong response
  [ ] Deactivate user → user đó không login được nữa
  [ ] Reset password → user cũ bị kick, phải login lại với temp_password
  [ ] Staff gọi POST /api/users → 403
```

Middleware `requireAuth` dùng cho tất cả routes bên dưới.

### Step 2.2 — Records API ✅ ĐÃ XONG

```
GET  /api/records
  Query params:
    status=new|reviewed|approved|flagged
    platform=telegram|zalo|discord       ← filter theo platform
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
  Side effect: nếu flagged → connector.reply() gửi về đúng platform gốc

PATCH /api/records/:id
  Body: { note?, category_id? }
  Side effect: insert vào edit_logs

DELETE /api/records/:id
  Soft delete: status = 'deleted'
```

### Step 2.2b — Audit Log tự động ✅ ĐÃ XONG

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

### Step 2.3 — Dashboard Summary API ✅ ĐÃ XONG

```
GET /api/dashboard/summary
  Response:
  {
    today: { total, new, reviewed, approved, flagged },
    this_week: { total },
    pending_review: 8   ← số records status='new' chưa đọc
  }
```

### Step 2.4 — Search API ✅ ĐÃ XONG

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

### Step 2.5 — Categories API ✅ ĐÃ XONG

```
GET  /api/categories          ← Lấy danh sách categories
POST /api/categories          ← Tạo category mới
PUT  /api/categories/:id      ← Cập nhật
```

### Step 2.6 — Users API (nội bộ) ✅ ĐÃ XONG (covered bởi Step 2.1)

```
GET /api/users                ← Danh sách nhân viên (để filter báo cáo)
```

**Kiểm tra Phase 2:** Dùng Postman/Insomnia test tất cả endpoints, kèm collection export lưu vào `docs/api.postman_collection.json`.

---

## 📅 PHASE 3 — FRONTEND: AUTH & LAYOUT
> **Thời gian:** 2 ngày | **Mục tiêu:** Login hoạt động, layout sidebar cơ bản
> **Trạng thái (2026-04-25):** Steps 3.1–3.5 hoàn thành. Login flow end-to-end hoạt động. App shell có Sidebar + Header + Footer. Dashboard hiển thị summary thật từ backend.
> **Cập nhật navigation (2026-04-25):** Loại bỏ "Rà soát nhanh" và "Tìm kiếm" khỏi sidebar — search đã được tích hợp ngay trong trang Danh sách Record (filter + search bar). Sidebar còn 4 mục điều hướng chính.

### Step 3.1 — Setup Router & Layout ✅ ĐÃ XONG

```
src/App.jsx
  ├── / → redirect /dashboard
  ├── /login → <LoginPage>
  └── /app/* → <AppLayout> (yêu cầu đã login)
       ├── /app/dashboard  → <DashboardPage>
       ├── /app/records    → <RecordsPage>      ← search + filter tích hợp trong trang
       ├── /app/doc-types  → <DocTypeViewPage>  ← xem record theo loại tài liệu
       └── /app/reports    → <ReportsPage>
```

### Step 3.2 — Login Page ✅ ĐÃ XONG

```
src/pages/Login/index.jsx
  ├── Form: username + password
  ├── Gọi POST /api/auth/login
  ├── Lưu token vào localStorage
  └── Redirect về /app/dashboard
```

### Step 3.3 — App Layout (Sidebar + Header) ✅ ĐÃ XONG

```
src/components/AppLayout/index.jsx
├── Sidebar (collapsible — 260px mở rộng / 64px thu gọn)
│   ├── Điều hướng chính
│   │   ├── 🏠 Dashboard         → /app/dashboard
│   │   ├── 📋 Danh sách Record  → /app/records
│   │   ├── 🗂  Phân loại        → /app/doc-types  (trước: "Theo loại tài liệu")
│   │   └── 📊 Báo cáo          → /app/reports
│   └── Quản trị hệ thống
│       └── ⚙️  Cài đặt          → /app/settings
└── Header   ← Breadcrumb + Search bar + Bell badge + User dropdown
```

### Step 3.4 — API Service layer ✅ ĐÃ XONG

```
src/services/api.js
  ├── axios instance với baseURL + token interceptor
  ├── Auto 401 → redirect login

src/services/records.api.js
src/services/search.api.js
src/services/reports.api.js
```

### Step 3.5 — Global State (Zustand) ✅ ĐÃ XONG

```
src/store/auth.store.js       ← user info, token
src/store/notifications.store.js  ← số records mới chưa đọc
```

---

## 📅 PHASE 4 — DASHBOARD & RECORD REVIEW ✅ ĐÃ XONG
> **Thời gian:** 4 ngày | **Mục tiêu:** Quản lý xem và duyệt được records
> **Trạng thái (2026-04-24):** Hoàn thành toàn bộ Steps 4.0 → 4.6. Dashboard, RecordList, RecordDetail, Records page, Filter & Pagination, Error/Loading states. **Bổ sung thêm:** Stats cards auto-refresh, bulk select & delete, sort order toggle, tạo record thủ công (upload ảnh + OCR async), dropdown người gửi từ danh sách system users, filter-aware optimistic UI.

### Step 4.0 — UI Design & Layout ✅ ĐÃ XONG

Layout đã được thiết kế và dựng xong cho 3 màn hình chính:

```
src/pages/Dashboard/         ✅ Layout xong
src/pages/Records/           ✅ Layout xong (RecordList + RecordDetail)
src/components/RecordList/   ✅ Layout xong
src/components/RecordDetail/ ✅ Layout xong
```

Các file CSS tương ứng đã thiết lập design tokens, responsive breakpoints và visual states (hover, active, error, empty).

---

### Step 4.1 — Dashboard Page — Data Integration ✅ ĐÃ XONG

**Mục tiêu:** Kết nối SummaryCards và RecordList với API thật.

```
src/pages/Dashboard/index.jsx           ✅
src/hooks/useDashboardSummary.js        ✅  polling setInterval 30_000ms
src/hooks/useRecordsQuery.js            ✅  filter + pagination state
src/components/dashboard/SummaryCards.jsx ✅  4 cards + skeleton loading
src/services/dashboard.service.js       ✅  getDashboardSummary()
src/pages/Dashboard/Dashboard.css       ✅
```

**State shape:**
```js
const [summary, setSummary] = useState(null)       // dashboard summary
const [records, setRecords] = useState([])          // danh sách records
const [total,   setTotal]   = useState(0)
const [page,    setPage]    = useState(1)
const [filters, setFilters] = useState({ status: '', date_from: '', date_to: '' })
const [loading, setLoading] = useState(true)
```

**Polling implementation:**
```js
useEffect(() => {
  fetchSummary()                             // lần đầu
  const id = setInterval(fetchSummary, 30_000)
  return () => clearInterval(id)
}, [])
```

---

### Step 4.2 — RecordList Component — Data Layer ✅ ĐÃ XONG

**File:** `src/components/records/RecordList.jsx`

```
Props:
  records    : array    ← dữ liệu từ API
  total      : number   ← tổng số để phân trang
  page       : number
  loading    : boolean
  onPageChange(page)    ← callback đổi trang
  onRowClick(record)    ← mở RecordDetail
  onApprove(id)         ← action inline
  onFlag(id)            ← mở flag dialog

Columns render:
  [Thumbnail 60×60] [Người gửi + platform badge] [Thời gian (relative)] 
  [Preview ghi chú — truncate 2 dòng] [StatusBadge] [Actions dropdown]
```

**StatusBadge colors:**
```
new      → xanh lam  (#1890ff) — "Mới"
reviewed → vàng      (#faad14) — "Đã xem"
approved → xanh lá   (#52c41a) — "Đã duyệt"
flagged  → đỏ        (#ff4d4f) — "Flagged"
```

**Phân trang:** Custom pagination — `page * limit` vs `total`, gọi `onPageChange` khi đổi trang, API tự fetch lại.

**Empty state:**
```
Chưa có ghi chép nào.
Nhân viên gửi ảnh qua Telegram hoặc Zalo để bắt đầu.
```

---

### Step 4.3 — RecordDetail — Data & Interaction ✅ ĐÃ XONG

**File:** `src/components/records/RecordDetailDrawer.jsx`  
Mở bằng Drawer (slide từ phải) khi click vào row trong RecordList.

```
Props:
  recordId : string | null    ← null → drawer đóng
  onClose()
  onStatusChange(id, status)  ← bubble up để update list
  onDelete(id)

Data fetch: GET /api/records/:id khi recordId thay đổi

Sections:
  ┌─ Image panel ─────────────────────────────────────┐
  │  Ảnh full-size load từ image_url (Signed URL)      │
  │  Skeleton loader trong khi ảnh chưa load           │
  │  Fallback: icon ảnh bị lỗi + nút retry             │
  └───────────────────────────────────────────────────┘
  ┌─ Info panel ──────────────────────────────────────┐
  │  Người gửi (name + platform badge)                 │
  │  Thời gian nhận (format: HH:mm DD/MM/YYYY)         │
  │  Danh mục (CategorySelect — editable)              │
  │  Trạng thái (StatusBadge)                          │
  └───────────────────────────────────────────────────┘
  ┌─ Note panel ──────────────────────────────────────┐
  │  Ghi chú (textarea, lưu khi blur hoặc Ctrl+S)      │
  └───────────────────────────────────────────────────┘
  ┌─ OCR panel ───────────────────────────────────────┐
  │  Text trích xuất tự động (readonly)                │
  │  Confidence: 90% (badge màu xanh/vàng/đỏ)         │
  └───────────────────────────────────────────────────┘
  ┌─ ActionBar ───────────────────────────────────────┐
  │  [✅ Duyệt]  [🚩 Flag]  [✏️ Lưu ghi chú]  [🗑️]    │
  └───────────────────────────────────────────────────┘
```

**Signed URL note:** `image_url` từ API đã là Signed URL có TTL 1 giờ. Frontend load trực tiếp, không proxy qua backend.

**CategorySelect:** Gọi `GET /api/categories` một lần khi component mount, cache vào local state. Dropdown thay đổi → `PATCH /api/records/:id { category_id }` ngay.

---

### Step 4.4 — Action Handlers ✅ ĐÃ XONG

```js
// Approve
async function handleApprove(recordId) {
  await api.patch(`/api/records/${recordId}/status`, { status: 'approved' })
  // optimistic: cập nhật records[] trong state ngay
  setRecords(prev => prev.map(r => r.id === recordId ? { ...r, status: 'approved' } : r))
  toast.success('Đã duyệt thành công')
}

// Flag — mở FlagDialog trước
async function handleFlag(recordId, flagReason) {
  await api.patch(`/api/records/${recordId}/status`, { status: 'flagged', flag_reason: flagReason })
  setRecords(prev => prev.map(r => r.id === recordId ? { ...r, status: 'flagged' } : r))
  toast.success('Đã đánh dấu — thông báo đã gửi cho nhân viên')
}

// Edit note / category
async function handleEdit(recordId, { note, category_id }) {
  await api.patch(`/api/records/${recordId}`, { note, category_id })
  toast.success('Đã lưu thay đổi')
}

// Delete — confirm trước
async function handleDelete(recordId) {
  await api.delete(`/api/records/${recordId}`)
  setRecords(prev => prev.filter(r => r.id !== recordId))
  toast.success('Đã xóa ghi chép')
}
```

**FlagDialog:**
```
src/components/FlagDialog/FlagDialog.jsx
  ├── Modal nhỏ, input textarea "Lý do gắn cờ"
  ├── Validate: không được để trống
  └── [Hủy] [Xác nhận gắn cờ]
```

---

### Step 4.5 — Filter & Pagination ✅ ĐÃ XONG

**Filter bar** (trên RecordList trong Dashboard):
```
[Tất cả] [Mới] [Đã xem] [Đã duyệt] [Flagged]   ←  status tabs
[Date range picker]  [Người gửi dropdown]          ←  secondary filters
```

**URL sync (tùy chọn):** Đồng bộ filter vào `?status=new&page=2` để refresh không mất state.

**Pagination state flow:**
```
filter thay đổi → reset page về 1 → fetch records mới
page thay đổi   → fetch records trang mới (giữ filter)
```

---

### Step 4.6 — Error & Loading States ✅ ĐÃ XONG

```
Loading: Skeleton loader cho SummaryCards (4 card placeholder)
         Skeleton rows cho RecordList (5 dòng mờ)
         Spinner overlay cho RecordDetail khi đang fetch

API Error:
  Dashboard summary fail → hiện banner "Không tải được dữ liệu" + nút Thử lại
  RecordList fail       → empty state với icon lỗi + Thử lại
  Action fail           → toast.error với message từ API response

401 tự động: interceptor trong api.js redirect về /login
```

---

### Kiểm tra Phase 4 ✅ ĐÃ XONG

```
Dashboard:
  [x] SummaryCards hiển thị số thật từ /api/dashboard/summary
  [x] Polling 30s — useDashboardSummary dùng setInterval(fetch, 30_000) + clearInterval on unmount
  [x] Skeleton loading hiển thị đúng khi chờ API (skeleton per card)

RecordList:
  [x] Danh sách records load từ DB — useRecordsQuery gọi GET /api/records
  [x] Phân trang hoạt động — RecordList component có pagination, setPage callback
  [x] Filter theo status — Records page có chips: Tất cả / Mới / Đang rà / Đã duyệt / Flagged
  [x] Filter theo platform — chips: Tất cả kênh / Telegram / Zalo
  [x] Search bar — tìm theo ghi chú, mã, người gửi
  [x] Thumbnail ảnh hiển thị (hoặc fallback IMG placeholder)
  [x] Click row → mở RecordDetail Drawer

RecordDetail (RecordDetailDrawer):
  [x] Ảnh load từ Signed URL — image_url dùng trực tiếp, không proxy
  [x] OCR text + ConfidenceBadge (≥85% xanh / ≥60% vàng / <60% đỏ)
  [x] Đổi category → PATCH ngay, không cần nút Save riêng (handleCategoryChange)
  [x] Sửa ghi chú → hiện nút "Lưu ghi chú" khi có thay đổi
  [x] Timeline lịch sử thao tác (render khi record.timeline có data)

Actions:
  [x] Duyệt record → status badge đổi sang "Đã duyệt" ngay (optimistic updateRecord)
  [x] Flag record → FlagDialog mở, nhập lý do, confirm → status đổi
  [x] Xóa record → Modal.confirm → record biến khỏi list (removeRecord)
  [x] Action fail → message.error toast, state không thay đổi sai

Error states:
  [x] Dashboard summary fail → banner "⚠ Không tải được dữ liệu" + nút "↻ Thử lại"
  [x] Ngắt mạng → error state trong hook, không crash
  [x] 401 → api.js interceptor redirect về /login

Files đã tạo / cập nhật:
  # Frontend — Pages
  src/pages/Dashboard/index.jsx              ✅
  src/pages/Dashboard/Dashboard.css          ✅
  src/pages/Records/index.jsx                ✅  (filter bar, sort toggle, tạo record thủ công)
  src/pages/Records/Records.css              ✅  (upload zone, sort toggle, field errors)

  # Frontend — Components
  src/components/AppLayout/index.jsx         ✅  (bell badge, dropdown events, socket connect)
  src/components/AppLayout/AppLayout.css     ✅  (bellBadge, bellDropdown)
  src/components/dashboard/SummaryCards.jsx  ✅
  src/components/records/RecordList.jsx      ✅  (bulk select, checkbox, delete hàng loạt)
  src/components/records/RecordList.css      ✅
  src/components/records/RecordDetailDrawer.jsx ✅  (OCR polling, extracted fields panel)
  src/components/records/RecordDetailDrawer.css ✅  (ocr-processing spinner, field-value styles)
  src/components/records/StatusBadge.jsx     ✅
  src/components/records/PlatformBadge.jsx   ✅
  src/components/records/FlagDialog.jsx      ✅

  # Frontend — Hooks & Services
  src/hooks/useDashboardSummary.js           ✅
  src/hooks/useRecordsQuery.js               ✅  (updateRecord filter-aware, removeRecord)
  src/hooks/useRecordDetail.js               ✅  (refetch() cho OCR polling)
  src/services/dashboard.service.js          ✅
  src/services/record.service.js             ✅  (createRecord multipart, getUsers)
  src/services/socket.js                     ✅  (connectSocket với JWT auth)

  # Frontend — Store & Shared
  src/store/notifications.store.js           ✅  (pendingCount, events, pushNewRecord, syncPending)
  src/styles/components.css                  ✅
  src/App.jsx                                ✅
  src/main.jsx                               ✅

  # Backend — Records
  backend/src/modules/records/records.router.js ✅
    ├─ POST /api/records     (multer upload, Cloudinary, OCR async via setImmediate)
    ├─ GET  /api/records     (thêm sort_order, sender_name CSV filter, search)
    ├─ GET  /api/records/stats    (breakdown theo status)
    └─ GET  /api/records/senders  (distinct sender_name)

  # Backend — Users
  backend/src/modules/users/users.router.js  ✅
    └─ GET /api/users/list   (dropdown người gửi — auth only, no role check)

  # Backend — Notifications
  backend/src/modules/notifications/socket.js          ✅
  backend/src/modules/notifications/notifications.router.js ✅
    └─ GET /api/notifications/summary
```

---

## 📅 PHASE 5 — REALTIME NOTIFICATIONS ✅ ĐÃ XONG
> **Thời gian:** 2 ngày | **Mục tiêu:** Dashboard tự cập nhật khi có record mới
> **Trạng thái (2026-04-24):** Hoàn thành. Socket.io server + client, bell badge, dropdown events, toast notifications, optimistic list update.

### Step 5.1 — Socket.io Server ✅ ĐÃ XONG

**File:** `backend/src/modules/notifications/socket.js`

```js
// JWT auth middleware trong handshake
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  // verify JWT → socket.data.userId
})

// Khi backend xử lý xong record mới từ bất kỳ platform:
io.emit('new_record', {
  record: { id, sender_name, received_at, status },
  count: await getPendingCount()
})

// Khi record bị update (approve/flag/review):
io.emit('record_updated', { record_id, new_status, pending })
```

### Step 5.2 — Socket.io Client (Frontend) ✅ ĐÃ XONG

```
src/services/socket.js
  ├── connectSocket(token) — io(baseURL, { auth: { token } })
  ├── Export singleton instance

src/store/notifications.store.js (Zustand)
  ├── pendingCount    — số badge trên bell icon
  ├── events[]        — danh sách events gần nhất
  ├── pushNewRecord() — thêm event vào đầu mảng, tăng pendingCount
  └── syncPending()   — cập nhật badge từ record_updated event

src/components/AppLayout/index.jsx
  ├── Bell icon với badge đỏ (pendingCount)
  ├── Dropdown list events (click vào mở drawer record)
  └── connectSocket trong useEffect khi có accessToken
```

### Step 5.3 — Toast Notification ✅ ĐÃ XONG

```js
// Ant Design notification API
socket.on('new_record', payload => {
  pushNewRecord(payload)
  notification.info({
    message: 'Record mới',
    description: `${payload.record?.sender_name} vừa gửi record mới`,
    duration: 4,
  })
})
```

### Step 5.4 — Filter-aware Optimistic Update ✅ ĐÃ XONG

Khi nhận `record_updated` — nếu `new_status` không khớp với filter `status` đang active → record tự biến mất khỏi list (không cần reload):

```js
function updateRecord(id, patch) {
  const statusMismatch = patch.status
    && filters.status?.length > 0
    && !filters.status.includes(patch.status)
  setRecords(prev => {
    const updated = prev.map(r => r.id === id ? { ...r, ...patch } : r)
    return statusMismatch ? updated.filter(r => r.id !== id) : updated
  })
  if (statusMismatch) setTotal(t => Math.max(0, t - 1))
}
```

---

## ~~📅 PHASE 6 — QUICK REVIEW MODE~~ ❌ ĐÃ LOẠI BỎ KHỎI SCOPE

> **Quyết định (2026-04-25):** Không triển khai trang Rà soát nhanh riêng biệt.
>
> **Lý do:** Trang Danh sách Record (`/app/records`) đã cung cấp đủ khả năng xử lý hàng loạt:
> - Bulk select + delete nhiều record cùng lúc
> - Filter nhanh theo status (Mới / Đã xem / Đã duyệt / Flagged)
> - Click vào row mở RecordDetail Drawer → Approve/Flag inline
> - Không cần trang full-screen riêng làm phức tạp navigation
>
> **Trạng thái:** Đã xóa khỏi sidebar. Route `/app/quick-review` giữ lại nhưng không link vào nav.

---

## ~~📅 PHASE 7 — SEARCH~~ ❌ ĐÃ TÍCH HỢP VÀO RECORDS PAGE

> **Quyết định (2026-04-25):** Không triển khai trang Search riêng. Tìm kiếm đã được tích hợp trực tiếp vào trang Danh sách Record.
>
> **Đã có trong `/app/records`:**
> - Search bar tìm theo ghi chú, người gửi, nội dung OCR
> - Filter theo status, platform, date range, sender
> - Filter theo loại tài liệu (qua trang `/app/doc-types`)
> - Phân trang 20/50/100 items + first/last buttons
>
> **Lý do:** Trang Search riêng tạo ra UX phân mảnh — người dùng phải chuyển giữa 2 trang để làm cùng 1 việc. Tích hợp tìm kiếm tại chỗ tiện lợi và nhất quán hơn.
>
> **Trạng thái:** Đã xóa khỏi sidebar. Route `/app/search` giữ lại nhưng không link vào nav.

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

# Test webhook Telegram locally
curl -X POST http://localhost:3000/webhook/telegram \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>" \
  -d '{"update_id":1,"message":{"message_id":1,"from":{"id":123,"first_name":"Nguyen A"},"chat":{"id":-456,"type":"group"},"text":"Test ghi chú"}}'

# Test webhook Zalo locally
curl -X POST http://localhost:3000/webhook/zalo \
  -H "Content-Type: application/json" \
  -H "X-Zalo-Signature: <computed_hmac>" \
  -d '{"event_name":"user_send_image","sender":{"id":"123","display_name":"Nguyen A"}}'

# Kiểm tra danh sách platform hoạt động
curl http://localhost:3000/webhook/platforms

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
RecordList trống → "Chưa có ghi chép nào. Nhân viên gửi ảnh qua Telegram hoặc Zalo để bắt đầu."
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
□ Webhook signature verification hoạt động (Telegram secret token + Zalo HMAC)
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
- [ ] Telegram Webhook URL cập nhật sang production URL (auto qua setWebhook khi start)
- [ ] Zalo OA Webhook URL cập nhật sang production URL (thủ công qua OA Dashboard)
- [ ] Sentry DSN production khác với development
- [ ] Deploy server tại Việt Nam (VNG Cloud / FPT Cloud) nếu cần tuân thủ Nghị định 13/2023

---

## 📊 TỔNG KẾT TIMELINE

| Phase | Nội dung | Thời gian | Trạng thái |
|-------|----------|-----------|------------|
| 0 | Foundation & DB Setup (8 bảng + Security) | 2 ngày | ✅ Hoàn thành |
| 1 | Multi-Platform Connector (Telegram+Zalo) + OCR + ngrok | 5 ngày | ✅ Hoàn thành |
| 2 | Backend API đầy đủ + JWT + Audit | 4 ngày | ✅ Hoàn thành |
| 3 | Frontend Auth + Layout (sidebar collapsible, nav 4 mục) | 2 ngày | ✅ Hoàn thành |
| 4 | Dashboard & Review + search/filter tích hợp | 4 ngày | ✅ Hoàn thành |
| 5 | Realtime WebSocket + Bell notification | 2 ngày | ✅ Hoàn thành |
| ~~6~~ | ~~Quick Review Mode~~ | — | ❌ Loại bỏ — tích hợp vào Records page |
| ~~7~~ | ~~Search riêng biệt~~ | — | ❌ Loại bỏ — search tích hợp trong Records |
| 6 (cũ 8) | Reports Excel/PDF | 3 ngày | 🔲 Chưa bắt đầu |
| 7 (cũ 8b) | Observability (Sentry + Winston) | 1 ngày | 🔲 Chưa bắt đầu |
| 8 (cũ 9) | Polish & Security Checklist & Deploy | 3 ngày | 🔲 Chưa bắt đầu |
| **Tổng còn lại** | | **~7 ngày** | |

---

## 🚦 THỨ TỰ DEPENDENCY (đã cập nhật)

```
Phase 0 (DB) ✅
    └─► Phase 1 (Multi-Platform Connector) ✅
    └─► Phase 2 (API) ✅
            └─► Phase 3 (Frontend Login + Layout) ✅
                    └─► Phase 4 (Dashboard + Records + Search tích hợp) ✅
                            ├─► Phase 5 (Realtime) ✅
                            └─► Phase 6 (Reports)
                                    └─► Phase 7 (Observability)
                                            └─► Phase 8 (Deploy)
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

### 🔴 IMP-02: Bot Conversational đa nền tảng (Ưu tiên cao)

```
Thay vì: nhân viên gửi ảnh + text tự do (không cấu trúc)
Thành:   bot dẫn dắt từng bước (hoạt động trên Telegram và Zalo)

Flow (Telegram hoặc Zalo — cùng logic):
NV: "/hoadon"
Bot: "Vui lòng gửi ảnh hóa đơn"
NV: [Ảnh]
Bot: "Số tiền là bao nhiêu?"
NV: "2.500.000"
Bot: "✅ Đã lưu hóa đơn 2.500.000đ"

→ Cần: session state lưu Redis (key: platform:user_id) + conversation flow engine
→ Connector Pattern cho phép implement 1 lần, deploy trên cả Telegram lẫn Zalo
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
