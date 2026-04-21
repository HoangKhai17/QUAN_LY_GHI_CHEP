# 📋 TỔNG QUAN HỆ THỐNG — QUAN LY GHI CHEP
> Phiên bản: 2.0 | Cập nhật: 2026-04-21

---

## 🎯 Mục tiêu dự án

Xây dựng hệ thống **tự động hóa quy trình ghi chép thông tin đa nền tảng**, thay thế hoàn toàn việc quản lý đọc thủ công và nhập liệu vào Excel. Hệ thống không bị phụ thuộc vào một ứng dụng nhắn tin cụ thể — nhân viên có thể gửi qua **Telegram, Zalo, Discord...** mà backend xử lý hoàn toàn như nhau.

---

## 🔄 Quy trình HIỆN TẠI (Manual)

```
👤 Nhân viên              💬 App nhắn tin (Zalo/Telegram...)     📊 Quản lý
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
- 🔒 Bị phụ thuộc 100% vào 1 nền tảng nhắn tin duy nhất

---

## ✅ Quy trình MỚI (Automated — Multi-Platform)

```
👤 Nhân viên                🔌 Platform Connector        🖥️ Hệ thống           📊 Quản lý
     │                               │                         │                     │
     ├── Telegram: gửi ảnh ───────► │                         │                     │
     ├── Zalo: gửi ảnh ───────────► │ ── Webhook nhận ──────► │                     │
     ├── Discord: gửi ảnh ────────► │    & chuẩn hóa          │── Xử lý & lưu DB ──►│
     │                               │                         │── Dashboard RT ─────►│
     │                               │                         │── Báo cáo ──────────►│
```

**Lợi ích:**
- ⚡ Dữ liệu cập nhật tức thì — không cần nhập tay
- 🔌 Không phụ thuộc platform — dễ chuyển đổi hoặc dùng song song
- 🗂️ Lưu trữ có cấu trúc, phân loại tự động
- 📊 Báo cáo ngày/tuần/tháng/quý tự động
- 🔍 Tìm kiếm nhanh, lọc theo platform/nhân viên/danh mục

---

## 👥 Actors & Vai trò

| Actor | Mô tả | Công cụ sử dụng |
|-------|-------|-----------------|
| 👤 **Nhân viên (Staff)** | Gửi ảnh + ghi chú | Telegram / Zalo / Discord (dùng app quen thuộc) |
| 👔 **Quản lý (Manager)** | Xem, duyệt, xuất báo cáo | Web Dashboard |
| 🤖 **Hệ thống (Bot)** | Nhận, chuẩn hóa, xử lý, lưu trữ | Backend + Connector Layer |

---

## 🏗️ Tổng quan kiến trúc

```
┌──────────────────────────────────────────────────────────────────────┐
│                      HỆ THỐNG QUAN LY GHI CHEP                       │
│                                                                        │
│  🔌 CONNECTOR LAYER         🖥️ BACKEND LAYER         💾 DATA LAYER   │
│  ┌────────────────────┐     ┌──────────────────┐     ┌─────────────┐ │
│  │ 🤖 Telegram Bot    │──►  │ webhook.router   │──►  │ PostgreSQL  │ │
│  │ 📱 Zalo OA Bot     │──►  │ ─────────────── │     ├─────────────┤ │
│  │ 💬 Discord Bot     │──►  │ message.         │──►  │ File Store  │ │
│  │ (mở rộng thêm...)  │     │ processor        │     │ (Cloudinary │ │
│  └────────────────────┘     │ ─────────────── │     │  / S3)      │ │
│                              │ OCR Engine       │     └─────────────┘ │
│  🌐 FRONTEND LAYER           │ Storage Service  │                      │
│  ┌────────────────────┐     └────────┬─────────┘                      │
│  │ Web Dashboard      │◄────────────┘                                  │
│  │ (React + Ant Design│     Socket.io (Realtime)                       │
│  └────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Danh sách Module

| # | Module | Mô tả |
|---|--------|-------|
| M1 | 🔌 **Platform Connector** | Kết nối đa nền tảng: Telegram, Zalo, Discord... Chuẩn hóa message về format chung |
| M2 | ⚙️ **Data Processing** | OCR ảnh, phân loại, validate dữ liệu đầu vào |
| M3 | 💾 **Storage** | Lưu trữ ảnh (Cloudinary/S3) + Signed URL |
| M4 | 🖥️ **Dashboard** | Giao diện quản lý cho Manager |
| M5 | 📊 **Report** | Tạo báo cáo tự động, xuất Excel/PDF |
| M6 | 🔍 **Search** | Tìm kiếm full-text, lọc theo platform/người gửi/danh mục |
| M7 | 🔔 **Notification** | Realtime WebSocket + phản hồi về platform gốc khi flag |

---

## 🛠️ Tech Stack

| Thành phần | Công nghệ |
|-----------|-----------|
| **Platform Connectors** | Telegram Bot API (`node-telegram-bot-api`) + Zalo OA API + Webhook |
| **Backend** | Node.js + Express + Socket.io |
| **OCR** | Google Vision API / Tesseract.js |
| **Database** | PostgreSQL 15 (platform-agnostic schema) |
| **File Storage** | Cloudinary / AWS S3 (Signed URL) |
| **Frontend** | React.js + Vite + Ant Design |
| **Export** | ExcelJS + PDFKit |
| **Realtime** | Socket.io |
| **Logging** | Winston (structured) + Sentry |

---

## 🔌 Platform đang hỗ trợ

| Platform | Trạng thái | Ghi chú |
|----------|-----------|---------|
| 🤖 **Telegram Bot** | ✅ Sẵn sàng | Dễ nhất — không cần GPKD, nhận 100% message trong group |
| 📱 **Zalo OA** | ✅ Sẵn sàng (cần GPKD) | Cần đăng ký OA tại oa.zalo.me |
| 💬 **Discord Bot** | 🔲 V1.1 | Thêm 1 connector mới, không đụng core |
| 🌐 **Web Form Upload** | 🔲 V1.1 | Nhân viên upload qua web, không cần app |
