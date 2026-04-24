-- Seed 50 fake records for development/testing
-- Run: psql -h localhost -p 5433 -U admin -d quan_ly_ghi_chep -f seed_records.sql

INSERT INTO records (
  platform, sender_id, sender_name,
  image_url, image_thumbnail, ocr_text,
  note, category_id, document_type_id,
  status, flag_reason,
  ocr_status, ocr_confidence,
  extraction_status,
  received_at, created_at, updated_at
) VALUES

-- ─── 1 ───────────────────────────────────────────────────────────────────────
('telegram',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r01/800/600', 'https://picsum.photos/seed/r01/200/200',
 'Ngân hàng Vietcombank - Số TK: 1234567890 - Số tiền: 5.000.000 VND - Nội dung: Thanh toán hóa đơn tháng 4',
 'CK thanh toán nhà cung cấp tháng 4',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', '5b9607a4-1eae-49e9-a027-65ff2ab79bad',
 'approved', NULL, 'success', 94.5, 'done',
 NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

-- ─── 2 ───────────────────────────────────────────────────────────────────────
('zalo',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r02/800/600', 'https://picsum.photos/seed/r02/200/200',
 'PHIẾU CHI - Ngày: 23/04/2026 - Người nhận: Nguyễn Văn An - Số tiền: 2.500.000 VND - Lý do: Mua văn phòng phẩm',
 'Phiếu chi mua văn phòng phẩm quý II',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', 'c0ca763e-bed9-4c3c-a5e2-1da503a0e55c',
 'approved', NULL, 'success', 91.2, 'done',
 NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

-- ─── 3 ───────────────────────────────────────────────────────────────────────
('telegram',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r03/800/600', 'https://picsum.photos/seed/r03/200/200',
 'BÁO CÁO CÔNG VIỆC TUẦN 17 - Hoàn thành: 8 task - Đang thực hiện: 3 task - Tồn: 1 task - Ghi chú: Đúng tiến độ',
 'BC công việc tuần 17/2026',
 '8fbd44a5-e220-47eb-a2d8-9b7c9e02358c', 'afe6fec9-3aba-4921-aad8-4c8659745426',
 'approved', NULL, 'success', 88.7, 'done',
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

-- ─── 4 ───────────────────────────────────────────────────────────────────────
('zalo',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r04/800/600', 'https://picsum.photos/seed/r04/200/200',
 'HÓA ĐƠN ĂN UỐNG - Nhà hàng Phố Xưa - Ngày: 22/04/2026 - Số bàn: 5 - Tổng cộng: 1.850.000 VND - VAT: 185.000 VND',
 'Hóa đơn tiếp khách đối tác',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', '507069be-ae12-4bcd-9297-77f469595703',
 'reviewed', NULL, 'success', 85.3, 'done',
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

-- ─── 5 ───────────────────────────────────────────────────────────────────────
('telegram',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r05/800/600', 'https://picsum.photos/seed/r05/200/200',
 'PHIẾU THU - Khách hàng: Công ty ABC - Số tiền: 15.000.000 VND - Ngày: 21/04/2026 - Hình thức: Chuyển khoản',
 'Thu tiền công ty ABC đợt 1',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', 'a6ec4d5a-d854-43fb-a91e-1697e74ca553',
 'approved', NULL, 'success', 96.1, 'done',
 NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),

-- ─── 6 ───────────────────────────────────────────────────────────────────────
('zalo',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r06/800/600', 'https://picsum.photos/seed/r06/200/200',
 'PHIẾU CÂN XE - Xe số: 51A-123.45 - Hàng: Thép cuộn - Vào: 12.540 kg - Ra: 4.200 kg - Thực nhận: 8.340 kg',
 'Phiếu cân thép cuộn nhập kho',
 '883b5525-66ac-41e9-ad63-8aeb8e24a111', '5baebdaf-fd40-4786-839b-c3457ce4c546',
 'approved', NULL, 'success', 92.8, 'done',
 NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),

-- ─── 7 ───────────────────────────────────────────────────────────────────────
('telegram',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r07/800/600', 'https://picsum.photos/seed/r07/200/200',
 'PHIẾU KIỂM TRA - Lô hàng: SKU-2024-089 - SL kiểm: 500 cái - Đạt: 492 cái - Lỗi: 8 cái - Tỷ lệ lỗi: 1.6%',
 'Kiểm tra chất lượng lô SKU-2024-089',
 '883b5525-66ac-41e9-ad63-8aeb8e24a111', '54cc49ae-3664-458f-b2d7-30cd5b20ba13',
 'reviewed', NULL, 'success', 89.4, 'done',
 NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),

-- ─── 8 ───────────────────────────────────────────────────────────────────────
('zalo',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r08/800/600', 'https://picsum.photos/seed/r08/200/200',
 'Chuyển khoản BIDV - 9.200.000 VND - Từ: CTY TNHH MINH KHOA - Nội dung: TT hợp đồng số 2024-HK-088',
 'TT hợp đồng 2024-HK-088',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', '5b9607a4-1eae-49e9-a027-65ff2ab79bad',
 'flagged', 'Số tiền không khớp với hợp đồng gốc, cần xác minh lại',
 'success', 87.6, 'done',
 NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),

-- ─── 9 ───────────────────────────────────────────────────────────────────────
('telegram',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r09/800/600', 'https://picsum.photos/seed/r09/200/200',
 'BÁO CÁO TUẦN 16 - Doanh thu: 85.000.000 - Chi phí: 42.000.000 - Lợi nhuận gộp: 43.000.000 - Tăng 12% so tuần trước',
 'BC tài chính tuần 16',
 '8fbd44a5-e220-47eb-a2d8-9b7c9e02358c', 'afe6fec9-3aba-4921-aad8-4c8659745426',
 'new', NULL, 'success', 90.2, 'done',
 NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),

-- ─── 10 ──────────────────────────────────────────────────────────────────────
('zalo',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r10/800/600', 'https://picsum.photos/seed/r10/200/200',
 'HÓA ĐƠN - Siêu thị Metro - Mặt hàng: Văn phòng phẩm - Tổng: 3.280.000 VND - Ngày: 17/04/2026',
 'Mua đồ dùng văn phòng tháng 4',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', '507069be-ae12-4bcd-9297-77f469595703',
 'new', NULL, 'success', 82.5, 'done',
 NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),

-- ─── 11 ──────────────────────────────────────────────────────────────────────
('telegram',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r11/800/600', 'https://picsum.photos/seed/r11/200/200',
 'PHIẾU CHI - Chi phí vận chuyển lô hàng tháng 4 - Đơn vị: Giao hàng nhanh - Số tiền: 780.000 VND',
 'Chi phí vận chuyển tháng 4',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', 'c0ca763e-bed9-4c3c-a5e2-1da503a0e55c',
 'new', NULL, 'success', 93.1, 'done',
 NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),

-- ─── 12 ──────────────────────────────────────────────────────────────────────
('zalo',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r12/800/600', 'https://picsum.photos/seed/r12/200/200',
 'KIỂM KÊ KHO - Khu vực A1 - Ngày: 15/04/2026 - Tổng SKU: 124 - Đủ hàng: 118 - Thiếu: 6 SKU - Ghi chú: Cần bổ sung',
 'Kiểm kê kho khu A1 tháng 4',
 '883b5525-66ac-41e9-ad63-8aeb8e24a111', '54cc49ae-3664-458f-b2d7-30cd5b20ba13',
 'reviewed', NULL, 'success', 88.9, 'done',
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),

-- ─── 13 ──────────────────────────────────────────────────────────────────────
('telegram',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r13/800/600', 'https://picsum.photos/seed/r13/200/200',
 'Techcombank - Chuyển tiền thành công - 22.000.000 VND - Người nhận: CONG TY XAY DUNG PHAT DAT - 14/04/2026',
 'CK thanh toán tiền xây dựng đợt 3',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', '5b9607a4-1eae-49e9-a027-65ff2ab79bad',
 'approved', NULL, 'success', 95.7, 'done',
 NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'),

-- ─── 14 ──────────────────────────────────────────────────────────────────────
('zalo',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r14/800/600', 'https://picsum.photos/seed/r14/200/200',
 'PHIẾU THU - Khách: Trần Minh Tuấn - SĐT: 0901234567 - Số tiền: 8.000.000 VND - Hợp đồng: HĐ-2026-045',
 'Thu tiền khách Trần Minh Tuấn',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', 'a6ec4d5a-d854-43fb-a91e-1697e74ca553',
 'approved', NULL, 'success', 91.8, 'done',
 NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),

-- ─── 15 ──────────────────────────────────────────────────────────────────────
('telegram',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r15/800/600', 'https://picsum.photos/seed/r15/200/200',
 'HÓA ĐƠN ĂN UỐNG - Quán Cơm Bà Huyện - Ngày 13/04 - 4 người - Món: cơm sườn, canh chua, rau - 420.000 VND',
 'Cơm trưa team tháng 4',
 'bff53434-26b5-446e-82a7-6634692184df', '507069be-ae12-4bcd-9297-77f469595703',
 'new', NULL, 'success', 78.4, 'done',
 NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),

-- ─── 16 ──────────────────────────────────────────────────────────────────────
('zalo',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r16/800/600', 'https://picsum.photos/seed/r16/200/200',
 'PHIẾU CÂN XE - BKS: 72C-456.78 - Loại hàng: Xi măng Hà Tiên - Trọng lượng bì: 16.200 kg - Tịnh: 24.800 kg',
 'Nhập xi măng lô 2 tháng 4',
 '883b5525-66ac-41e9-ad63-8aeb8e24a111', '5baebdaf-fd40-4786-839b-c3457ce4c546',
 'reviewed', NULL, 'success', 90.6, 'done',
 NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days'),

-- ─── 17 ──────────────────────────────────────────────────────────────────────
('telegram',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r17/800/600', 'https://picsum.photos/seed/r17/200/200',
 'BÁO CÁO TUẦN 15 - KPI đạt 87% - Doanh số mới: 3 khách hàng - Tổng giá trị: 45.000.000 VND',
 'BC KPI tuần 15',
 '8fbd44a5-e220-47eb-a2d8-9b7c9e02358c', 'afe6fec9-3aba-4921-aad8-4c8659745426',
 'approved', NULL, 'success', 86.3, 'done',
 NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),

-- ─── 18 ──────────────────────────────────────────────────────────────────────
('zalo',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r18/800/600', 'https://picsum.photos/seed/r18/200/200',
 'CK Vietinbank - 3.600.000 VND - Nội dung: Trả tiền điện nước tháng 3/2026 - Ngày: 10/04/2026',
 'Thanh toán điện nước tháng 3',
 'bff53434-26b5-446e-82a7-6634692184df', '5b9607a4-1eae-49e9-a027-65ff2ab79bad',
 'approved', NULL, 'success', 93.4, 'done',
 NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),

-- ─── 19 ──────────────────────────────────────────────────────────────────────
('telegram',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r19/800/600', 'https://picsum.photos/seed/r19/200/200',
 'PHIẾU CHI - Sửa chữa máy in - Đơn vị: Dịch vụ điện máy Phúc An - Số tiền: 650.000 VND - Ngày: 09/04',
 'Sửa máy in phòng kế toán',
 'bff53434-26b5-446e-82a7-6634692184df', 'c0ca763e-bed9-4c3c-a5e2-1da503a0e55c',
 'new', NULL, 'success', 84.7, 'done',
 NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days'),

-- ─── 20 ──────────────────────────────────────────────────────────────────────
('zalo',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r20/800/600', 'https://picsum.photos/seed/r20/200/200',
 'PHIẾU THU - Hợp đồng thuê mặt bằng T4/2026 - Khách thuê: Cửa hàng Hoa Mai - Số tiền: 12.000.000 VND',
 'Thu tiền thuê mặt bằng tháng 4',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', 'a6ec4d5a-d854-43fb-a91e-1697e74ca553',
 'new', NULL, 'success', 88.1, 'done',
 NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days'),

-- ─── 21 ──────────────────────────────────────────────────────────────────────
('telegram',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r21/800/600', 'https://picsum.photos/seed/r21/200/200',
 'KIỂM KÊ - Thiết bị VP - Máy tính: 8/10 hoạt động - Máy in: 3/4 tốt - Điều hòa: 5/5 OK - Ngày: 07/04',
 'Kiểm kê thiết bị văn phòng Q2',
 '883b5525-66ac-41e9-ad63-8aeb8e24a111', '54cc49ae-3664-458f-b2d7-30cd5b20ba13',
 'flagged', 'Thiếu thông tin serial number của thiết bị',
 'success', 79.2, 'done',
 NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),

-- ─── 22 ──────────────────────────────────────────────────────────────────────
('zalo',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r22/800/600', 'https://picsum.photos/seed/r22/200/200',
 'MB Bank - Giao dịch thành công - 18.500.000 VND - Đến: CTY CP THUY SAN MINH PHAT - TT đơn hàng 2026-SP-112',
 'Thanh toán đơn hàng thủy sản 2026-SP-112',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', '5b9607a4-1eae-49e9-a027-65ff2ab79bad',
 'approved', NULL, 'success', 97.3, 'done',
 NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days'),

-- ─── 23 ──────────────────────────────────────────────────────────────────────
('telegram',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r23/800/600', 'https://picsum.photos/seed/r23/200/200',
 'HÓA ĐƠN DỊCH VỤ - Cty phần mềm ABC - Phí duy trì hệ thống tháng 4 - Số tiền: 4.500.000 VND + VAT',
 'Phí dịch vụ phần mềm quản lý tháng 4',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', '507069be-ae12-4bcd-9297-77f469595703',
 'reviewed', NULL, 'success', 86.9, 'done',
 NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),

-- ─── 24 ──────────────────────────────────────────────────────────────────────
('zalo',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r24/800/600', 'https://picsum.photos/seed/r24/200/200',
 'PHIẾU CÂN - BKS: 60H-789.01 - Mặt hàng: Gạo ST25 - Vào cân: 18.400 kg - Ra cân: 6.000 kg - Tịnh: 12.400 kg',
 'Nhập gạo ST25 lô tháng 4',
 '883b5525-66ac-41e9-ad63-8aeb8e24a111', '5baebdaf-fd40-4786-839b-c3457ce4c546',
 'new', NULL, 'success', 92.0, 'done',
 NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),

-- ─── 25 ──────────────────────────────────────────────────────────────────────
('telegram',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r25/800/600', 'https://picsum.photos/seed/r25/200/200',
 'BÁO CÁO TUẦN 14 - Đơn hoàn: 5 - Tỷ lệ hủy: 2.3% - Điểm đánh giá KH: 4.7/5 - Tổng doanh thu: 62.000.000 VND',
 'BC doanh thu & KH tuần 14',
 '8fbd44a5-e220-47eb-a2d8-9b7c9e02358c', 'afe6fec9-3aba-4921-aad8-4c8659745426',
 'approved', NULL, 'success', 89.5, 'done',
 NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days'),

-- ─── 26 ──────────────────────────────────────────────────────────────────────
('zalo',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r26/800/600', 'https://picsum.photos/seed/r26/200/200',
 'PHIẾU CHI - Bồi dưỡng nhân viên trực cuối tuần - 5 người x 200.000 = 1.000.000 VND - Ngày: 30/03/2026',
 'Bồi dưỡng ca trực cuối tháng 3',
 'bff53434-26b5-446e-82a7-6634692184df', 'c0ca763e-bed9-4c3c-a5e2-1da503a0e55c',
 'approved', NULL, 'success', 85.8, 'done',
 NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),

-- ─── 27 ──────────────────────────────────────────────────────────────────────
('telegram',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r27/800/600', 'https://picsum.photos/seed/r27/200/200',
 'PHIẾU THU - Thu hồi công nợ - KH: Phạm Thị Lan - Số tiền: 5.000.000/10.000.000 VND - Còn nợ: 5.000.000 VND',
 'Thu hồi công nợ Phạm Thị Lan đợt 1',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', 'a6ec4d5a-d854-43fb-a91e-1697e74ca553',
 'reviewed', NULL, 'success', 90.9, 'done',
 NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days'),

-- ─── 28 ──────────────────────────────────────────────────────────────────────
('zalo',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r28/800/600', 'https://picsum.photos/seed/r28/200/200',
 'ACB - Sao kê giao dịch - Ghi nợ: 7.200.000 VND - Nội dung: Thanh toán bảo hiểm xã hội T3/2026',
 'Nộp BHXH tháng 3/2026',
 'bff53434-26b5-446e-82a7-6634692184df', '5b9607a4-1eae-49e9-a027-65ff2ab79bad',
 'approved', NULL, 'success', 94.2, 'done',
 NOW() - INTERVAL '27 days', NOW() - INTERVAL '27 days', NOW() - INTERVAL '27 days'),

-- ─── 29 ──────────────────────────────────────────────────────────────────────
('telegram',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r29/800/600', 'https://picsum.photos/seed/r29/200/200',
 'HÓA ĐƠN XE - Đổ xăng - Xe: 51B-234.56 - 45 lít RON95 - Đơn giá: 23.900đ/lít - Tổng: 1.075.500 VND',
 'Chi phí xăng xe tháng 3',
 'bff53434-26b5-446e-82a7-6634692184df', '507069be-ae12-4bcd-9297-77f469595703',
 'new', NULL, 'success', 81.6, 'done',
 NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days'),

-- ─── 30 ──────────────────────────────────────────────────────────────────────
('zalo',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r30/800/600', 'https://picsum.photos/seed/r30/200/200',
 'KIỂM KÊ HÀNG - Kho B - Ngày 25/03/2026 - Tổng mã hàng: 86 - Lệch tăng: 0 - Lệch giảm: 3 - Nguyên nhân: Hao hụt',
 'Kiểm kê kho B tháng 3',
 '883b5525-66ac-41e9-ad63-8aeb8e24a111', '54cc49ae-3664-458f-b2d7-30cd5b20ba13',
 'approved', NULL, 'success', 87.3, 'done',
 NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),

-- ─── 31 ──────────────────────────────────────────────────────────────────────
('telegram',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r31/800/600', 'https://picsum.photos/seed/r31/200/200',
 'PHIẾU CÂN XE - Số xe: 43A-567.89 - Hàng hóa: Phân bón NPK - Bì xe: 14.800 - Tổng: 38.600 - Tịnh: 23.800 kg',
 'Nhập phân bón NPK lô tháng 3',
 '883b5525-66ac-41e9-ad63-8aeb8e24a111', '5baebdaf-fd40-4786-839b-c3457ce4c546',
 'approved', NULL, 'success', 91.5, 'done',
 NOW() - INTERVAL '32 days', NOW() - INTERVAL '32 days', NOW() - INTERVAL '32 days'),

-- ─── 32 ──────────────────────────────────────────────────────────────────────
('zalo',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r32/800/600', 'https://picsum.photos/seed/r32/200/200',
 'BÁO CÁO TUẦN 13 - Target: 70tr - Đạt: 68tr - Tỷ lệ: 97.1% - Ghi chú: Sắp đạt mục tiêu tháng',
 'BC doanh số tuần 13',
 '8fbd44a5-e220-47eb-a2d8-9b7c9e02358c', 'afe6fec9-3aba-4921-aad8-4c8659745426',
 'reviewed', NULL, 'success', 88.0, 'done',
 NOW() - INTERVAL '33 days', NOW() - INTERVAL '33 days', NOW() - INTERVAL '33 days'),

-- ─── 33 ──────────────────────────────────────────────────────────────────────
('telegram',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r33/800/600', 'https://picsum.photos/seed/r33/200/200',
 'Vietcombank - 35.000.000 VND - Đến TK: CTY XNK THANH BINH - Nội dung: TT hàng hóa lô 2026-XNK-07',
 'Thanh toán hàng XNK lô 2026-07',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', '5b9607a4-1eae-49e9-a027-65ff2ab79bad',
 'flagged', 'Cần đối chiếu với hóa đơn VAT từ công ty XNK Thanh Bình',
 'success', 96.4, 'done',
 NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days'),

-- ─── 34 ──────────────────────────────────────────────────────────────────────
('zalo',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r34/800/600', 'https://picsum.photos/seed/r34/200/200',
 'PHIẾU CHI - Mua công cụ dụng cụ - Cờ lê, tuýp, búa - Cửa hàng: Phúc Lợi - Tổng: 1.230.000 VND',
 'Mua dụng cụ sửa chữa thiết bị',
 'bff53434-26b5-446e-82a7-6634692184df', 'c0ca763e-bed9-4c3c-a5e2-1da503a0e55c',
 'new', NULL, 'success', 83.2, 'done',
 NOW() - INTERVAL '36 days', NOW() - INTERVAL '36 days', NOW() - INTERVAL '36 days'),

-- ─── 35 ──────────────────────────────────────────────────────────────────────
('telegram',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r35/800/600', 'https://picsum.photos/seed/r35/200/200',
 'PHIẾU THU - Hợp đồng: HĐ-2026-038 - KH: Lê Văn Đức - Số tiền: 6.500.000 VND - Hình thức: Tiền mặt',
 'Thu tiền hợp đồng HĐ-2026-038',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', 'a6ec4d5a-d854-43fb-a91e-1697e74ca553',
 'new', NULL, 'success', 87.7, 'done',
 NOW() - INTERVAL '37 days', NOW() - INTERVAL '37 days', NOW() - INTERVAL '37 days'),

-- ─── 36 ──────────────────────────────────────────────────────────────────────
('zalo',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r36/800/600', 'https://picsum.photos/seed/r36/200/200',
 'HÓA ĐƠN - Khách sạn Mường Thanh - Phòng Deluxe 2 đêm - Ngày: 20-22/03/2026 - Tổng: 3.200.000 VND',
 'Chi phí công tác Đà Nẵng tháng 3',
 'bff53434-26b5-446e-82a7-6634692184df', '507069be-ae12-4bcd-9297-77f469595703',
 'approved', NULL, 'success', 84.5, 'done',
 NOW() - INTERVAL '38 days', NOW() - INTERVAL '38 days', NOW() - INTERVAL '38 days'),

-- ─── 37 ──────────────────────────────────────────────────────────────────────
('telegram',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r37/800/600', 'https://picsum.photos/seed/r37/200/200',
 'PHIẾU KIỂM TRA - SP: Nước mắm nhãn BBO - Batch: NM-2026-03 - Độ đạm: 40N - Vi sinh: Đạt - Kết quả: ĐẠT',
 'Kiểm tra chất lượng nước mắm batch 03',
 '883b5525-66ac-41e9-ad63-8aeb8e24a111', '54cc49ae-3664-458f-b2d7-30cd5b20ba13',
 'reviewed', NULL, 'success', 92.3, 'done',
 NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),

-- ─── 38 ──────────────────────────────────────────────────────────────────────
('zalo',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r38/800/600', 'https://picsum.photos/seed/r38/200/200',
 'SACOMBANK - Lịch sử giao dịch - Ngày 15/03 - 11.800.000 VND - Từ: NGUYEN VAN HUNG - CK tiền ký quỹ',
 'Nhận tiền ký quỹ Nguyễn Văn Hùng',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', '5b9607a4-1eae-49e9-a027-65ff2ab79bad',
 'new', NULL, 'success', 89.8, 'done',
 NOW() - INTERVAL '41 days', NOW() - INTERVAL '41 days', NOW() - INTERVAL '41 days'),

-- ─── 39 ──────────────────────────────────────────────────────────────────────
('telegram',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r39/800/600', 'https://picsum.photos/seed/r39/200/200',
 'PHIẾU CHI - Mua nguyên liệu sản xuất tháng 3 - Bột mì, đường, muối - Chợ Đầu Mối Bình Điền - 8.450.000 VND',
 'Mua nguyên liệu sản xuất T3',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', 'c0ca763e-bed9-4c3c-a5e2-1da503a0e55c',
 'approved', NULL, 'success', 91.1, 'done',
 NOW() - INTERVAL '42 days', NOW() - INTERVAL '42 days', NOW() - INTERVAL '42 days'),

-- ─── 40 ──────────────────────────────────────────────────────────────────────
('zalo',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r40/800/600', 'https://picsum.photos/seed/r40/200/200',
 'BÁO CÁO THÁNG 3/2026 - Tổng doanh thu: 285.000.000 VND - Tăng 18% so T2 - Chi phí: 195.000.000 - LN: 90tr',
 'BC tài chính tổng kết tháng 3',
 '8fbd44a5-e220-47eb-a2d8-9b7c9e02358c', 'afe6fec9-3aba-4921-aad8-4c8659745426',
 'approved', NULL, 'success', 95.0, 'done',
 NOW() - INTERVAL '43 days', NOW() - INTERVAL '43 days', NOW() - INTERVAL '43 days'),

-- ─── 41 ──────────────────────────────────────────────────────────────────────
('telegram',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r41/800/600', 'https://picsum.photos/seed/r41/200/200',
 'PHIẾU CÂN - Xe: 50A-678.90 - Hàng: Cà phê Robusta - Bì: 8.200 - Tổng: 26.700 - Tịnh: 18.500 kg',
 'Nhập cà phê Robusta lô T3',
 '883b5525-66ac-41e9-ad63-8aeb8e24a111', '5baebdaf-fd40-4786-839b-c3457ce4c546',
 'approved', NULL, 'success', 93.7, 'done',
 NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),

-- ─── 42 ──────────────────────────────────────────────────────────────────────
('zalo',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r42/800/600', 'https://picsum.photos/seed/r42/200/200',
 'Nội dung ảnh mờ, không đọc được đầy đủ - Chứng từ liên quan đến hóa đơn điện tử - Cần xác nhận thủ công',
 'Chứng từ chưa rõ cần xác nhận',
 '0e5069d1-7f77-418c-94ed-a1e9c1c561a9', '5a071a2e-3cfa-4697-9314-0fe03f8f16a2',
 'reviewed', NULL, 'failed', NULL, 'needs_review',
 NOW() - INTERVAL '46 days', NOW() - INTERVAL '46 days', NOW() - INTERVAL '46 days'),

-- ─── 43 ──────────────────────────────────────────────────────────────────────
('telegram',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r43/800/600', 'https://picsum.photos/seed/r43/200/200',
 'PHIẾU THU - Thu tiền bán hàng lẻ ngày 08/03 - Tổng 42 hóa đơn - Doanh thu: 28.750.000 VND - Tiền mặt',
 'Thu bán lẻ ngày 08/03',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', 'a6ec4d5a-d854-43fb-a91e-1697e74ca553',
 'approved', NULL, 'success', 86.6, 'done',
 NOW() - INTERVAL '47 days', NOW() - INTERVAL '47 days', NOW() - INTERVAL '47 days'),

-- ─── 44 ──────────────────────────────────────────────────────────────────────
('zalo',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r44/800/600', 'https://picsum.photos/seed/r44/200/200',
 'ĐÔNG Á BANK - Trích nợ tự động - Phí thuê máy POS tháng 3 - 220.000 VND - Ngày: 05/03/2026',
 'Phí thuê máy POS tháng 3',
 'bff53434-26b5-446e-82a7-6634692184df', '5b9607a4-1eae-49e9-a027-65ff2ab79bad',
 'new', NULL, 'success', 80.3, 'done',
 NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days'),

-- ─── 45 ──────────────────────────────────────────────────────────────────────
('telegram',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r45/800/600', 'https://picsum.photos/seed/r45/200/200',
 'HÓA ĐƠN - Tiệc tân niên 2026 - Nhà hàng Bến Thành - 25 người - Set menu 350k/người - Tổng: 8.750.000 VND',
 'Tiệc tân niên toàn công ty 2026',
 'bff53434-26b5-446e-82a7-6634692184df', '507069be-ae12-4bcd-9297-77f469595703',
 'approved', NULL, 'success', 90.4, 'done',
 NOW() - INTERVAL '52 days', NOW() - INTERVAL '52 days', NOW() - INTERVAL '52 days'),

-- ─── 46 ──────────────────────────────────────────────────────────────────────
('zalo',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r46/800/600', 'https://picsum.photos/seed/r46/200/200',
 'PHIẾU KIỂM TRA CHẤT LƯỢNG - Sản phẩm: Mắm tôm loại 1 - Lô SX: MT-2026-01 - Kết quả: ĐẠT - Ngày: 01/03',
 'QC mắm tôm lô MT-2026-01',
 '883b5525-66ac-41e9-ad63-8aeb8e24a111', '54cc49ae-3664-458f-b2d7-30cd5b20ba13',
 'new', NULL, 'success', 88.2, 'done',
 NOW() - INTERVAL '54 days', NOW() - INTERVAL '54 days', NOW() - INTERVAL '54 days'),

-- ─── 47 ──────────────────────────────────────────────────────────────────────
('telegram',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r47/800/600', 'https://picsum.photos/seed/r47/200/200',
 'BIDV - Biên lai chuyển tiền - 28/02/2026 - 42.000.000 VND - TK thụ hưởng: 31410002345678 - Tiền lương T2',
 'Thanh toán lương tháng 2/2026',
 'dab377a7-19c5-438b-aacb-c39a757b4eab', '5b9607a4-1eae-49e9-a027-65ff2ab79bad',
 'approved', NULL, 'success', 97.8, 'done',
 NOW() - INTERVAL '55 days', NOW() - INTERVAL '55 days', NOW() - INTERVAL '55 days'),

-- ─── 48 ──────────────────────────────────────────────────────────────────────
('zalo',
 'f95505ad-9c68-4dc1-874d-ac787f9df9f0', '@HoangKhai_BBO',
 'https://picsum.photos/seed/r48/800/600', 'https://picsum.photos/seed/r48/200/200',
 'PHIẾU CHI - Tiếp khách đối tác Hàn Quốc - Ăn tối - Nhà hàng Gangnam - 6 người - Tổng: 4.200.000 VND',
 'Tiếp khách đối tác Hàn Quốc',
 'bff53434-26b5-446e-82a7-6634692184df', 'c0ca763e-bed9-4c3c-a5e2-1da503a0e55c',
 'approved', NULL, 'success', 82.9, 'done',
 NOW() - INTERVAL '57 days', NOW() - INTERVAL '57 days', NOW() - INTERVAL '57 days'),

-- ─── 49 ──────────────────────────────────────────────────────────────────────
('telegram',
 '056d9041-415d-48f4-9ac1-2b7cc3047d88', 'Nguyễn Văn A',
 'https://picsum.photos/seed/r49/800/600', 'https://picsum.photos/seed/r49/200/200',
 'Chứng từ bị ảnh hưởng bởi ánh sáng, OCR nhận diện kém - Cần chụp lại hoặc nhập tay - Có dấu hiệu là phiếu chi',
 'Phiếu chi cần chụp lại',
 '0e5069d1-7f77-418c-94ed-a1e9c1c561a9', '5a071a2e-3cfa-4697-9314-0fe03f8f16a2',
 'flagged', 'Ảnh mờ, không đọc được số liệu quan trọng, đề nghị chụp lại',
 'success', 42.1, 'needs_review',
 NOW() - INTERVAL '58 days', NOW() - INTERVAL '58 days', NOW() - INTERVAL '58 days'),

-- ─── 50 ──────────────────────────────────────────────────────────────────────
('zalo',
 '335b5dd4-cb31-4b0b-8ffa-b0a27de9c68f', '@BaoPhuc_BBO',
 'https://picsum.photos/seed/r50/800/600', 'https://picsum.photos/seed/r50/200/200',
 'BÁO CÁO THÁNG 2/2026 - Doanh thu: 242.000.000 VND - Chi phí: 178.000.000 - Lợi nhuận: 64.000.000 VND',
 'BC tổng kết tháng 2/2026',
 '8fbd44a5-e220-47eb-a2d8-9b7c9e02358c', 'afe6fec9-3aba-4921-aad8-4c8659745426',
 'approved', NULL, 'success', 93.6, 'done',
 NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days');
