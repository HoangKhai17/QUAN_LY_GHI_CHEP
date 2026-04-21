# 🔐 THIẾT KẾ BẢO MẬT — QUAN LY GHI CHEP
> Chuẩn tham chiếu: OWASP Top 10, ISO 27001, Nghị định 13/2023/NĐ-CP (PDPD Việt Nam)
> Phiên bản: 2.0 | Cập nhật: 2026-04-21

---

## 🏛️ Nguyên tắc bảo mật nền tảng

```
┌─────────────────────────────────────────────────────────┐
│             CIA TRIAD — Tam giác bảo mật                 │
│                                                          │
│         🔒 Confidentiality    Chỉ người có quyền mới    │
│              (Bảo mật)        được xem dữ liệu          │
│                                                          │
│         🛡️  Integrity         Dữ liệu không bị          │
│              (Toàn vẹn)       thay đổi trái phép        │
│                                                          │
│         ⚡ Availability       Hệ thống luôn sẵn sàng    │
│              (Khả dụng)       khi cần truy cập          │
└─────────────────────────────────────────────────────────┘
```

---

## 🗺️ SECURITY ARCHITECTURE OVERVIEW

```
INTERNET
    │
    ▼
┌───────────────────────────────────────────────────────────┐
│  🌐 LAYER 1 — NETWORK SECURITY                            │
│  ├─ Cloudflare WAF (Web Application Firewall)             │
│  ├─ DDoS Protection                                       │
│  └─ Rate Limiting (100 req/min per IP)                    │
└───────────────────┬───────────────────────────────────────┘
                    │ HTTPS (TLS 1.3)
                    ▼
┌───────────────────────────────────────────────────────────┐
│  🔑 LAYER 2 — AUTHENTICATION & AUTHORIZATION             │
│  ├─ JWT Access Token (15 phút) + Refresh Token (7 ngày)  │
│  ├─ RBAC: Manager / Staff / Admin                        │
│  └─ Webhook Signature Verification (per-platform: HMAC / Secret Token)                   │
└───────────────────┬───────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────┐
│  ⚙️  LAYER 3 — APPLICATION SECURITY                       │
│  ├─ Input Validation & Sanitization                       │
│  ├─ SQL Injection Prevention (ORM + Parameterized Query)  │
│  ├─ XSS Prevention (Content Security Policy)             │
│  └─ CORS Policy (Whitelist domain)                        │
└───────────────────┬───────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────┐
│  💾 LAYER 4 — DATA SECURITY                               │
│  ├─ Encryption at Rest (AES-256)                          │
│  ├─ Encryption in Transit (TLS 1.3)                       │
│  ├─ Database: Row-Level Security (RLS)                    │
│  └─ File Storage: Private bucket + Signed URL            │
└───────────────────┬───────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────┐
│  📋 LAYER 5 — AUDIT & COMPLIANCE                          │
│  ├─ Audit Log mọi thao tác                                │
│  ├─ Immutable Log Storage                                 │
│  └─ Tuân thủ Nghị định 13/2023/NĐ-CP                    │
└───────────────────────────────────────────────────────────┘
```

---

## 🔑 AUTHENTICATION (Xác thực)

### Luồng đăng nhập

```
👔 Quản lý                    🖥️ Backend                     💾 DB
     │                              │                              │
     ├─ POST /auth/login            │                              │
     │   {username, password}  ───► │                              │
     │                              ├─ Verify password (bcrypt) ──►│
     │                              ├─ Generate Access Token (JWT 15min)
     │                              ├─ Generate Refresh Token (7 ngày)
     │                              ├─ Lưu Refresh Token hash ────►│
     │ ◄── {access_token,           │                              │
     │       refresh_token}         │                              │
     │                              │                              │
     │  [15 phút sau]               │                              │
     ├─ POST /auth/refresh      ───►│                              │
     │   {refresh_token}            ├─ Verify Refresh Token ───────►│
     │ ◄── {new_access_token}       │                              │
```

### JWT Token Design

```python
# Access Token Payload
{
  "sub": "user_uuid",
  "role": "manager",           # Phân quyền
  "platform": "telegram",       # Platform đăng nhập
  "iat": 1713600000,
  "exp": 1713600900,           # 15 phút
  "jti": "unique_token_id"     # Chống replay attack
}
```

### Password Policy

| Yêu cầu | Quy định |
|---------|---------|
| Độ dài | Tối thiểu 10 ký tự |
| Phức tạp | Chữ hoa + chữ thường + số + ký tự đặc biệt |
| Lịch sử | Không được dùng lại 5 mật khẩu gần nhất |
| Hết hạn | Bắt buộc đổi sau 90 ngày |
| Thất bại | Khóa 30 phút sau 5 lần sai liên tiếp |

---

## 👮 AUTHORIZATION — RBAC (Phân quyền)

```
┌─────────────────────────────────────────────────────────┐
│                  ROLE-BASED ACCESS CONTROL               │
│                                                          │
│  ROLE: admin                                             │
│  ├─ Quản lý users, roles, cấu hình hệ thống            │
│  ├─ Xem tất cả dữ liệu mọi group                       │
│  └─ Xem audit log                                       │
│                                                          │
│  ROLE: manager                                           │
│  ├─ Xem records của group mình quản lý                 │
│  ├─ Approve / Flag / Edit records                       │
│  ├─ Tạo và tải báo cáo                                 │
│  └─ Tìm kiếm trong phạm vi group                       │
│                                                          │
│  ROLE: staff (Nhân viên — dùng app nhắn tin, không có web)│
│  ├─ Gửi data qua Telegram / Zalo / Discord             │
│  └─ Nhận thông báo từ Bot về platform gốc (khi bị flag)│
└─────────────────────────────────────────────────────────┘
```

### Permission Matrix

| Action | admin | manager | staff |
|--------|-------|---------|-------|
| Xem records | ✅ All | ✅ Own group | ❌ |
| Approve record | ✅ | ✅ | ❌ |
| Flag record | ✅ | ✅ | ❌ |
| Xóa record | ✅ | ⚠️ Soft only | ❌ |
| Tạo báo cáo | ✅ | ✅ | ❌ |
| Quản lý users | ✅ | ❌ | ❌ |
| Xem audit log | ✅ | ❌ | ❌ |

---

## 🔗 WEBHOOK SECURITY (Multi-Platform)

Mỗi platform dùng cơ chế xác thực riêng — được xử lý trong Connector tương ứng:

| Platform | Cơ chế xác thực | Header |
|----------|----------------|--------|
| **Telegram** | Secret Token so sánh hằng thời gian | `X-Telegram-Bot-Api-Secret-Token` |
| **Zalo** | HMAC-SHA256 signature | `X-Zalo-Signature` |
| **Discord** | Bot Token verify | `X-Signature-Ed25519` (V1.1) |

```js
// Ví dụ: Zalo HMAC-SHA256 (trong ZaloConnector)
verify(req) {
  const signature = req.headers['x-zalo-signature'];
  const expected = crypto
    .createHmac('sha256', process.env.ZALO_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)  // Chống timing attack
  );
}

// Ví dụ: Telegram Secret Token (trong TelegramConnector)
verify(req) {
  const token = req.headers['x-telegram-bot-api-secret-token'];
  return crypto.timingSafeEqual(
    Buffer.from(process.env.TELEGRAM_WEBHOOK_SECRET),
    Buffer.from(token)
  );
}
```

---

## 💾 DATA ENCRYPTION

### Encryption at Rest

```
Database (PostgreSQL)
├─ Mã hóa toàn bộ volume (AES-256) — cấp OS/Cloud
├─ Sensitive fields mã hóa ở cấp ứng dụng:
│   ├─ note (TEXT) → pgcrypto encrypt
│   ├─ ocr_text (TEXT) → pgcrypto encrypt
│   └─ sender_name → plain (không sensitive)
└─ Backup files: mã hóa trước khi lưu

File Storage (S3/Cloudinary)
├─ Bucket: Private (không public)
├─ Server-Side Encryption: AES-256
└─ Truy cập qua Signed URL (hết hạn sau 1 giờ)
```

### Signed URL Flow (Truy cập ảnh an toàn)

```
👔 Manager muốn xem ảnh
      │
      ├─ GET /api/records/123
      │         │
      │         ▼ Backend tạo Signed URL (hết hạn 1h)
      │         │ s3.generate_presigned_url(image_key, expires=3600)
      │         │
      ◄── { image_url: "https://s3.../img?sig=xxx&expires=..." }
      │
      └─ Trình duyệt tải ảnh trực tiếp từ S3 (1 lần, không qua backend)
         [URL hết hạn sau 1h → không thể share/bookmark]
```

---

## 📋 AUDIT LOG

### Mọi thao tác quan trọng đều được ghi lại

```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY,
  user_id     UUID,                    -- Ai thực hiện
  action      VARCHAR(50),             -- 'approve', 'flag', 'delete', 'login', ...
  resource    VARCHAR(50),             -- 'record', 'user', 'report'
  resource_id UUID,                    -- ID đối tượng bị tác động
  old_data    JSONB,                   -- Dữ liệu trước khi thay đổi
  new_data    JSONB,                   -- Dữ liệu sau khi thay đổi
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Audit log là IMMUTABLE: chỉ INSERT, không UPDATE/DELETE
-- Dùng PostgreSQL RLS để enforce điều này
```

---

## 🌐 API SECURITY HEADERS

```python
# FastAPI middleware thêm security headers
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' https://s3.amazonaws.com",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}
```

---

## 📜 TUÂN THỦ NGHỊ ĐỊNH 13/2023/NĐ-CP (PDPD Việt Nam)

| Yêu cầu pháp lý | Cách triển khai |
|----------------|----------------|
| Lưu trữ dữ liệu trong nước | Deploy server tại Việt Nam (VNG Cloud / FPT Cloud) |
| Quyền xóa dữ liệu | API xóa account + purge data |
| Giới hạn thu thập | Chỉ lưu dữ liệu cần thiết (không lưu thừa) |
| Thông báo vi phạm | Alert tự động trong vòng 72h |
| Mã hóa dữ liệu cá nhân | AES-256 cho fields chứa PII |

---

## 🔒 SECURITY CHECKLIST TRƯỚC KHI GO-LIVE

```
□ Penetration Testing (Kiểm thử xâm nhập)
□ OWASP Top 10 Audit
□ Dependency vulnerability scan (pip-audit, npm audit)
□ Secrets không được commit lên git (.env, keys)
□ HTTPS enforced (HTTP redirect to HTTPS)
□ Database không expose ra internet (chỉ qua VPN/private network)
□ Backup tự động và test restore
□ Rate limiting đã cấu hình
□ Error messages không lộ stack trace ra ngoài
□ Log không chứa dữ liệu nhạy cảm (password, token)
```
