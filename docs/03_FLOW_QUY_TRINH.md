# 🔄 FLOW QUY TRÌNH — QUAN LY GHI CHEP
> Phiên bản: 2.0 | Cập nhật: 2026-04-21 (multi-platform — Telegram · Zalo · Discord...)

---

## 🗺️ TỔNG QUAN CÁC LUỒNG

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CÁC LUỒNG CHÍNH                                │
│                                                                      │
│  FL-01  📨 Nhận & Xử lý tin nhắn đa nền tảng       (Core Flow)    │
│  FL-02  👔 Quản lý rà soát & duyệt records          (Review Flow)  │
│  FL-03  📊 Tạo & xuất báo cáo                       (Report Flow)  │
│  FL-04  🔍 Tìm kiếm & lọc dữ liệu                  (Search Flow)  │
│  FL-05  ⚡ Rà soát nhanh hàng loạt                  (Quick Flow)   │
│  FL-06  🔔 Thông báo realtime                        (Notify Flow)  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## FL-01 📨 Nhận & Xử lý tin nhắn đa nền tảng

> **Trigger:** Nhân viên gửi tin nhắn qua bất kỳ platform được hỗ trợ (Telegram / Zalo / Discord...)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  👤 NHÂN VIÊN                                                        │
│       │                                                              │
│       ├─ 1. Chụp màn hình hoặc chọn ảnh                            │
│       ├─ 2. Gõ ghi chú kèm theo (tùy chọn)                         │
│       └─ 3. GỬI vào group / chat với Bot                            │
│               ├─ Telegram Group ──────────────────────────────────► │
│               ├─ Zalo OA (@mention) ──────────────────────────────► │
│               └─ Discord Channel (V1.1) ──────────────────────────► │
│                                                                      │
│  🔌 CONNECTOR LAYER (Platform-Specific)                              │
│       │                                                              │
│       ├─ 4a. [Telegram] POST /webhook/telegram                      │
│       │       ├─ Verify: X-Telegram-Bot-Api-Secret-Token            │
│       │       └─ Parse: Update → NormalizedMessage                  │
│       │                                                              │
│       ├─ 4b. [Zalo] POST /webhook/zalo                              │
│       │       ├─ Verify: HMAC-SHA256 signature                      │
│       │       └─ Parse: Payload → NormalizedMessage                 │
│       │                                                              │
│       └─ 4c. [Discord] POST /webhook/discord (V1.1)                 │
│               ├─ Verify: Bot Token                                   │
│               └─ Parse: Interaction → NormalizedMessage             │
│                                                                      │
│  ⚙️  MESSAGE PROCESSOR (Platform-Agnostic)                           │
│       │                                                              │
│       ├─ 5. Kiểm tra duplicate                                       │
│       │       WHERE platform = ? AND platform_message_id = ?        │
│       │       └─ [Đã có] → ❌ Bỏ qua, return 200                    │
│       │                                                              │
│       ├─ 6. Xác định loại tin nhắn                                  │
│       │       ├─ [Có ảnh + text] → bước 7                          │
│       │       ├─ [Chỉ có ảnh]   → bước 7, note trống              │
│       │       ├─ [Chỉ có text]  → bước 9, skip OCR                │
│       │       └─ [Sticker/Voice/Video/Reaction] → ❌ Bỏ qua        │
│       │                                                              │
│       ├─ 7. Upsert user trong DB                                     │
│       │       UPSERT ON CONFLICT (platform, platform_user_id)       │
│       │                                                              │
│       ├─ 8. Tải ảnh qua platform API → upload Storage               │
│       │       ├─ [Telegram] getFile API → download URL              │
│       │       ├─ [Zalo] OA Access Token → download                  │
│       │       └─ Upload lên Cloudinary/S3 → Signed URL              │
│       │                                                              │
│       ├─ 9. Chạy OCR Engine                                         │
│       │       ├─ [OCR thành công] → lưu ocr_text                   │
│       │       └─ [OCR thất bại]  → lưu ocr_text = null             │
│       │                                                              │
│       ├─ 10. INSERT record vào Database                              │
│       │        status = "new", platform = ?, received_at = now()    │
│       │                                                              │
│       └─ 11. Emit WebSocket → Dashboard ──────────────────────────►│
│                                                                      │
│  🖥️ DASHBOARD (Quản lý)                                              │
│       │                                                              │
│       └─ 12. 🔔 Badge "+1 record mới" + toast notification          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### NormalizedMessage — Contract giữa Connector và Processor

```js
{
  platform:           'telegram' | 'zalo' | 'discord',
  platform_message_id: string,    // dùng chống duplicate
  platform_user_id:   string,     // ID user trên platform
  sender_name:        string,
  source_chat_id:     string,
  source_chat_type:   'private' | 'group' | 'channel',
  message_type:       'image' | 'text' | 'image_text' | 'other',
  image_file_id:      string | null,   // ID để gọi download API
  image_url:          string | null,   // URL trực tiếp (Discord CDN)
  text_note:          string | null,
  received_at:        Date,
  raw:                object           // payload gốc để debug
}
```

### Trạng thái Record theo thời gian

```
  GỬI TỪ PLATFORM         BACKEND XỬ LÝ         QUẢN LÝ HÀNH ĐỘNG
       │                      │                       │
       ▼                      ▼                       ▼
  [📨 Đang gửi]  ──►  [⏳ Đang xử lý]  ──►  [🆕 Mới (new)]
                                                       │
                                        ┌──────────────┼──────────────┐
                                        ▼              ▼              ▼
                                 [✅ Đã duyệt]  [🚩 Flagged]  [✏️ Đã sửa]
                                  (approved)     (flagged)     (edited)
```

---

## FL-02 👔 Quản lý rà soát & duyệt

> **Trigger:** Quản lý mở Dashboard và xem danh sách records

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  👔 QUẢN LÝ                                                          │
│       │                                                              │
│       ├─ 1. Đăng nhập vào Web Dashboard                             │
│       │                                                              │
│       ├─ 2. Xem danh sách records (mặc định: mới nhất / chưa xem) │
│       │       └─ Mỗi record hiển thị:                               │
│       │           ├─ 🖼️  Thumbnail ảnh                             │
│       │           ├─ 👤  Tên nhân viên gửi                         │
│       │           ├─ 🔌  Platform nguồn (Telegram / Zalo / ...)    │
│       │           ├─ 📅  Thời gian nhận                            │
│       │           ├─ 📝  Preview 50 ký tự đầu ghi chú             │
│       │           └─ 🏷️  Trạng thái (Mới/Duyệt/Flag)             │
│       │                                                              │
│       ├─ 3. Click vào record → Xem chi tiết                        │
│       │       ├─ 🖼️  Ảnh full size (Signed URL, hết hạn 1h)       │
│       │       ├─ 📝  Ghi chú đầy đủ                               │
│       │       ├─ 🤖  Text OCR nhận dạng được                      │
│       │       ├─ 🔌  Platform + Chat ID nguồn                      │
│       │       └─ ℹ️  Metadata (người gửi, thời gian)              │
│       │                                                              │
│       └─ 4. Chọn hành động:                                         │
│               │                                                      │
│               ├─ [✅ DUYỆT] ──────────────────────────────────────►│
│               │   status = "approved"                                │
│               │   approved_by, approved_at = now()                  │
│               │                                                      │
│               ├─ [🚩 FLAG] ───────────────────────────────────────►│
│               │   status = "flagged"                                 │
│               │   flag_reason = ghi chú của quản lý                 │
│               │   → Connector gửi reply về đúng platform gốc:      │
│               │       Telegram → Bot reply tin nhắn                 │
│               │       Zalo    → OA gửi message qua API              │
│               │       Discord → Bot mention @user (V1.1)            │
│               │                                                      │
│               ├─ [✏️ CHỈNH SỬA] ──────────────────────────────────►│
│               │   Cho phép sửa: note, category                      │
│               │   Lưu edit_log (ai sửa, lúc nào, sửa gì)           │
│               │                                                      │
│               └─ [🗑️ XÓA] ─────────────────────────────────────────►│
│                   Soft delete (không xóa hẳn, ẩn khỏi list)        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## FL-03 📊 Tạo & xuất báo cáo

> **Trigger:** Quản lý chọn "Tạo báo cáo" từ menu

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  👔 QUẢN LÝ                                                          │
│       │                                                              │
│       ├─ 1. Vào module Báo cáo                                      │
│       │                                                              │
│       ├─ 2. Cấu hình báo cáo                                        │
│       │       ├─ 📅 Chọn kỳ: Ngày / Tuần / Tháng / Quý / Tùy chọn│
│       │       ├─ 🔌 Lọc theo platform: Tất cả / Telegram / Zalo    │
│       │       ├─ 👤 Lọc theo nhân viên (tùy chọn)                  │
│       │       ├─ 🏷️ Lọc theo danh mục (tùy chọn)                  │
│       │       └─ 📌 Lọc theo trạng thái (tùy chọn)                │
│       │                                                              │
│       └─ 3. Nhấn "TẠO BÁO CÁO"                                     │
│                                                                      │
│  🖥️ BACKEND SERVER                                                   │
│       │                                                              │
│       ├─ 4. Query Database theo điều kiện đã chọn                   │
│       │       (thêm WHERE platform = ? nếu có lọc)                 │
│       │                                                              │
│       ├─ 5. Tổng hợp dữ liệu:                                       │
│       │       ├─ Đếm tổng records theo kỳ                           │
│       │       ├─ Phân nhóm theo platform (Telegram/Zalo/...)        │
│       │       ├─ Phân nhóm theo nhân viên                          │
│       │       ├─ Phân nhóm theo danh mục                           │
│       │       └─ Thống kê trạng thái (duyệt/flag/chờ)              │
│       │                                                              │
│       ├─ 6. Tạo file xuất                                            │
│       │       ├─ [Excel] → ExcelJS → .xlsx có cột Platform         │
│       │       └─ [PDF]   → PDFKit → .pdf có bảng theo platform     │
│       │                                                              │
│       └─ 7. Trả về file để tải về                                   │
│                                                                      │
│  👔 QUẢN LÝ                                                          │
│       │                                                              │
│       └─ 8. Tải file về máy / In / Gửi email                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## FL-04 🔍 Tìm kiếm & lọc

> **Trigger:** Người dùng nhập từ khóa vào thanh search

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  👔 QUẢN LÝ                                                          │
│       │                                                              │
│       ├─ 1. Nhập từ khóa vào thanh tìm kiếm                        │
│       │       VÀ/HOẶC thiết lập bộ lọc nâng cao:                   │
│       │       ├─ 🔌 Platform: [☑ Telegram] [☑ Zalo] [☑ Discord]   │
│       │       ├─ 📅 Khoảng thời gian                               │
│       │       ├─ 👤 Nhân viên                                       │
│       │       ├─ 🏷️ Danh mục                                       │
│       │       └─ 📌 Trạng thái                                      │
│       │                                                              │
│       └─ 2. Nhấn Tìm kiếm (hoặc Enter)                             │
│                                                                      │
│  🖥️ BACKEND SERVER                                                   │
│       │                                                              │
│       ├─ 3. Nhận query params                                        │
│       │                                                              │
│       ├─ 4. Thực hiện tìm kiếm:                                     │
│       │       ├─ Full-text search (GIN index): note + ocr_text      │
│       │       ├─ Filter theo platform (nếu có)                      │
│       │       ├─ Filter theo date range                             │
│       │       ├─ Filter theo sender_name                            │
│       │       └─ Filter theo category / status                      │
│       │                                                              │
│       └─ 5. Trả về danh sách kết quả có phân trang (20/trang)      │
│                                                                      │
│  👔 QUẢN LÝ                                                          │
│       │                                                              │
│       ├─ 6. Xem kết quả dạng grid/list với highlight từ khóa       │
│       │       (mỗi record hiển thị badge platform nguồn)            │
│       └─ 7. Click vào record → xem chi tiết (FL-02)                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## FL-05 ⚡ Rà soát nhanh

> **Trigger:** Quản lý chọn "Rà soát nhanh" từ Dashboard

```
  👔 QUẢN LÝ mở chế độ Quick Review
         │
         ▼
  Hệ thống load danh sách records có status = "new"
  (sắp xếp theo thời gian nhận, cũ nhất trước)
         │
         ▼
  ┌─────────────────────────────────────────────────┐
  │  Hiển thị record #1                              │
  │  [← Trước] Record 1/15 [Tiếp →]                │
  │  🔌 Platform: Telegram  |  👤 Nguyễn Văn A      │
  └─────────────────────────────────────────────────┘
         │
         ▼
  Quản lý xem → chọn action:

  [✅ Duyệt] ──► status = approved ──► Tự động chuyển record tiếp theo
  [🚩 Flag]  ──► Nhập lý do ──► status = flagged
                 → Reply về platform gốc ──► Chuyển tiếp theo
  [⏩ Bỏ qua] ──► Giữ nguyên status ──► Chuyển tiếp theo
  [✏️ Sửa]   ──► Mở popup sửa inline ──► Lưu ──► Chuyển tiếp theo
         │
         ▼
  [Hết records] → Hiển thị "✅ Đã rà soát xong 15 records"
```

---

## FL-06 🔔 Thông báo realtime

> **Trigger:** Các sự kiện trong hệ thống

```
  SỰ KIỆN                              THÔNG BÁO ĐẾN              KÊNH
  ─────────────────────────────────────────────────────────────────────
  📨 Record mới từ Telegram       →  👔 Quản lý (Dashboard)  →  🔔 Bell badge + toast
  📨 Record mới từ Zalo           →  👔 Quản lý (Dashboard)  →  🔔 Bell badge + toast
  📨 Record mới từ Discord (V1.1) →  👔 Quản lý (Dashboard)  →  🔔 Bell badge + toast

  🚩 Record bị Flag (Telegram)    →  👤 Nhân viên            →  🤖 Bot reply trực tiếp
  🚩 Record bị Flag (Zalo)        →  👤 Nhân viên            →  📱 OA gửi message
  🚩 Record bị Flag (Discord)     →  👤 Nhân viên            →  💬 Bot mention @user

  📊 Báo cáo đã tạo xong          →  👔 Quản lý (Dashboard)  →  🔔 Bell badge + auto download

  ⚠️ OCR thất bại                  →  🖥️ Admin log            →  📋 Error log (Winston/Sentry)
```

### Chi tiết luồng Flag → Reply về platform gốc

```
  👔 Manager click [🚩 Flag] trên Dashboard
         │
         ▼
  Backend: UPDATE records SET status='flagged', flag_reason=?
  + Ghi audit_log
         │
         ▼
  Đọc record.platform để biết platform gốc
         │
         ├─ platform = 'telegram'
         │       TelegramConnector.reply(platform_user_id, flag_reason)
         │       → Bot API: sendMessage(chat_id, text)
         │
         ├─ platform = 'zalo'
         │       ZaloConnector.reply(platform_user_id, flag_reason)
         │       → OA API: sendMessage(to_user_id, text)
         │
         └─ platform = 'discord' (V1.1)
                 DiscordConnector.reply(platform_user_id, flag_reason)
                 → Bot API: createMessage với @mention
```

---

## 🗃️ TRẠNG THÁI RECORD — State Diagram

```
                    ┌─────────────┐
                    │             │
         ┌──────────►   🆕 NEW    │◄── INSERT từ MessageProcessor
         │          │             │
         │          └──────┬──────┘
         │                 │
         │    ┌────────────┼────────────┐
         │    ▼            ▼            ▼
         │ ┌──────┐  ┌──────────┐  ┌────────┐
         │ │  ✅  │  │    🚩    │  │   ✏️  │
         │ │APPROV│  │ FLAGGED  │  │ EDITED │
         │ │  ED  │  │          │  │        │
         │ └──────┘  └────┬─────┘  └───┬────┘
         │                │             │
         │                └──── Re-submit ──► (về NEW)
         │
         └─────────── (Quản lý có thể đặt lại về NEW)
```

---

## 📐 API ENDPOINTS

```
# Webhook (nhận từ platform)
POST   /webhook/:platform             ← Dynamic: /webhook/telegram, /webhook/zalo, ...
GET    /webhook/platforms             ← Danh sách platform đang hoạt động

# Records
GET    /api/records                   ← Danh sách records (filter: platform, status, date, ...)
GET    /api/records/:id               ← Chi tiết 1 record
PATCH  /api/records/:id/status        ← Cập nhật trạng thái (approve/flag)
PATCH  /api/records/:id               ← Chỉnh sửa note/category
DELETE /api/records/:id               ← Soft delete

# Reports
GET    /api/reports                   ← Danh sách báo cáo đã tạo
POST   /api/reports/generate          ← Tạo báo cáo mới (filter có thêm platform)
GET    /api/reports/:id/download      ← Tải file báo cáo

# Search
GET    /api/search?q=&platform=...    ← Tìm kiếm full-text (hỗ trợ filter platform)

# Dashboard
GET    /api/dashboard/summary         ← Tổng quan số liệu (breakdown theo platform)

# Auth
POST   /api/auth/login                ← Đăng nhập → Access Token + Refresh Token
POST   /api/auth/refresh              ← Làm mới Access Token
POST   /api/auth/logout               ← Hủy Refresh Token
```
