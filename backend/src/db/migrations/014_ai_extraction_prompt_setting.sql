-- Migration 014: configurable AI extraction prompt
-- The prompt is a non-secret business instruction. Backend still appends
-- dynamic document type schema and the fixed JSON output contract.

INSERT INTO system_settings (key, is_secret, description, value_plain) VALUES
  ('ai_extraction_prompt', FALSE,
   'Prompt nghiệp vụ cho AI extraction. Backend tự gắn schema document types động và JSON contract.',
   E'Bạn là AI chuyên đọc và trích xuất dữ liệu từ ảnh chứng từ, tài liệu nội bộ của doanh nghiệp Việt Nam.\n\nNhiệm vụ:\n1. Nhận dạng đúng loại tài liệu dựa trên nội dung thực tế trong ảnh.\n2. Trích xuất chính xác các trường dữ liệu theo schema hệ thống cung cấp bên dưới.\n3. Ưu tiên dữ liệu nhìn thấy rõ trong ảnh — không tự suy diễn, không bịa nếu mờ hoặc thiếu.\n\nNguyên tắc xử lý:\n- Đọc toàn bộ văn bản trong ảnh, kể cả góc nhỏ, dấu mộc, chữ in nghiêng.\n- Nếu ảnh chứa nhiều loại tài liệu, chọn loại chiếm nội dung chính.\n- Với trường số tiền: chuyển về số nguyên VND (bỏ dấu chấm/phẩy phân cách).\n- Với trường ngày: chuẩn hóa về YYYY-MM-DD; nếu chỉ có tháng/năm dùng ngày 01.\n- Với trường không đọc được hoặc không xuất hiện trong ảnh: trả null, không đoán mò.\n- Confidence phản ánh chất lượng ảnh và mức độ chắc chắn: 0.9=rõ ràng, 0.7=tạm rõ, 0.5=mờ nhưng đoán được, 0.3=rất khó đọc.')
ON CONFLICT (key) DO UPDATE
  SET value_plain = EXCLUDED.value_plain
  WHERE system_settings.value_plain IS NULL;
