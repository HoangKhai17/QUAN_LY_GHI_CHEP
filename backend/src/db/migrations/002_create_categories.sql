CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  color       VARCHAR(7) DEFAULT '#1890ff',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO categories (name, description, color) VALUES
  ('Chung', 'Ghi chép tổng hợp', '#1890ff'),
  ('Hóa đơn', 'Chứng từ, hóa đơn mua hàng', '#52c41a'),
  ('Báo cáo công việc', 'Báo cáo tiến độ, kết quả', '#faad14'),
  ('Kiểm kê', 'Kiểm kê hàng hóa, vật tư', '#722ed1'),
  ('Khác', 'Các ghi chép khác', '#8c8c8c')
ON CONFLICT DO NOTHING;
