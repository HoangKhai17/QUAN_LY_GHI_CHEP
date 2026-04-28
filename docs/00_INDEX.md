# 📚 TÀI LIỆU DỰ ÁN — QUAN LY GHI CHEP
> Hệ thống Tự động hóa Ghi chép đa nền tảng (Telegram · Zalo · Discord...) | Phiên bản: 3.0 | 2026-04-24

---

## 📂 Danh sách tài liệu

| # | File | Nội dung |
|---|------|---------|
| 01 | [📋 Tổng quan hệ thống](./01_TONG_QUAN.md) | Mục tiêu, actors, kiến trúc, tech stack |
| 02 | [⚙️ Đặc tả chức năng](./02_CHUC_NANG.md) | Chi tiết 6 chức năng chính |
| 03 | [🔄 Flow quy trình](./03_FLOW_QUY_TRINH.md) | 7 luồng xử lý (thêm FL-07 tạo thủ công), state diagram, API endpoints |
| 04 | [💾 Database Schema](./04_DATABASE_SCHEMA.md) | Cấu trúc bảng: users, records, document_types, record_field_values, index |
| 05 | [🔐 Bảo mật](./05_SECURITY.md) | 5 lớp bảo mật, RBAC, encryption, PDPD compliance |
| 06 | [🔍 Debugging & Observability](./06_DEBUGGING_OBSERVABILITY.md) | Logging, Sentry, Grafana, testing strategy |
| 07 | [📊 Phân tích cạnh tranh](./07_COMPETITIVE_ANALYSIS.md) | So sánh thị trường, điểm cần cải thiện, roadmap |
| 08 | [🏗️ Build Plan chi tiết](./08_BUILD_PLAN.md) | 9 phases, step-by-step. Phase 0–5 ✅ Done. Phase 6–8 planned. |
| 09 | [⚡ Performance & Optimization Checklist](./09_PERFORMANCE_CHECKLIST.md) | Checklist DB, query, API, frontend — dùng khi build tính năng mới hoặc chẩn đoán chậm |
| 10 | [🔒 Security Audit & Penetration Test Plan](./10_SECURITY_AUDIT_PENTEST.md) | 17 issues (2 Critical/5 High/6 Medium/4 Low), attack scripts, fix tracking table |

---

## 🎯 Tóm tắt nhanh

**Vấn đề:** Nhân viên gửi ảnh + text qua Zalo/Telegram → Quản lý đọc thủ công → Nhập Excel

**Giải pháp:** Bot đa nền tảng tự động nhận → xử lý OCR → lưu DB → Quản lý xem trên Web Dashboard

### Luồng chính
```
📱 Nhân viên (Telegram / Zalo / Discord...)
    └─► 🔌 Platform Connector (webhook nhận tự động)
            └─► ⚙️  Backend: Chuẩn hóa → OCR → Lưu DB
                    └─► 🖥️  Web Dashboard (Quản lý)
                            ├─► ✅ Duyệt / 🚩 Flag
                            ├─► 📊 Xuất báo cáo Excel/PDF
                            └─► 🔍 Tìm kiếm
```

### Kiến trúc Connector — thêm nền tảng mới không cần sửa core
```
POST /webhook/telegram  ─►
POST /webhook/zalo      ─►  [Connector Layer]  →  MessageProcessor  →  DB  →  Dashboard
POST /webhook/discord   ─►
POST /webhook/...       ─►
```

### 6 Chức năng chính
- **F1** 📨 Ghi chép tự động đa nền tảng (Telegram, Zalo, Discord...)
- **F2** 👔 Dashboard rà soát & duyệt
- **F3** 📊 Tạo báo cáo ngày/tuần/tháng/quý
- **F4** 🔍 Tìm kiếm & lọc (có thể lọc theo platform)
- **F5** ⚡ Rà soát nhanh hàng loạt
- **F6** 🔔 Thông báo realtime (Socket.io) + phản hồi về platform gốc
- **F7** 🖊️ Tạo record thủ công qua Web Form (upload ảnh + OCR async)

---

## 🗓️ Roadmap

```
Sprint 1 (2 tuần)          Sprint 2 (2 tuần)         Sprint 3 (2 tuần)
──────────────────────     ─────────────────────     ─────────────────
✅ Setup project            ✅ Dashboard UI            🔲 Báo cáo Excel/PDF
✅ Connector Layer          ✅ Rà soát/Duyệt           🔲 Tìm kiếm nâng cao
   Telegram Bot (ưu tiên)   ✅ Realtime notify (Sock)  🔲 Quick Review mode
   Zalo OA (sau)            ✅ Auth & phân quyền        🔲 UAT & Go-live
✅ OCR Engine               ✅ Tạo record thủ công
✅ Database & API           ✅ Document Types động
✅ Document Type Schema
```

---

## 🔌 Platform đang hỗ trợ

| Platform | Trạng thái | Điều kiện |
|----------|-----------|-----------|
| 🤖 **Telegram Bot** | ✅ Đã implement | Chỉ cần `TELEGRAM_BOT_TOKEN` từ @BotFather |
| 📱 **Zalo OA** | ⚠️ Đã implement, cần GPKD | Đăng ký OA tại oa.zalo.me |
| 💬 **Discord** | 🔲 Chưa làm (V1.1) | Thêm 1 connector mới |
| 🌐 **Web Form** | ✅ Đã implement | Tạo record thủ công qua web, upload ảnh, OCR async |
