# 📋 TỔNG QUAN HỆ THỐNG — QUAN LY GHI CHEP
> Phiên bản: 1.0 | Cập nhật: 2026-04-20

---

## 🎯 Mục tiêu dự án

Xây dựng hệ thống **tự động hóa quy trình ghi chép thông tin** từ Zalo, thay thế hoàn toàn việc quản lý đọc thủ công và nhập liệu vào Excel.

---

## 🔄 Quy trình HIỆN TẠI (Manual)

```
👤 Nhân viên                    📱 Zalo Group                  📊 Quản lý
     │                               │                               │
     ├── Chụp ảnh / Screenshot ──►  │                               │
     ├── Gửi kèm ghi chú text ────► │                               │
     │                               │  ◄── Quản lý đọc thủ công ──┤
     │                               │  ◄── Nhập tay vào Excel ─────┤
     │                               │                               │
```

**Vấn đề:**
- ⏰ Tốn thời gian nhập liệu thủ công
- ❌ Dễ sót/nhầm thông tin khi copy
- 📉 Không có báo cáo tổng hợp tự động
- 🔍 Khó tra cứu dữ liệu lịch sử

---

## ✅ Quy trình MỚI (Automated)

```
👤 Nhân viên                    📱 Zalo Group                  🖥️ Hệ thống                   📊 Quản lý
     │                               │                               │                               │
     ├── Chụp ảnh / Screenshot ──►  │                               │                               │
     ├── Gửi kèm ghi chú text ────► │  ──── Webhook tự động ──────► │                               │
     │                               │       nhận message            │── Xử lý & lưu DB ────────────►│
     │                               │                               │── Dashboard realtime ─────────►│
     │                               │                               │── Tạo báo cáo ────────────────►│
```

**Lợi ích:**
- ⚡ Dữ liệu cập nhật tức thì — không cần nhập tay
- 🗂️ Lưu trữ có cấu trúc, phân loại tự động
- 📊 Báo cáo ngày/tuần/tháng/quý tự động
- 🔍 Tìm kiếm nhanh theo nhiều tiêu chí

---

## 👥 Actors & Vai trò

| Actor | Mô tả | Công cụ sử dụng |
|-------|-------|-----------------|
| 👤 **Nhân viên (User)** | Gửi ảnh + ghi chú qua Zalo | Zalo App |
| 👔 **Quản lý (Manager)** | Xem, duyệt, xuất báo cáo | Web Dashboard |
| 🤖 **Hệ thống (Bot)** | Nhận, xử lý, lưu trữ tự động | Backend Server |

---

## 🏗️ Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                        HỆ THỐNG T&D                             │
│                                                                  │
│  📱 ZALO LAYER           🖥️ BACKEND LAYER        💾 DATA LAYER  │
│  ┌──────────────┐        ┌──────────────┐        ┌────────────┐ │
│  │ Zalo Group   │──────► │ Webhook API  │──────► │ Database   │ │
│  │ (OA Bot)     │        │ Parser       │        │ PostgreSQL │ │
│  └──────────────┘        │ OCR Engine   │        ├────────────┤ │
│                           │ File Storage │        │ File Store │ │
│  🌐 FRONTEND LAYER        └──────┬───────┘        │ (Images)   │ │
│  ┌──────────────┐                │                └────────────┘ │
│  │ Web Dashboard│◄───────────────┘                               │
│  │ (Manager)    │                                                 │
│  └──────────────┘                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Danh sách Module

| # | Module | Mô tả |
|---|--------|-------|
| M1 | 🔗 **Zalo Integration** | Kết nối, nhận message từ Zalo OA |
| M2 | ⚙️ **Data Processing** | Phân tích, OCR, phân loại dữ liệu |
| M3 | 💾 **Storage** | Lưu trữ ảnh và dữ liệu có cấu trúc |
| M4 | 🖥️ **Dashboard** | Giao diện quản lý cho Manager |
| M5 | 📊 **Report** | Tạo báo cáo tự động, xuất file |
| M6 | 🔍 **Search** | Tìm kiếm và lọc dữ liệu |
| M7 | 🔔 **Notification** | Thông báo realtime |

---

## 🛠️ Tech Stack

| Thành phần | Công nghệ |
|-----------|-----------|
| **Zalo Integration** | Zalo Official Account API + Webhook |
| **Backend** | Node.js + Express / Python FastAPI |
| **OCR** | Google Vision API / Tesseract.js |
| **Database** | PostgreSQL |
| **File Storage** | AWS S3 / Cloudinary |
| **Frontend** | React.js + Ant Design |
| **Export** | ExcelJS + PDFKit |
| **Realtime** | WebSocket / Socket.io |
