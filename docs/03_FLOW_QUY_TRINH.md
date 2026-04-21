# 🔄 FLOW QUY TRÌNH — T&D COMPANY
> Phiên bản: 1.0 | Cập nhật: 2026-04-20

---

## 🗺️ TỔNG QUAN CÁC LUỒNG

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CÁC LUỒNG CHÍNH                                │
│                                                                      │
│  FL-01  📨 Nhận & Xử lý tin nhắn Zalo              (Core Flow)     │
│  FL-02  👔 Quản lý rà soát & duyệt records          (Review Flow)  │
│  FL-03  📊 Tạo & xuất báo cáo                       (Report Flow)  │
│  FL-04  🔍 Tìm kiếm & lọc dữ liệu                  (Search Flow)  │
│  FL-05  ⚡ Rà soát nhanh hàng loạt                  (Quick Flow)   │
│  FL-06  🔔 Thông báo realtime                        (Notify Flow)  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## FL-01 📨 Nhận & Xử lý tin nhắn Zalo

> **Trigger:** Nhân viên gửi tin nhắn vào Zalo Group

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  👤 NHÂN VIÊN                                                        │
│       │                                                              │
│       ├─ 1. Chụp màn hình hoặc chọn ảnh                            │
│       ├─ 2. Gõ ghi chú kèm theo (tùy chọn)                         │
│       └─ 3. GỬI vào Zalo Group ──────────────────────────────────► │
│                                                                      │
│  📱 ZALO GROUP                                                       │
│       │                                                              │
│       └─ 4. Zalo OA Bot nhận message ─────────────────────────────► │
│                                                                      │
│  🖥️ BACKEND SERVER                                                   │
│       │                                                              │
│       ├─ 5. Xác định loại tin nhắn                                  │
│       │       ├─ [Có ảnh + text] → bước 6                          │
│       │       ├─ [Chỉ có ảnh]   → bước 6, note trống              │
│       │       ├─ [Chỉ có text]  → bước 8, skip OCR                │
│       │       └─ [Sticker/Voice/Video] → ❌ Bỏ qua                 │
│       │                                                              │
│       ├─ 6. Tải ảnh về từ Zalo API                                  │
│       │       └─ Upload lên File Storage (S3/Cloudinary)            │
│       │                                                              │
│       ├─ 7. Chạy OCR Engine                                         │
│       │       ├─ [OCR thành công] → lưu ocr_text                   │
│       │       └─ [OCR thất bại]  → lưu ocr_text = null             │
│       │                                                              │
│       ├─ 8. Tạo Record trong Database                               │
│       │       status = "new"                                         │
│       │       received_at = now()                                    │
│       │                                                              │
│       └─ 9. Gửi thông báo realtime đến Dashboard ─────────────────►│
│                                                                      │
│  🖥️ DASHBOARD (Quản lý)                                              │
│       │                                                              │
│       └─ 10. 🔔 Badge đếm "+1 record mới" xuất hiện                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Trạng thái Record theo thời gian

```
  GỬI TỪ ZALO          BACKEND XỬ LÝ         QUẢN LÝ HÀNH ĐỘNG
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
│       │           ├─ 📅  Thời gian nhận                            │
│       │           ├─ 📝  Preview 50 ký tự đầu ghi chú             │
│       │           └─ 🏷️  Trạng thái (Mới/Duyệt/Flag)             │
│       │                                                              │
│       ├─ 3. Click vào record → Xem chi tiết                        │
│       │       ├─ 🖼️  Ảnh full size                                 │
│       │       ├─ 📝  Ghi chú đầy đủ                               │
│       │       ├─ 🤖  Text OCR nhận dạng được                      │
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
│               │   → Bot Zalo gửi thông báo lại cho nhân viên        │
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
│       │       ├─ 👤 Lọc theo nhân viên (tùy chọn)                  │
│       │       ├─ 🏷️ Lọc theo danh mục (tùy chọn)                  │
│       │       └─ 📌 Lọc theo trạng thái (tùy chọn)                │
│       │                                                              │
│       └─ 3. Nhấn "TẠO BÁO CÁO"                                     │
│                                                                      │
│  🖥️ BACKEND SERVER                                                   │
│       │                                                              │
│       ├─ 4. Query Database theo điều kiện đã chọn                   │
│       │                                                              │
│       ├─ 5. Tổng hợp dữ liệu:                                       │
│       │       ├─ Đếm tổng records theo kỳ                           │
│       │       ├─ Phân nhóm theo nhân viên                          │
│       │       ├─ Phân nhóm theo danh mục                           │
│       │       └─ Thống kê trạng thái (duyệt/flag/chờ)              │
│       │                                                              │
│       ├─ 6. Tạo file xuất                                            │
│       │       ├─ [Excel] → ExcelJS → .xlsx với format chuẩn        │
│       │       └─ [PDF]   → PDFKit → .pdf có logo, bảng, biểu đồ   │
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
│       │       VÀ/HOẶC thiết lập bộ lọc nâng cao                    │
│       │                                                              │
│       └─ 2. Nhấn Tìm kiếm (hoặc Enter)                             │
│                                                                      │
│  🖥️ BACKEND SERVER                                                   │
│       │                                                              │
│       ├─ 3. Nhận query params                                        │
│       │                                                              │
│       ├─ 4. Thực hiện tìm kiếm song song:                          │
│       │       ├─ Full-text search trong trường "note"               │
│       │       ├─ Full-text search trong trường "ocr_text"           │
│       │       ├─ Filter theo date range                             │
│       │       ├─ Filter theo sender_name                            │
│       │       └─ Filter theo category / status                      │
│       │                                                              │
│       └─ 5. Trả về danh sách kết quả có phân trang (20/trang)      │
│                                                                      │
│  👔 QUẢN LÝ                                                          │
│       │                                                              │
│       ├─ 6. Xem kết quả dạng grid/list với highlight từ khóa       │
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
  ┌─────────────────────────────────────┐
  │  Hiển thị record #1                 │
  │  [← Trước] Record 1/15 [Tiếp →]    │
  └─────────────────────────────────────┘
         │
         ▼
  Quản lý xem → chọn action:

  [✅ Duyệt] ──► status = approved ──► Tự động chuyển record tiếp theo
  [🚩 Flag]  ──► Nhập lý do ──► status = flagged ──► Chuyển tiếp theo
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
  SỰ KIỆN                     THÔNG BÁO ĐẾN                 KÊNH
  ─────────────────────────────────────────────────────────────────
  📨 Record mới nhận từ Zalo  →  👔 Quản lý (Dashboard)   →  🔔 Bell badge
                                                            →  📧 Email (nếu cấu hình)

  🚩 Record bị Flag           →  👤 Nhân viên              →  🤖 Zalo Bot nhắn lại
                              →  👔 Quản lý (Dashboard)   →  🔔 Bell badge

  📊 Báo cáo đã tạo xong      →  👔 Quản lý (Dashboard)   →  🔔 Bell badge
                                                            →  📥 Auto download

  ⚠️ OCR thất bại             →  🖥️ Admin log               →  📋 Error log
```

---

## 🗃️ TRẠNG THÁI RECORD — State Diagram

```
                    ┌─────────────┐
                    │             │
         ┌──────────►   🆕 NEW    │
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

## 📐 API ENDPOINTS SƠ BỘ

```
POST   /webhook/zalo              ← Nhận tin nhắn từ Zalo
GET    /api/records               ← Danh sách records (có filter/pagination)
GET    /api/records/:id           ← Chi tiết 1 record
PATCH  /api/records/:id/status    ← Cập nhật trạng thái (approve/flag)
PATCH  /api/records/:id           ← Chỉnh sửa note/category
DELETE /api/records/:id           ← Soft delete

GET    /api/reports               ← Danh sách báo cáo đã tạo
POST   /api/reports/generate      ← Tạo báo cáo mới
GET    /api/reports/:id/download  ← Tải file báo cáo

GET    /api/search?q=...          ← Tìm kiếm full-text

GET    /api/dashboard/summary     ← Tổng quan số liệu Dashboard
```
