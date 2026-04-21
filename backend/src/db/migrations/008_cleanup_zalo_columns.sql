-- Migration 008: Dọn dẹp các cột Zalo-specific còn sót từ schema cũ
-- Đây là bước cuối để hoàn thiện chuyển đổi sang platform-agnostic.
-- Các cột platform mới đã được thêm ở migration 007.

-- ── 1. Xóa cột Zalo-specific khỏi users ──────────────────────────
-- platform_user_id (007) đã chứa dữ liệu migrate từ zalo_id

ALTER TABLE users
  DROP COLUMN IF EXISTS zalo_id;

-- ── 2. Xóa cột Zalo-specific khỏi records ────────────────────────
-- platform_message_id và source_chat_id (007) đã chứa dữ liệu migrate

ALTER TABLE records
  DROP COLUMN IF EXISTS zalo_message_id,
  DROP COLUMN IF EXISTS zalo_group_id;

-- ── 3. Thêm filter_platform vào report_jobs ───────────────────────
-- Cho phép tạo báo cáo lọc theo platform cụ thể

ALTER TABLE report_jobs
  ADD COLUMN IF NOT EXISTS filter_platform VARCHAR(20) DEFAULT NULL;
