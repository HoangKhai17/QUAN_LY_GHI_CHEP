# ⚙️ ĐẶC TẢ CHỨC NĂNG — QUAN LY GHI CHEP
> Phiên bản: 1.0 | Cập nhật: 2026-04-20

---

## 📌 F1 — Ghi chép thông tin qua Zalo

> **Module:** M1 Zalo Integration + M2 Data Processing + M3 Storage

### Mô tả
Nhân viên sử dụng **Zalo App** (quen thuộc, không cần cài app mới) để gửi ảnh kèm ghi chú vào Zalo Group được cấu hình sẵn. Hệ thống tự động nhận và lưu trữ.

### Luồng chi tiết

```
👤 Nhân viên thao tác trong Zalo
        │
        ├─ 📸 Chụp màn hình / Chọn ảnh từ gallery
        ├─ ✍️  Gõ ghi chú kèm theo (tên, số liệu, mô tả)
        └─ 📤 Gửi vào Zalo Group
                │
                ▼
        🤖 Zalo OA Bot nhận message (Webhook)
                │
                ├─ Phân tích loại tin nhắn (có ảnh / text / cả hai)
                ├─ Extract metadata (sender, timestamp, group_id)
                ├─ Tải ảnh về → lưu File Storage
                ├─ Chạy OCR → trích xuất text từ ảnh (nếu có)
                └─ Lưu vào Database với trạng thái "Mới"
                        │
                        ▼
        ✅ Dữ liệu xuất hiện trên Dashboard của Quản lý
```

### Dữ liệu được lưu

| Trường | Mô tả |
|--------|-------|
| `record_id` | ID định danh duy nhất |
| `sender_name` | Tên nhân viên gửi (từ Zalo) |
| `sender_zalo_id` | Zalo ID của người gửi |
| `image_url` | Đường dẫn ảnh đã lưu |
| `ocr_text` | Text nhận dạng từ ảnh (OCR) |
| `note` | Ghi chú text người dùng kèm theo |
| `category` | Danh mục (tự động / thủ công gán) |
| `status` | `new` / `reviewed` / `approved` / `flagged` |
| `received_at` | Thời điểm nhận từ Zalo |

### Quy tắc xử lý

- ✅ Tin nhắn **có ảnh + text** → lưu đầy đủ cả hai
- ✅ Tin nhắn **chỉ có ảnh** → OCR để lấy text, note để trống
- ✅ Tin nhắn **chỉ có text** → lưu text, image để trống
- ❌ Tin nhắn **không liên quan** (sticker, voice, video) → bỏ qua hoặc log

---

## 📌 F2 — Dashboard Quản lý (Xem & Rà soát)

> **Module:** M4 Dashboard + M7 Notification

### Mô tả
Giao diện web cho Quản lý xem toàn bộ dữ liệu ghi chép, rà soát và đánh dấu trạng thái.

### Màn hình chính

```
┌─────────────────────────────────────────────────────┐
│  🏠 Dashboard                          🔔 3 mới     │
├───────────┬─────────────────────────────────────────┤
│           │  📊 Tổng hôm nay: 24 records            │
│ 📋 DS ghi │  ┌──────┬──────┬──────┬──────┐         │
│    chép   │  │ Mới  │Đã xem│Duyệt │ Flag │         │
│           │  │  8   │  10  │  5   │  1   │         │
│ 📊 Báo    │  └──────┴──────┴──────┴──────┘         │
│    cáo    │                                          │
│           │  📋 Danh sách records (mới nhất)        │
│ 🔍 Search │  ┌────────────────────────────────────┐ │
│           │  │ 🖼️ [Ảnh] Nguyễn A | 09:30 | Mới   │ │
│ ⚙️ Cài    │  │ 🖼️ [Ảnh] Trần B   | 09:15 | Mới   │ │
│    đặt    │  │ 🖼️ [Ảnh] Lê C     | 08:50 | Duyệt │ │
│           │  └────────────────────────────────────┘ │
└───────────┴─────────────────────────────────────────┘
```

### Tính năng rà soát

| Action | Mô tả |
|--------|-------|
| 👁️ **Xem chi tiết** | Mở ảnh full + đọc ghi chú |
| ✅ **Duyệt (Approve)** | Xác nhận thông tin hợp lệ |
| 🚩 **Đánh dấu (Flag)** | Ghi chú cần kiểm tra lại |
| ✏️ **Chỉnh sửa** | Sửa ghi chú hoặc phân loại |
| 🗑️ **Xóa** | Xóa record không hợp lệ |

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
| 🏷️ **Danh mục** | "Chi phí", "Doanh thu" |
| 📌 **Trạng thái** | Mới / Đã duyệt / Flagged |

### Giao diện tìm kiếm

```
🔍 [Nhập từ khóa tìm kiếm...        ] [Tìm]

🔧 Bộ lọc nâng cao:
├── 📅 Từ ngày: [__/__/____]  Đến ngày: [__/__/____]
├── 👤 Nhân viên: [Tất cả ▼]
├── 🏷️ Danh mục: [Tất cả ▼]
└── 📌 Trạng thái: [☑ Mới] [☑ Đã duyệt] [☑ Flagged]

📋 Kết quả: 12 records tìm thấy
┌────────────────────────────────────────────┐
│ 🖼️ [Ảnh nhỏ] | Nguyễn A | 15/04 | "..."  │
│ 🖼️ [Ảnh nhỏ] | Trần B   | 14/04 | "..."  │
└────────────────────────────────────────────┘
```

---

## 📌 F5 — Rà soát nhanh (Quick Review)

> **Module:** M4 Dashboard + M6 Search

### Mô tả
Chế độ xem nhanh giúp Quản lý duyệt hàng loạt records một cách hiệu quả.

```
⚡ CHẾ ĐỘ RÀ SOÁT NHANH

[← Trước]  Record 5/24  [Tiếp →]

┌────────────────────────────────────────┐
│          🖼️ [Ảnh đầy đủ]              │
│                                        │
│ 👤 Nguyễn Văn A  |  📅 15/04 09:30   │
│ 📝 Ghi chú: "Hóa đơn mua vật tư X"   │
│ 🤖 OCR: "Số HĐ: 001234 | 2.500.000đ" │
│ 🏷️ Danh mục: [Chi phí ▼]             │
│                                        │
│  [✅ Duyệt]  [🚩 Flag]  [✏️ Sửa]     │
└────────────────────────────────────────┘
```

---

## 📌 F6 — Thông báo realtime

> **Module:** M7 Notification

| Sự kiện | Thông báo |
|---------|-----------|
| 📨 Record mới từ Zalo | "Có 3 ghi chép mới từ Nguyễn A" |
| 🚩 Record bị flag | Nhân viên nhận thông báo qua Zalo Bot |
| 📊 Báo cáo sẵn sàng | "Báo cáo tháng 04 đã sẵn sàng tải về" |
