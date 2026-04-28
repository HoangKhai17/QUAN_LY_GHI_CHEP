import { notification } from 'antd'

const notify = {
  success: (msg, desc) =>
    notification.success({ message: msg, description: desc, placement: 'topRight', duration: 3 }),

  error: (msg, desc) =>
    notification.error({ message: msg, description: desc, placement: 'topRight', duration: 5 }),

  warning: (msg, desc) =>
    notification.warning({ message: msg, description: desc, placement: 'topRight', duration: 4 }),

  info: (msg, desc) =>
    notification.info({ message: msg, description: desc, placement: 'topRight', duration: 3 }),

  // ── Cross-cutting error helpers ─────────────────────────────────────────────

  permissionDenied: (detail) =>
    notification.error({
      message: 'Không có quyền truy cập',
      description: detail || 'Bạn không có quyền thực hiện thao tác này.',
      placement: 'topRight',
      duration: 5,
    }),

  rateLimit: (retryAfterSeconds) =>
    notification.warning({
      message: 'Quá nhiều yêu cầu',
      description: retryAfterSeconds
        ? `Hệ thống đang bận tải. Vui lòng thử lại sau ${retryAfterSeconds} giây.`
        : 'Quá nhiều yêu cầu trong thời gian ngắn. Vui lòng đợi một chút rồi thử lại.',
      placement: 'topRight',
      duration: retryAfterSeconds ? Math.min(Number(retryAfterSeconds), 8) : 6,
    }),

  serverError: (detail) =>
    notification.error({
      message: 'Lỗi máy chủ (5xx)',
      description: detail || 'Máy chủ gặp sự cố. Vui lòng thử lại hoặc liên hệ admin.',
      placement: 'topRight',
      duration: 6,
    }),

  networkError: () =>
    notification.error({
      message: 'Lỗi kết nối',
      description: 'Không thể kết nối tới máy chủ. Kiểm tra đường truyền mạng.',
      placement: 'topRight',
      duration: 6,
    }),
}

export default notify
