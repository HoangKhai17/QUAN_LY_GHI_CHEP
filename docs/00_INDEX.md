# 📚 TÀI LIỆU DỰ ÁN — T&D COMPANY
> Hệ thống Tự động hóa Ghi chép từ Zalo | Phiên bản: 1.0 | 2026-04-20

---

## 📂 Danh sách tài liệu

| # | File | Nội dung |
|---|------|---------|
| 01 | [📋 Tổng quan hệ thống](./01_TONG_QUAN.md) | Mục tiêu, actors, kiến trúc, tech stack |
| 02 | [⚙️ Đặc tả chức năng](./02_CHUC_NANG.md) | Chi tiết 6 chức năng chính |
| 03 | [🔄 Flow quy trình](./03_FLOW_QUY_TRINH.md) | 6 luồng xử lý, state diagram, API endpoints |
| 04 | [💾 Database Schema](./04_DATABASE_SCHEMA.md) | Cấu trúc bảng, index, dữ liệu mẫu |
| 05 | [🔐 Bảo mật](./05_SECURITY.md) | 5 lớp bảo mật, RBAC, encryption, PDPD compliance |
| 06 | [🔍 Debugging & Observability](./06_DEBUGGING_OBSERVABILITY.md) | Logging, Sentry, Grafana, testing strategy |
| 07 | [📊 Phân tích cạnh tranh](./07_COMPETITIVE_ANALYSIS.md) | So sánh thị trường, điểm cần cải thiện, roadmap |

---

## 🎯 Tóm tắt nhanh

**Vấn đề:** Nhân viên gửi ảnh + text vào Zalo Group → Quản lý đọc thủ công → Nhập Excel

**Giải pháp:** Zalo OA Bot tự động nhận → xử lý OCR → lưu DB → Quản lý xem trên Web Dashboard

### Luồng chính
```
📱 Zalo (Nhân viên)
    └─► 🤖 Zalo OA Webhook
            └─► ⚙️  Backend: OCR + Lưu DB
                    └─► 🖥️  Web Dashboard (Quản lý)
                            ├─► ✅ Duyệt / 🚩 Flag
                            ├─► 📊 Xuất báo cáo Excel/PDF
                            └─► 🔍 Tìm kiếm
```

### 6 Chức năng chính
- **F1** 📨 Ghi chép tự động từ Zalo
- **F2** 👔 Dashboard rà soát & duyệt
- **F3** 📊 Tạo báo cáo ngày/tuần/tháng/quý
- **F4** 🔍 Tìm kiếm & lọc
- **F5** ⚡ Rà soát nhanh hàng loạt
- **F6** 🔔 Thông báo realtime

---

## 🗓️ Roadmap gợi ý

```
Sprint 1 (2 tuần)    Sprint 2 (2 tuần)    Sprint 3 (2 tuần)
─────────────────    ─────────────────    ─────────────────
✅ Setup project      ✅ Dashboard UI       ✅ Báo cáo Excel/PDF
✅ Zalo Webhook       ✅ Rà soát/Duyệt      ✅ Tìm kiếm nâng cao
✅ OCR Engine         ✅ Realtime notify     ✅ Quick Review mode
✅ Database & API     ✅ Auth & phân quyền   ✅ UAT & Go-live
```
