# 🔄 FLOW QUY TRÌNH — QUAN LY GHI CHEP
> Phiên bản: 3.0 | Cập nhật: 2026-04-24 (thêm FL-07 tạo record thủ công; cập nhật FL-01, FL-06)

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
│  FL-06  🔔 Thông báo realtime (Socket.io)            (Notify Flow)  │
│  FL-07  🖊️  Tạo record thủ công qua Web Form        (Manual Flow)  │
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
│       ├─ 9. Chạy OCR + AI Extraction                                 │
│       │       ├─ OCR Engine → ocr_text, ocr_confidence              │
│       │       ├─ AI classify → document_type_id (gợi ý)             │
│       │       ├─ AI extract fields → record_field_values            │
│       │       └─ [Thất bại] → ocr_status='failed', ghi log         │
│       │                                                              │
│       ├─ 10. INSERT record vào Database                              │
│       │        status = "new", platform = ?, received_at = now()    │
│       │        ocr_status, extraction_status, extracted_data        │
│       │                                                              │
│       └─ 11. Emit Socket.io → Dashboard ──────────────────────────►│
│               event: "new_record"                                    │
│               payload: { record: {id, sender_name, ...}, count }    │
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

## FL-06 🔔 Thông báo realtime (Socket.io)

> **Trigger:** Các sự kiện trong hệ thống
> **Triển khai:** Socket.io v4, JWT auth middleware, phòng (room) per-user

### Socket.io Events

```
  SỰ KIỆN                              SERVER → CLIENT              PAYLOAD
  ─────────────────────────────────────────────────────────────────────────
  📨 Record mới từ Telegram/Zalo/ →  event: "new_record"       →  { record: {id, sender_name,
     Manual (Web Form)                  (broadcast tất cả manager)    received_at, status},
                                                                       count: <số pending> }

  🔄 Record được update trạng thái →  event: "record_updated"   →  { record_id, new_status,
     (approve / flag / review)          (broadcast tất cả manager)    pending: <số còn mới> }

  🚩 Record bị Flag (Telegram)    →  Platform Connector         →  Bot reply trực tiếp
  🚩 Record bị Flag (Zalo)        →  Platform Connector         →  OA gửi message

  ⚠️ OCR thất bại                  →  Server log                →  Winston / Sentry
```

### Luồng kết nối Socket.io (Frontend)

```
  Frontend khởi động (login xong)
         │
         ▼
  1. GET /api/notifications/summary → { pending: N }
     → Khởi tạo badge số trên bell icon
         │
         ▼
  2. connectSocket(accessToken)
     → io(baseURL, { auth: { token } })
     → Server verify JWT trong handshake middleware
         │
         ▼
  3. Lắng nghe sự kiện:

  socket.on("new_record", payload => {
    pushNewRecord(payload)           // Zustand store: thêm vào events[]
    notify.info(...)                 // Ant Design toast
  })

  socket.on("record_updated", payload => {
    syncPending(payload.pending)     // Cập nhật badge số
    updateRecord(id, { status })     // Cập nhật list ngay (filter-aware)
  })
```

### Luồng Flag → Reply về platform gốc

```
  👔 Manager click [🚩 Flag] trên Dashboard
         │
         ▼
  Backend: UPDATE records SET status='flagged', flag_reason=?
  + Ghi audit_log
  + io.emit("record_updated", { record_id, new_status: 'flagged', pending })
         │
         ▼
  Đọc record.platform để reply về platform gốc:
         │
         ├─ platform = 'telegram'
         │       TelegramConnector.reply(platform_user_id, flag_reason)
         │
         ├─ platform = 'zalo'
         │       ZaloConnector.reply(platform_user_id, flag_reason)
         │
         ├─ platform = 'manual' / 'web'
         │       Không reply ra ngoài (record tạo thủ công)
         │
         └─ platform = 'discord' (V1.1)
                 DiscordConnector.reply(platform_user_id, flag_reason)
```

---

## FL-07 🖊️ Tạo record thủ công qua Web Form

> **Trigger:** Quản lý / Staff nhấn "Tạo record" trên trang Danh sách Records

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  👔 QUẢN LÝ / STAFF                                                  │
│       │                                                              │
│       ├─ 1. Nhấn nút "+ Tạo record" trên trang /app/records        │
│       │                                                              │
│       ├─ 2. Điền form (popup):                                       │
│       │       ├─ Người gửi: [Dropdown danh sách system users]       │
│       │       ├─ Ghi chú: [Textarea] (bắt buộc nếu không có ảnh)  │
│       │       ├─ Danh mục: [Dropdown] (tùy chọn)                   │
│       │       └─ Ảnh đính kèm: [Upload zone / drag-drop]           │
│       │           ├─ Tối đa 3 ảnh                                   │
│       │           └─ Chỉ chấp nhận image/* (jpg, png, webp...)     │
│       │                                                              │
│       └─ 3. Nhấn "Tạo record"                                       │
│                                                                      │
│  🖥️ FRONTEND                                                          │
│       │                                                              │
│       ├─ 4. Validate:                                                │
│       │       ├─ sender_id bắt buộc                                 │
│       │       └─ note HOẶC có ít nhất 1 ảnh                        │
│       │                                                              │
│       └─ 5. POST /api/records (multipart/form-data)                 │
│               ├─ fields: sender_id, sender_name, note, ...          │
│               └─ files: images[] (tối đa 3)                         │
│                                                                      │
│  🖥️ BACKEND                                                           │
│       │                                                              │
│       ├─ 6. [Không có ảnh]                                           │
│       │       INSERT record: platform='manual', ocr_status='success'│
│       │       extraction_status='done' → 201 Created                │
│       │                                                              │
│       └─ 7. [Có ảnh]                                                 │
│               a. Upload ảnh lên Cloudinary → { image_url, thumb }   │
│               b. INSERT record: ocr_status='pending'                │
│               c. Trả 201 ngay (không block)                         │
│               d. setImmediate → OCR pipeline (nền):                 │
│                   ├─ ocrService.extractText(image_url)              │
│                   ├─ normalize() → document_type, field_values       │
│                   ├─ rfvService.upsertMany()                         │
│                   └─ UPDATE record: ocr_status, extraction_status,   │
│                       document_type_id, extracted_data               │
│                                                                      │
│  🖥️ FRONTEND (sau khi tạo xong)                                       │
│       │                                                              │
│       ├─ 8. Mở drawer chi tiết record vừa tạo                       │
│       │                                                              │
│       └─ 9. [Nếu ocr_status = 'pending']                            │
│               Poll GET /api/records/:id mỗi 3 giây                  │
│               → Khi ocr_status != 'pending' → dừng poll             │
│               → Hiển thị kết quả OCR + extracted fields             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Validation rules:**
- `sender_id` bắt buộc (dropdown chọn từ danh sách system users)
- Phải có ít nhất 1 trong: `note` (text) hoặc `images[]` (file)
- Tối đa 3 ảnh, mỗi file tối đa 10 MB, chỉ nhận `image/*`

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
GET    /api/records                   ← Danh sách records
                                         ?status=new,reviewed   (CSV)
                                         ?platform=telegram,manual
                                         ?sender_name=Nguyễn A  (CSV)
                                         ?search=hóa đơn
                                         ?date_from=&date_to=
                                         ?sort_order=desc|asc    ← MỚI
                                         ?category_id=&document_type_id=
                                         ?include_field_values=true
                                         ?fv[amount][gte]=1000000
POST   /api/records                   ← Tạo record thủ công (multipart/form-data) ← MỚI
GET    /api/records/stats             ← Đếm breakdown theo status (cho overview cards) ← MỚI
GET    /api/records/senders           ← Danh sách tên người gửi distinct ← MỚI
GET    /api/records/:id               ← Chi tiết 1 record (kèm field_values)
PATCH  /api/records/:id/status        ← Cập nhật trạng thái (approve/flag/reviewed)
PATCH  /api/records/:id               ← Chỉnh sửa note/category/document_type/field_values
DELETE /api/records/:id               ← Soft delete

# Users
GET    /api/users/list                ← Danh sách user rút gọn (dropdown người gửi) ← MỚI
GET    /api/users                     ← Danh sách đầy đủ (admin/manager)
POST   /api/users                     ← Tạo user nội bộ
GET    /api/users/:id
PATCH  /api/users/:id/activate
POST   /api/users/:id/reset-password
PATCH  /api/users/:id/role

# Document Types
GET    /api/document-types            ← Danh sách loại tài liệu
POST   /api/document-types            ← Tạo loại tài liệu
GET    /api/document-types/:id        ← Chi tiết + fields
PATCH  /api/document-types/:id        ← Cập nhật metadata
GET    /api/document-types/:id/fields ← Danh sách trường
POST   /api/document-types/:id/fields ← Thêm trường
PATCH  /api/document-types/:id/fields/:fieldId ← Cập nhật trường
DELETE /api/document-types/:id/fields/:fieldId ← Xóa trường (admin only)

# Categories
GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id

# Notifications (Socket.io + REST)
GET    /api/notifications/summary     ← Số lượng record pending (badge khởi tạo) ← MỚI
# Socket events: "new_record", "record_updated"

# Reports
GET    /api/reports/summary           ← Thống kê by_status/platform/doc-type/category/timeline
GET    /api/reports/financial         ← Báo cáo tài chính (aggregation_type=sum)
GET    /api/reports/by-type/:code     ← Báo cáo chi tiết theo loại tài liệu

# Search
GET    /api/search?q=&platform=...    ← Tìm kiếm full-text (GIN index)

# Dashboard
GET    /api/dashboard/summary         ← Tổng quan số liệu today/this_week/pending_review

# Auth
POST   /api/auth/login                ← Đăng nhập → Access Token + Refresh Token
POST   /api/auth/refresh              ← Làm mới Access Token (token rotation)
POST   /api/auth/logout               ← Hủy Refresh Token
POST   /api/auth/logout-all           ← Hủy tất cả sessions
GET    /api/auth/me                   ← Thông tin user đang đăng nhập
POST   /api/auth/change-password      ← Đổi mật khẩu
```
