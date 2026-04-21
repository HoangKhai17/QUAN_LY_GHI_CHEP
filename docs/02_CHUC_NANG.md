# ⚙️ ĐẶC TẢ CHỨC NĂNG — QUAN LY GHI CHEP
> Phiên bản: 2.0 | Cập nhật: 2026-04-21

---

## 📌 F1 — Ghi chép tự động đa nền tảng

> **Module:** M1 Platform Connector + M2 Data Processing + M3 Storage

### Mô tả
Nhân viên sử dụng **bất kỳ app nhắn tin nào được hỗ trợ** (Telegram, Zalo, Discord...) để gửi ảnh kèm ghi chú. Hệ thống tự động nhận qua webhook, chuẩn hóa về cùng format, xử lý OCR và lưu trữ — **không phân biệt nguồn gửi**.

### Luồng chi tiết

```
👤 Nhân viên thao tác trong App nhắn tin (Telegram / Zalo / Discord...)
        │
        ├─ 📸 Chụp màn hình / Chọn ảnh từ gallery
        ├─ ✍️  Gõ ghi chú kèm theo (tên, số liệu, mô tả)
        └─ 📤 Gửi vào group hoặc chat với Bot
                │
                ▼
        🔌 Platform Connector nhận webhook
                │
                ├─ Xác thực chữ ký (HMAC / secret token)
                ├─ Parse payload thô → NormalizedMessage (format chuẩn)
                │     {platform, platform_user_id, message_type, image_file_id, text_note, ...}
                └─ Chuyển sang MessageProcessor
                        │
                        ▼
        ⚙️  MessageProcessor (platform-agnostic)
                │
                ├─ Kiểm tra duplicate (platform + platform_message_id)
                ├─ Upsert user vào DB (platform + platform_user_id)
                ├─ Download ảnh từ platform API → upload Storage
                ├─ OCR → trích xuất text từ ảnh
                └─ INSERT record vào DB (status = "new")
                        │
                        ▼
        ✅ Dữ liệu xuất hiện trên Dashboard + WebSocket emit
```

### Đặc điểm theo từng platform

| Platform | Nhận group message | Xác thực | Download ảnh |
|----------|--------------------|----------|-------------|
| **Telegram Bot** | ✅ 100% (không cần @mention) | Secret token header | `getFile` API |
| **Zalo OA** | ⚠️ Chỉ khi @mention OA | HMAC-SHA256 | OA Access Token |
| **Discord Bot** | ✅ 100% (V1.1) | Bot Token | CDN URL |

### Dữ liệu được lưu

| Trường | Mô tả |
|--------|-------|
| `platform` | Nền tảng gửi: `telegram`, `zalo`, `discord` |
| `platform_message_id` | ID tin nhắn trên platform (chống duplicate) |
| `sender_name` | Tên nhân viên gửi |
| `source_chat_id` | ID group/channel nguồn |
| `image_url` | Đường dẫn ảnh đã lưu (Signed URL) |
| `ocr_text` | Text nhận dạng từ ảnh (OCR) |
| `note` | Ghi chú text kèm theo |
| `category` | Danh mục (thủ công gán trên Dashboard) |
| `status` | `new` / `reviewed` / `approved` / `flagged` |
| `received_at` | Thời điểm nhận từ platform |

### Quy tắc xử lý (giống nhau trên mọi platform)

- ✅ Tin nhắn **có ảnh + text** → lưu đầy đủ cả hai
- ✅ Tin nhắn **chỉ có ảnh** → OCR để lấy text, note để trống
- ✅ Tin nhắn **chỉ có text** → lưu text, image để trống
- ❌ Tin nhắn **không liên quan** (sticker, voice, video, reaction) → bỏ qua, không tạo record

---

## 📌 F2 — Dashboard Quản lý (Xem & Rà soát)

> **Module:** M4 Dashboard + M7 Notification

### Mô tả
Giao diện web cho Quản lý xem toàn bộ dữ liệu ghi chép từ **mọi platform**, rà soát và đánh dấu trạng thái.

### Màn hình chính

```
┌──────────────────────────────────────────────────────────────┐
│  🏠 Dashboard                               🔔 3 mới        │
├───────────┬──────────────────────────────────────────────────┤
│           │  📊 Tổng hôm nay: 24 records                     │
│ 📋 DS ghi │  ┌──────┬──────┬──────┬──────┐                  │
│    chép   │  │ Mới  │Đã xem│Duyệt │ Flag │                  │
│           │  │  8   │  10  │  5   │  1   │                  │
│ 📊 Báo    │  └──────┴──────┴──────┴──────┘                  │
│    cáo    │                                                    │
│           │  🔌 Lọc platform: [Tất cả ▼] [Telegram] [Zalo]  │
│ 🔍 Search │                                                    │
│           │  📋 Danh sách records (mới nhất)                 │
│ ⚙️ Cài    │  ┌──────────────────────────────────────────────┐│
│    đặt    │  │ 🤖 [Ảnh] Nguyễn A | Telegram | 09:30 | Mới  ││
│           │  │ 📱 [Ảnh] Trần B   | Zalo     | 09:15 | Mới  ││
│           │  │ 🤖 [Ảnh] Lê C     | Telegram | 08:50 | Duyệt││
│           │  └──────────────────────────────────────────────┘│
└───────────┴──────────────────────────────────────────────────┘
```

### Tính năng rà soát

| Action | Mô tả |
|--------|-------|
| 👁️ **Xem chi tiết** | Mở ảnh full (Signed URL) + đọc ghi chú + xem OCR |
| ✅ **Duyệt (Approve)** | Xác nhận thông tin hợp lệ |
| 🚩 **Đánh dấu (Flag)** | Ghi lý do → tự động nhắn lại nhân viên qua platform gốc |
| ✏️ **Chỉnh sửa** | Sửa ghi chú hoặc phân loại, lưu audit log |
| 🗑️ **Xóa** | Soft delete |

---

## 📌 F3 — Tạo báo cáo

> **Module:** M5 Report

### Các loại báo cáo

| Kỳ báo cáo | Mô tả |
|-----------|-------|
| 📅 **Ngày** | Tổng hợp tất cả records trong 1 ngày |
| 📅 **Tuần** | Tổng hợp theo tuần (T2–CN) |
| 📅 **Tháng** | Tổng hợp theo tháng |
| 📅 **Quý** | Q1/Q2/Q3/Q4 |

### Bộ lọc khi tạo báo cáo

```
🔧 Tùy chọn báo cáo
├── 📅 Chọn kỳ: [Ngày ▼] [Từ ngày] → [Đến ngày]
├── 🔌 Theo platform: [Tất cả ▼] [Telegram] [Zalo]
├── 👤 Theo nhân viên: [Tất cả ▼] hoặc chọn cụ thể
├── 🏷️ Theo danh mục: [Tất cả ▼]
├── 📌 Trạng thái: [Tất cả / Đã duyệt / Chưa duyệt]
└── 📤 Xuất: [Excel] [PDF]
```

### Nội dung báo cáo

```
📊 BÁO CÁO THÁNG 04/2026

Tổng số ghi chép: 156
├── ✅ Đã duyệt: 140 (89.7%)
├── 🚩 Cần xem lại: 10 (6.4%)
└── ⏳ Chưa xử lý: 6 (3.9%)

Theo platform:
┌────────────┬───────┬──────────┬───────┐
│ Platform   │ Tổng  │ Đã duyệt │ Flag  │
├────────────┼───────┼──────────┼───────┤
│ Telegram   │  98   │    88    │   6   │
│ Zalo       │  58   │    52    │   4   │
└────────────┴───────┴──────────┴───────┘

Theo nhân viên:
┌─────────────┬────────┬──────────┬────────┐
│ Nhân viên   │ Tổng   │ Đã duyệt │ Flag   │
├─────────────┼────────┼──────────┼────────┤
│ Nguyễn A    │   45   │    42    │   3    │
│ Trần B      │   38   │    36    │   2    │
│ Lê C        │   73   │    62    │   11   │
└─────────────┴────────┴──────────┴────────┘
```

---

## 📌 F4 — Tìm kiếm (Search)

> **Module:** M6 Search

### Các tiêu chí tìm kiếm

| Tiêu chí | Ví dụ |
|---------|-------|
| 📝 **Nội dung ghi chú** | "hóa đơn", "thanh toán" |
| 📝 **Text OCR từ ảnh** | Tìm theo nội dung trong ảnh |
| 👤 **Tên nhân viên** | "Nguyễn Văn A" |
| 📅 **Khoảng thời gian** | 01/04 → 15/04 |
| 🔌 **Platform** | Telegram / Zalo / Discord |
| 🏷️ **Danh mục** | "Chi phí", "Doanh thu" |
| 📌 **Trạng thái** | Mới / Đã duyệt / Flagged |

### Giao diện tìm kiếm

```
🔍 [Nhập từ khóa tìm kiếm...           ] [Tìm]

🔧 Bộ lọc nâng cao:
├── 🔌 Platform: [☑ Telegram] [☑ Zalo] [☑ Discord]
├── 📅 Từ ngày: [__/__/____]  Đến ngày: [__/__/____]
├── 👤 Nhân viên: [Tất cả ▼]
├── 🏷️ Danh mục: [Tất cả ▼]
└── 📌 Trạng thái: [☑ Mới] [☑ Đã duyệt] [☑ Flagged]

📋 Kết quả: 12 records tìm thấy
┌────────────────────────────────────────────────────┐
│ 🤖 [Ảnh] | Nguyễn A | Telegram | 15/04 | "..."    │
│ 📱 [Ảnh] | Trần B   | Zalo     | 14/04 | "..."    │
└────────────────────────────────────────────────────┘
```

---

## 📌 F5 — Rà soát nhanh (Quick Review)

> **Module:** M4 Dashboard + M6 Search

### Mô tả
Chế độ xem nhanh giúp Quản lý duyệt hàng loạt records một cách hiệu quả với keyboard shortcuts.

```
⚡ CHẾ ĐỘ RÀ SOÁT NHANH

[← Trước]  Record 5/24  [Tiếp →]

┌──────────────────────────────────────────────────┐
│              🖼️ [Ảnh đầy đủ]                    │
│                                                    │
│ 🤖 Telegram  |  👤 Nguyễn Văn A  |  📅 15/04    │
│ 📝 Ghi chú: "Hóa đơn mua vật tư X"              │
│ 🤖 OCR: "Số HĐ: 001234 | 2.500.000đ"            │
│ 🏷️ Danh mục: [Chi phí ▼]                        │
│                                                    │
│  [✅ Duyệt]  [🚩 Flag]  [⏩ Bỏ qua]  [✏️ Sửa]  │
│  (A/Enter)    (F)         (Space)       (E)        │
└──────────────────────────────────────────────────┘
```

---

## 📌 F6 — Thông báo realtime

> **Module:** M7 Notification

### Thông báo đến Manager (Dashboard)

| Sự kiện | Thông báo |
|---------|-----------|
| 📨 Record mới đến | Bell badge +1, toast "Nguyễn A vừa gửi ảnh qua Telegram" |
| 📊 Báo cáo sẵn sàng | Bell badge + auto download |

### Phản hồi về platform gốc khi Flag

Khi Manager flag 1 record, hệ thống **tự động nhắn lại nhân viên qua đúng platform họ đã gửi**:

| Platform gốc | Cách phản hồi |
|-------------|---------------|
| **Telegram** | Bot gửi tin nhắn reply trực tiếp cho nhân viên |
| **Zalo OA** | OA gửi tin nhắn qua Zalo API |
| **Discord** | Bot mention @user trong channel (V1.1) |

```
Ví dụ phản hồi Telegram:
┌─────────────────────────────────────────────┐
│ 🤖 Bot: "Ghi chép ngày 15/04 của bạn cần   │
│ kiểm tra lại. Lý do: Ảnh bị mờ, vui lòng   │
│ chụp lại rõ hơn."                           │
└─────────────────────────────────────────────┘
```
