# 🔐 THIẾT KẾ BẢO MẬT — T&D COMPANY
> Chuẩn tham chiếu: OWASP Top 10, ISO 27001, Nghị định 13/2023/NĐ-CP (PDPD Việt Nam)
> Phiên bản: 1.0 | Cập nhật: 2026-04-20

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
│  └─ Zalo Webhook Signature Verification                   │
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
  "group_ids": ["grp_001"],    # Zalo groups được phép
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
│  ROLE: staff (Nhân viên — dùng Zalo, không có web)     │
│  ├─ Gửi data qua Zalo Group                            │
│  └─ Nhận thông báo từ Bot (khi record bị flag)         │
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

## 🔗 ZALO WEBHOOK SECURITY

```python
# Mỗi request từ Zalo có signature header
# Phải verify trước khi xử lý

import hmac, hashlib

def verify_zalo_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)  # Chống timing attack

# Middleware FastAPI
@app.middleware("http")
async def zalo_webhook_guard(request: Request, call_next):
    if request.url.path == "/webhook/zalo":
        signature = request.headers.get("X-Zalo-Signature")
        body = await request.body()
        if not verify_zalo_signature(body, signature, ZALO_SECRET):
            return JSONResponse(status_code=403, content={"error": "Invalid signature"})
    return await call_next(request)
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
