/**
 * OpenAPI 3.0 spec — tài liệu API cho QUAN LY GHI CHEP.
 *
 * Cập nhật file này khi thêm endpoint mới.
 * Không dùng swagger-jsdoc để tránh annotations rải rác trong router files.
 */

// ── Shared filter params — dùng lại cho mọi endpoint /api/reports/* ──────────
const _rptFilters = [
  { name: 'date_from',        in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-01' }, description: 'Từ ngày nhận (ISO date)' },
  { name: 'date_to',          in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-30' }, description: 'Đến ngày nhận (ISO date)' },
  { name: 'document_type_id', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Lọc theo UUID loại tài liệu' },
  { name: 'category_id',      in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Lọc theo UUID danh mục' },
  { name: 'platform',         in: 'query', schema: { type: 'string', enum: ['telegram','zalo','manual'] }, description: 'Lọc theo nền tảng gửi' },
]

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Quản Lý Ghi Chép — API',
    version: '3.0.0',
    description: `
**Hệ thống quản lý ghi chép nội bộ doanh nghiệp.**

Nhận ảnh chứng từ từ Telegram → AI trích xuất nội dung → Manager duyệt qua Dashboard.

### Auth flow
1. Bootstrap admin: \`node src/db/seeds/create_admin.js --password <pw>\`
2. \`POST /api/auth/login\` → nhận \`access_token\` + \`refresh_token\`
3. Click **Authorize** ở góc trên bên phải → nhập \`Bearer <access_token>\`
4. Gọi các API cần auth

### Token model
- **access_token**: JWT, hết hạn sau **15 phút**
- **refresh_token**: opaque, hết hạn sau **7 ngày**, rotation mỗi lần dùng

### RBAC
| Quyền | admin | manager | staff |
|-------|:-----:|:-------:|:-----:|
| Xem records | ✅ | ✅ | ✅ |
| Duyệt / Flag record | ✅ | ✅ | ❌ |
| Tạo user | ✅ | ✅ | ❌ |
| Deactivate / Reset PW / Đổi role | ✅ | ❌ | ❌ |
| Tạo / sửa DocumentType & Category | ✅ | ✅ | ❌ |
| Xóa field DocumentType | ✅ | ❌ | ❌ |
| Xem báo cáo & xuất file | ✅ | ✅ | ❌ |
| Xem / Xuất Audit logs | ✅ | ✅ | ❌ |
| Archive audit logs cũ | ✅ | ❌ | ❌ |
    `,
    contact: { name: 'Internal' },
  },

  servers: [
    { url: 'http://localhost:3000', description: 'Local dev' },
  ],

  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Nhập access_token lấy từ POST /api/auth/login',
      },
    },

    schemas: {

      // ── Primitives ─────────────────────────────────────────────────────────
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Invalid credentials' },
        },
      },

      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
        },
      },

      // ── Users ──────────────────────────────────────────────────────────────
      UserPublic: {
        type: 'object',
        properties: {
          id:             { type: 'string', format: 'uuid', example: '00c17bcc-3724-4cf0-8a9c-222285812eaf' },
          username:       { type: 'string', example: 'admin' },
          name:           { type: 'string', example: 'Quản trị viên' },
          role:           { type: 'string', enum: ['admin', 'manager', 'staff'] },
          is_active:      { type: 'boolean', example: true },
          must_change_pw: { type: 'boolean', example: false },
          last_login_at:  { type: 'string', format: 'date-time', nullable: true },
          created_at:     { type: 'string', format: 'date-time' },
        },
      },

      TokenPair: {
        type: 'object',
        properties: {
          access_token:  { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          refresh_token: { type: 'string', example: '2d0a5c2e7ca72f3b0b5d...' },
        },
      },

      // ── Categories ─────────────────────────────────────────────────────────
      Category: {
        type: 'object',
        properties: {
          id:          { type: 'string', format: 'uuid', example: 'a1b2c3d4-0000-0000-0000-000000000001' },
          name:        { type: 'string', example: 'Hóa đơn' },
          description: { type: 'string', nullable: true, example: 'Hóa đơn mua hàng, VAT...' },
          color:       { type: 'string', example: '#1890ff' },
          is_active:   { type: 'boolean', example: true },
          created_at:  { type: 'string', format: 'date-time' },
        },
      },

      // ── Records ────────────────────────────────────────────────────────────
      RecordSummary: {
        type: 'object',
        description: 'Bản ghi rút gọn — dùng trong danh sách',
        properties: {
          id:                        { type: 'string', format: 'uuid' },
          platform:                  { type: 'string', enum: ['telegram', 'zalo', 'discord'], example: 'telegram' },
          sender_id:                 { type: 'string', format: 'uuid', nullable: true },
          sender_name:               { type: 'string', example: 'Nguyễn Văn A' },
          image_url:                 { type: 'string', format: 'uri', nullable: true, example: 'https://res.cloudinary.com/...' },
          image_thumbnail:           { type: 'string', format: 'uri', nullable: true },
          ocr_text:                  { type: 'string', nullable: true, example: 'Hóa đơn số 001 ngày 22/04/2026...' },
          note:                      { type: 'string', nullable: true },
          status:                    { type: 'string', enum: ['new', 'reviewed', 'approved', 'flagged', 'deleted'], example: 'new' },
          flag_reason:               { type: 'string', nullable: true },
          category_id:               { type: 'string', format: 'uuid', nullable: true },
          category_name:             { type: 'string', nullable: true, example: 'Hóa đơn' },
          category_color:            { type: 'string', nullable: true, example: '#1890ff' },
          document_type_id:          { type: 'string', format: 'uuid', nullable: true, description: 'UUID loại tài liệu (từ document_types)' },
          document_type_code:        { type: 'string', nullable: true, example: 'bank_transfer' },
          document_type_name:        { type: 'string', nullable: true, example: 'Chuyển khoản ngân hàng' },
          extraction_status:         { type: 'string', enum: ['pending','done','needs_review','failed'], nullable: true, example: 'done' },
          classification_confidence: { type: 'number', nullable: true, example: 0.88 },
          ocr_status:                { type: 'string', enum: ['pending', 'done', 'failed'], nullable: true },
          ocr_confidence:            { type: 'number', nullable: true, example: 0.9 },
          received_at:               { type: 'string', format: 'date-time' },
          created_at:                { type: 'string', format: 'date-time' },
          updated_at:                { type: 'string', format: 'date-time' },
        },
      },

      RecordDetail: {
        allOf: [
          { $ref: '#/components/schemas/RecordSummary' },
          {
            type: 'object',
            description: 'Bản ghi đầy đủ — dùng trong GET /:id',
            properties: {
              sender_username:  { type: 'string', nullable: true, example: 'nhanvien01' },
              reviewed_by:      { type: 'string', format: 'uuid', nullable: true },
              reviewed_by_name: { type: 'string', nullable: true },
              reviewed_at:      { type: 'string', format: 'date-time', nullable: true },
              approved_by:      { type: 'string', format: 'uuid', nullable: true },
              approved_by_name: { type: 'string', nullable: true },
              approved_at:      { type: 'string', format: 'date-time', nullable: true },
              source_chat_id:   { type: 'string', nullable: true },
              source_chat_type: { type: 'string', enum: ['private', 'group', 'channel'], nullable: true },
              extracted_data:   { type: 'object', nullable: true, description: 'Raw JSON từ AI/OCR provider' },
              field_definitions: {
                type: 'array',
                description: 'Danh sách trường của loại tài liệu (dùng cho hiển thị có thứ tự)',
                items: { $ref: '#/components/schemas/DocumentTypeField' },
              },
              field_values: {
                type: 'object',
                description: 'Object keyed by field_key — giá trị trích xuất/chỉnh sửa từng trường',
                additionalProperties: { $ref: '#/components/schemas/RecordFieldValue' },
                example: {
                  amount: { label: 'Số tiền', data_type: 'money', value: 1500000, source: 'ai', confidence: 0.88 },
                  transfer_date: { label: 'Ngày chuyển khoản', data_type: 'date', value: '2026-04-23', source: 'ai' },
                },
              },
            },
          },
        ],
      },

      // ── Pagination wrapper ─────────────────────────────────────────────────
      PaginatedRecords: {
        type: 'object',
        properties: {
          data:        { type: 'array', items: { $ref: '#/components/schemas/RecordSummary' } },
          total:       { type: 'integer', example: 42 },
          page:        { type: 'integer', example: 1 },
          total_pages: { type: 'integer', example: 3 },
        },
      },

      PaginatedUsers: {
        type: 'object',
        properties: {
          data:  { type: 'array', items: { $ref: '#/components/schemas/UserPublic' } },
          total: { type: 'integer', example: 5 },
          page:  { type: 'integer', example: 1 },
        },
      },

      // ── Document Types ─────────────────────────────────────────────────────
      DocumentTypeField: {
        type: 'object',
        properties: {
          id:               { type: 'string', format: 'uuid' },
          field_key:        { type: 'string', example: 'amount' },
          label:            { type: 'string', example: 'Số tiền' },
          data_type:        { type: 'string', enum: ['text','number','date','datetime','boolean','json','money'], example: 'money' },
          unit:             { type: 'string', nullable: true, example: 'VND' },
          is_required:      { type: 'boolean', example: false },
          is_filterable:    { type: 'boolean', example: true },
          is_reportable:    { type: 'boolean', example: true },
          aggregation_type: { type: 'string', enum: ['none','sum','avg','count','min','max'], example: 'sum' },
          display_order:    { type: 'integer', example: 1 },
        },
      },

      DocumentType: {
        type: 'object',
        properties: {
          id:                  { type: 'string', format: 'uuid' },
          code:                { type: 'string', example: 'bank_transfer' },
          name:                { type: 'string', example: 'Chuyển khoản ngân hàng' },
          description:         { type: 'string', nullable: true },
          default_category_id: { type: 'string', format: 'uuid', nullable: true },
          is_active:           { type: 'boolean', example: true },
          created_at:          { type: 'string', format: 'date-time' },
          fields:              { type: 'array', items: { $ref: '#/components/schemas/DocumentTypeField' } },
        },
      },

      // ── Audit ──────────────────────────────────────────────────────────────
      AuditLogEntry: {
        type: 'object',
        description: 'Một dòng nhật ký hoạt động',
        properties: {
          id:          { type: 'string', format: 'uuid' },
          action:      { type: 'string', enum: ['create','edit','review','approve','flag','delete','login','logout','password_change'], example: 'approve' },
          resource:    { type: 'string', nullable: true, example: 'records' },
          resource_id: { type: 'string', format: 'uuid', nullable: true },
          ip_address:  { type: 'string', nullable: true, example: '192.168.1.10' },
          created_at:  { type: 'string', format: 'date-time' },
          user_name:   { type: 'string', example: 'Nguyễn Hoàng Khải' },
          user_role:   { type: 'string', enum: ['admin','manager','staff'], nullable: true },
        },
      },

      RecordFieldValue: {
        type: 'object',
        description: 'Giá trị trích xuất của một trường trong record (keyed by field_key)',
        properties: {
          label:      { type: 'string', example: 'Số tiền' },
          data_type:  { type: 'string', example: 'money' },
          value:      { description: 'Giá trị thực — number, string, boolean, object tuỳ data_type', example: 1500000 },
          source:     { type: 'string', enum: ['ai', 'human', 'rule'], example: 'ai' },
          confidence: { type: 'number', nullable: true, example: 0.88 },
        },
      },
    },
  },

  // ── Tags ─────────────────────────────────────────────────────────────────────
  tags: [
    { name: 'Auth',          description: 'Đăng nhập, refresh token, logout, đổi mật khẩu' },
    { name: 'Users',         description: 'Quản lý tài khoản nội bộ — admin/manager' },
    { name: 'Records',       description: 'Ghi chép nhận từ các nền tảng (Telegram, Zalo...) hoặc tạo thủ công qua web' },
    { name: 'DocumentTypes', description: 'Loại tài liệu động và định nghĩa trường' },
    { name: 'Categories',    description: 'Danh mục phân loại ghi chép' },
    { name: 'Dashboard',     description: 'Thống kê tổng quan' },
    { name: 'Reports',       description: 'Báo cáo tổng hợp theo loại tài liệu, ngày, kênh' },
    { name: 'Search',        description: 'Tìm kiếm toàn văn (full-text search)' },
    { name: 'Notifications', description: 'Thông báo realtime — summary badge, Socket.io events' },
    { name: 'Settings',      description: 'Cài đặt hệ thống — lưu trong system_settings, secret fields mã hoá AES-256-GCM' },
  ],

  // ── Paths ─────────────────────────────────────────────────────────────────────
  paths: {

    // ════════════════════════════════════════════════════════════════════════════
    // AUTH
    // ════════════════════════════════════════════════════════════════════════════

    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập',
        description: 'Public — không cần token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', example: 'Admin@2026!' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Đăng nhập thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/TokenPair' },
                    {
                      type: 'object',
                      properties: {
                        user: {
                          type: 'object',
                          properties: {
                            id:             { type: 'string', format: 'uuid' },
                            name:           { type: 'string', example: 'Quản trị viên' },
                            role:           { type: 'string', enum: ['admin', 'manager', 'staff'] },
                            must_change_pw: { type: 'boolean', example: true },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { description: 'Sai credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Tài khoản bị vô hiệu hoá', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          423: { description: 'Tài khoản bị khoá tạm thời (sai quá 5 lần)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Làm mới access token',
        description: 'Public. Gửi `refresh_token` → nhận cặp token mới. Token cũ bị **revoke ngay** (rotation). Nếu gửi token đã revoke → toàn bộ family bị revoke (chống theft).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refresh_token'],
                properties: {
                  refresh_token: { type: 'string', example: '2d0a5c2e7ca72f3b...' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Token mới', content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenPair' } } } },
          401: { description: 'Token không hợp lệ / đã revoke / hết hạn', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Tài khoản bị vô hiệu hoá', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng xuất',
        description: 'Revoke `refresh_token` hiện tại. Access token cũ vẫn hợp lệ đến hết 15 phút.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refresh_token'],
                properties: {
                  refresh_token: { type: 'string', example: '2d0a5c2e7ca72f3b...' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Đăng xuất thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
          401: { description: 'Không có / sai access token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/auth/logout-all': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng xuất tất cả thiết bị',
        description: 'Revoke **toàn bộ** refresh_token của user đang đăng nhập. Dùng khi nghi ngờ bị lộ token.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Đã kick tất cả sessions', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
          401: { description: 'Không có / sai access token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Xem thông tin user đang đăng nhập',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Thông tin user', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserPublic' } } } },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Đổi mật khẩu',
        description: 'Sau khi đổi thành công, **tất cả** refresh_token bị revoke (buộc login lại trên thiết bị khác).',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['current_password', 'new_password'],
                properties: {
                  current_password: { type: 'string', example: 'Admin@2026!' },
                  new_password:     { type: 'string', example: 'NewPass@2026!', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Đổi mật khẩu thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
          400: { description: 'Thiếu field / mật khẩu mới < 8 ký tự', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { description: 'Mật khẩu hiện tại sai', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════════
    // USERS
    // ════════════════════════════════════════════════════════════════════════════

    '/api/users': {
      post: {
        tags: ['Users'],
        summary: 'Tạo user nội bộ',
        description: 'Quyền: **admin** hoặc **manager** (manager không tạo được admin). Nếu không truyền `password`, hệ thống tự sinh mật khẩu tạm — trả trong `temp_password` (chỉ hiện 1 lần).',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'name'],
                properties: {
                  username: { type: 'string', minLength: 3, maxLength: 50, example: 'nhanvien01' },
                  name:     { type: 'string', example: 'Nguyễn Văn A' },
                  role:     { type: 'string', enum: ['staff', 'manager', 'admin'], default: 'staff' },
                  password: { type: 'string', minLength: 8, description: 'Nếu bỏ trống → hệ thống tự sinh', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Tạo thành công',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/UserPublic' },
                    {
                      type: 'object',
                      properties: {
                        temp_password: { type: 'string', description: 'Chỉ có khi không truyền password', example: 'X7mK!p2QnR4v', nullable: true },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: { description: 'Thiếu field / validation fail', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          409: { description: 'Username đã tồn tại', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },

      get: {
        tags: ['Users'],
        summary: 'Danh sách users',
        description: 'Quyền: **admin** hoặc **manager**.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'role',      in: 'query', schema: { type: 'string', enum: ['admin', 'manager', 'staff'] }, description: 'Lọc theo role' },
          { name: 'is_active', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Lọc theo trạng thái' },
          { name: 'page',      in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit',     in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: { description: 'Danh sách users', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedUsers' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Xem chi tiết user',
        description: 'Admin/manager xem được mọi user. Staff chỉ xem được chính mình.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: '00c17bcc-3724-4cf0-8a9c-222285812eaf' },
        ],
        responses: {
          200: { description: 'Thông tin user', content: { 'application/json': { schema: { $ref: '#/components/schemas/UserPublic' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'User không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/users/{id}/activate': {
      patch: {
        tags: ['Users'],
        summary: 'Kích hoạt / vô hiệu hoá user',
        description: 'Quyền: **admin only**. Khi deactivate → toàn bộ session bị revoke ngay.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['is_active'],
                properties: {
                  is_active: { type: 'boolean', example: false },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Cập nhật thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
          400: { description: 'is_active không phải boolean / không tự deactivate mình', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Không đủ quyền (cần admin)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'User không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/users/{id}/reset-password': {
      post: {
        tags: ['Users'],
        summary: 'Reset mật khẩu user',
        description: 'Quyền: **admin only**. Sinh mật khẩu tạm, buộc user đổi khi login lại. Tất cả session bị revoke.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'Reset thành công',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    temp_password: { type: 'string', description: 'Hiện 1 lần — admin thông báo cho user', example: 'X7mK!p2QnR4v' },
                  },
                },
              },
            },
          },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'User không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/users/list': {
      get: {
        tags: ['Users'],
        summary: 'Danh sách user rút gọn (dùng cho dropdown chọn người gửi)',
        description: 'Mọi user đã đăng nhập đều gọi được (không yêu cầu admin/manager). Trả về id, name, username, role của tất cả user đang active, sắp xếp theo tên.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Danh sách user active',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id:       { type: 'string', format: 'uuid' },
                          name:     { type: 'string', example: 'Nguyễn Văn A' },
                          username: { type: 'string', example: 'nhanvien01' },
                          role:     { type: 'string', enum: ['admin', 'manager', 'staff'] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/users/{id}/role': {
      patch: {
        tags: ['Users'],
        summary: 'Đổi role user',
        description: 'Quyền: **admin only**. Không thể tự đổi role của chính mình.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role'],
                properties: {
                  role: { type: 'string', enum: ['staff', 'manager', 'admin'], example: 'manager' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Đổi role thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
          400: { description: 'Role không hợp lệ / tự đổi role mình', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'User không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════════
    // RECORDS
    // ════════════════════════════════════════════════════════════════════════════

    '/api/records': {
      get: {
        tags: ['Records'],
        summary: 'Danh sách ghi chép',
        description: 'Mặc định ẩn bản ghi đã xoá (`status=deleted`). Truyền `status=deleted` để xem. Hỗ trợ multi-value CSV cho `status`, `platform`, `category_id`, `document_type_id`, `sender_name`.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'status', in: 'query',
            schema: { type: 'string', example: 'new,reviewed' },
            description: 'Lọc theo trạng thái (CSV — ví dụ: `new,reviewed`). Mặc định: ẩn deleted.',
          },
          {
            name: 'platform', in: 'query',
            schema: { type: 'string', example: 'telegram,manual' },
            description: 'Lọc theo nền tảng (CSV). Giá trị: `telegram`, `zalo`, `discord`, `manual`.',
          },
          { name: 'sender_id',   in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'UUID của user gửi' },
          { name: 'sender_name', in: 'query', schema: { type: 'string', example: 'Nguyễn A,Trần B' }, description: 'Lọc theo tên người gửi (CSV, exact match)' },
          { name: 'category_id', in: 'query', schema: { type: 'string', example: 'uuid1,uuid2' }, description: 'UUID danh mục (CSV)' },
          { name: 'document_type_id', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Lọc theo loại tài liệu' },
          { name: 'extraction_status', in: 'query', schema: { type: 'string', enum: ['pending','done','needs_review','failed'] }, description: 'Lọc theo trạng thái trích xuất AI' },
          { name: 'search',      in: 'query', schema: { type: 'string', example: 'hóa đơn' }, description: 'Tìm kiếm ILIKE trong note, sender_name, ocr_text' },
          { name: 'date_from',   in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-01' }, description: 'Từ ngày (received_at >=)' },
          { name: 'date_to',     in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-30' }, description: 'Đến ngày (received_at <=, inclusive)' },
          {
            name: 'sort_order', in: 'query',
            schema: { type: 'string', enum: ['desc', 'asc'], default: 'desc' },
            description: 'Thứ tự sắp xếp theo `received_at`. `desc` = mới nhất trước (mặc định), `asc` = cũ nhất trước.',
          },
          { name: 'page',  in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          {
            name: 'include_field_values', in: 'query',
            schema: { type: 'string', enum: ['true','false'] },
            description: 'Khi `true` — đính kèm `field_values` (object keyed by field_key) vào mỗi record.',
          },
          {
            name: 'fv[field_key][op]', in: 'query',
            schema: { type: 'string' },
            description: `**Lọc động theo field value** — bracket notation.

Ví dụ: \`?fv[amount][gte]=1000000&fv[transfer_date][from]=2026-04-01\`

Toán tử: \`gte\` / \`lte\` (số), \`from\` / \`to\` (ngày), \`like\` (ILIKE), \`eq\` (auto-detect).`,
          },
        ],
        responses: {
          200: { description: 'Danh sách ghi chép', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedRecords' } } } },
          400: { description: 'status không hợp lệ', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },

      post: {
        tags: ['Records'],
        summary: 'Tạo ghi chép thủ công (Web Form)',
        description: `Tạo record thủ công qua Web Dashboard — không qua webhook platform.

**Content-Type:** \`multipart/form-data\` (bắt buộc khi có đính kèm ảnh; có thể dùng \`application/json\` nếu không có ảnh).

**OCR async:** Nếu có ảnh đính kèm, backend trả 201 ngay sau khi upload xong. OCR / AI extraction chạy nền qua \`setImmediate\`, cập nhật lại record sau khi xong. Frontend poll \`GET /api/records/:id\` mỗi 3 giây cho đến khi \`ocr_status != 'pending'\`.`,
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['sender_id'],
                properties: {
                  sender_id:        { type: 'string', format: 'uuid', description: 'UUID của user gửi (bắt buộc)' },
                  sender_name:      { type: 'string', description: 'Tên hiển thị (tự điền từ user nếu bỏ trống)' },
                  note:             { type: 'string', example: 'Hóa đơn mua vật tư tháng 4', description: 'Bắt buộc nếu không có ảnh' },
                  category_id:      { type: 'string', format: 'uuid', nullable: true },
                  document_type_id: { type: 'string', format: 'uuid', nullable: true },
                  platform:         { type: 'string', default: 'manual', example: 'manual' },
                  images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Tối đa 3 ảnh, mỗi file tối đa 10 MB. Chỉ nhận image/* MIME type.',
                    maxItems: 3,
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Tạo thành công. Nếu có ảnh, `ocr_status = pending` — poll GET /:id để chờ OCR xong.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id:              { type: 'string', format: 'uuid' },
                    ocr_status:      { type: 'string', enum: ['pending', 'success', 'failed'], example: 'pending' },
                    extraction_status: { type: 'string', enum: ['pending', 'done', 'needs_review', 'failed'] },
                    image_url:       { type: 'string', nullable: true },
                    thumbnail_url:   { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          400: { description: 'Thiếu sender_id / thiếu note khi không có ảnh / file không phải ảnh', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/records/stats': {
      get: {
        tags: ['Records'],
        summary: 'Thống kê nhanh theo trạng thái (dùng cho overview cards)',
        description: `Trả về số lượng record theo từng trạng thái (new / reviewed / approved / flagged / total) phù hợp với bộ lọc hiện tại — **không tính status filter**, luôn trả đủ breakdown.

Hỗ trợ cùng các query param filter như \`GET /api/records\` (trừ \`status\`, \`sort_order\`, \`page\`, \`limit\`, \`include_field_values\`).`,
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'platform',         in: 'query', schema: { type: 'string' }, description: 'CSV platforms' },
          { name: 'category_id',      in: 'query', schema: { type: 'string' }, description: 'CSV category UUIDs' },
          { name: 'document_type_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'sender_name',      in: 'query', schema: { type: 'string' }, description: 'CSV sender names' },
          { name: 'search',           in: 'query', schema: { type: 'string' } },
          { name: 'date_from',        in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'date_to',          in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: {
            description: 'Breakdown theo trạng thái',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    new:      { type: 'integer', example: 5 },
                    reviewed: { type: 'integer', example: 3 },
                    approved: { type: 'integer', example: 12 },
                    flagged:  { type: 'integer', example: 2 },
                    total:    { type: 'integer', example: 22 },
                  },
                },
              },
            },
          },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/records/senders': {
      get: {
        tags: ['Records'],
        summary: 'Danh sách tên người gửi (cho dropdown filter)',
        description: 'Trả về danh sách distinct `sender_name` không null/rỗng, bỏ qua record đã xoá. Tối đa 200 tên.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Danh sách tên người gửi',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { type: 'string' }, example: ['Nguyễn Văn A', 'Trần Thị B'] },
                  },
                },
              },
            },
          },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/records/{id}': {
      get: {
        tags: ['Records'],
        summary: 'Xem chi tiết ghi chép',
        description: 'Trả về đầy đủ thông tin kèm tên người gửi, danh mục, người review/approve.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Chi tiết ghi chép', content: { 'application/json': { schema: { $ref: '#/components/schemas/RecordDetail' } } } },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },

      patch: {
        tags: ['Records'],
        summary: 'Sửa ghi chú / danh mục',
        description: 'Tất cả user đã login có thể sửa. Mỗi thay đổi được ghi vào `edit_logs`.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Truyền ít nhất 1 field. field_values là object keyed by field_key.',
                properties: {
                  note:             { type: 'string', nullable: true, example: 'Hóa đơn mua văn phòng phẩm tháng 4' },
                  category_id:      { type: 'string', format: 'uuid', nullable: true, example: 'a1b2c3d4-0000-0000-0000-000000000001' },
                  document_type_id: { type: 'string', format: 'uuid', nullable: true, description: 'Gán / đổi loại tài liệu' },
                  field_values: {
                    type: 'object',
                    description: 'Chỉnh sửa giá trị trích xuất từng trường. Key = field_key, value = giá trị thô.',
                    example: { amount: 1500000, bank_name: 'Vietcombank', transfer_date: '2026-04-23' },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Cập nhật thành công',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    changed: { type: 'boolean', description: 'false nếu giá trị giống cũ', example: true },
                  },
                },
              },
            },
          },
          400: { description: 'Không có field nào để update', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },

      delete: {
        tags: ['Records'],
        summary: 'Xoá ghi chép (soft delete)',
        description: 'Quyền: **admin** hoặc **manager**. Chỉ đổi `status = deleted`, không xoá khỏi DB.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Đã xoá', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/records/{id}/status': {
      patch: {
        tags: ['Records'],
        summary: 'Cập nhật trạng thái duyệt',
        description: `Quyền: **admin** hoặc **manager**.

Các trạng thái cho phép: \`reviewed\`, \`approved\`, \`flagged\`.

- **reviewed**: ghi nhận người review + thời gian
- **approved**: ghi nhận người approve + thời gian
- **flagged**: bắt buộc có \`flag_reason\`; tự động gửi thông báo về platform gốc (Telegram/Zalo) nếu có \`source_chat_id\``,
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status:      { type: 'string', enum: ['reviewed', 'approved', 'flagged'], example: 'approved' },
                  flag_reason: { type: 'string', description: 'Bắt buộc khi status = flagged', example: 'Ảnh mờ, không đọc được số tiền' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Cập nhật thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
          400: { description: 'status không hợp lệ / thiếu flag_reason', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════════
    // DOCUMENT TYPES
    // ════════════════════════════════════════════════════════════════════════════

    '/api/document-types': {
      get: {
        tags: ['DocumentTypes'],
        summary: 'Danh sách loại tài liệu',
        description: 'Trả về tất cả loại tài liệu đang active. Truyền `include_inactive=true` để lấy cả loại đã ẩn (admin/manager). Response không kèm `fields` array — dùng GET /:id để lấy đầy đủ.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'include_inactive', in: 'query', schema: { type: 'string', enum: ['true','false'] }, description: 'Lấy cả loại không active (chỉ admin/manager)' },
        ],
        responses: {
          200: {
            description: 'Danh sách loại tài liệu (không kèm fields array để giảm payload)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/DocumentType' } },
                  },
                },
              },
            },
          },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },

      post: {
        tags: ['DocumentTypes'],
        summary: 'Tạo loại tài liệu mới',
        description: `Quyền: **admin** hoặc **manager**.

\`code\` phải là snake_case duy nhất (chỉ chữ thường, số, gạch dưới, bắt đầu bằng chữ cái). Sau khi tạo, in-memory cache bị invalidate ngay.`,
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'name'],
                properties: {
                  code:                { type: 'string', example: 'hop_dong_mua_ban', description: 'snake_case — duy nhất trong hệ thống' },
                  name:                { type: 'string', example: 'Hợp đồng mua bán' },
                  description:         { type: 'string', nullable: true, example: 'Hợp đồng mua bán hàng hóa' },
                  default_category_id: { type: 'string', format: 'uuid', nullable: true, description: 'Danh mục mặc định tự gán khi AI phân loại vào type này' },
                  is_active:           { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Tạo thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/DocumentType' } } } },
          400: { description: 'Thiếu field / code sai format', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          409: { description: 'Code đã tồn tại', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/document-types/{id}': {
      get: {
        tags: ['DocumentTypes'],
        summary: 'Chi tiết loại tài liệu (kèm fields)',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Chi tiết loại tài liệu kèm danh sách trường', content: { 'application/json': { schema: { $ref: '#/components/schemas/DocumentType' } } } },
          404: { description: 'Không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },

      patch: {
        tags: ['DocumentTypes'],
        summary: 'Cập nhật metadata loại tài liệu',
        description: 'Quyền: **admin** hoặc **manager**. Truyền bất kỳ field nào cần thay đổi. Không thể đổi `code` sau khi tạo. Cache được invalidate ngay.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Truyền ít nhất 1 field',
                properties: {
                  name:                { type: 'string', example: 'Hợp đồng mua bán (updated)' },
                  description:         { type: 'string', nullable: true },
                  is_active:           { type: 'boolean', example: false, description: 'false = ẩn khỏi tab filter và dropdown' },
                  default_category_id: { type: 'string', format: 'uuid', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Cập nhật thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/DocumentType' } } } },
          400: { description: 'Không có field nào để update', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Loại tài liệu không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/document-types/{id}/fields': {
      get: {
        tags: ['DocumentTypes'],
        summary: 'Lấy danh sách trường của loại tài liệu',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'Danh sách trường theo display_order',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/DocumentTypeField' } },
                  },
                },
              },
            },
          },
          404: { description: 'Không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },

      post: {
        tags: ['DocumentTypes'],
        summary: 'Thêm trường vào loại tài liệu',
        description: `Quyền: **admin** hoặc **manager**.

\`field_key\` phải duy nhất trong cùng loại tài liệu và chỉ chứa \`[a-zA-Z0-9_]\`. Sau khi thêm, cache bị invalidate — các record mới nhận từ webhook sẽ ngay lập tức sử dụng schema mới.`,
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID của document type' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['field_key', 'label', 'data_type'],
                properties: {
                  field_key:        { type: 'string', example: 'amount', description: 'Khóa nội bộ — [a-zA-Z0-9_]' },
                  label:            { type: 'string', example: 'Số tiền', description: 'Nhãn hiển thị trên UI' },
                  data_type:        { type: 'string', enum: ['text','number','date','datetime','boolean','json','money'], example: 'money' },
                  unit:             { type: 'string', nullable: true, example: 'VND', description: 'Đơn vị đo lường (tùy chọn)' },
                  is_required:      { type: 'boolean', default: false, description: 'Trường bắt buộc hay không' },
                  is_filterable:    { type: 'boolean', default: false, description: 'Hiển thị trong filter bar ở pivot view' },
                  is_reportable:    { type: 'boolean', default: false, description: 'Tính vào báo cáo tài chính' },
                  aggregation_type: { type: 'string', enum: ['none','sum','avg','count','min','max'], default: 'none', description: 'Hàm tổng hợp dùng trong reports' },
                  display_order:    { type: 'integer', default: 0, description: 'Thứ tự hiển thị cột (tăng dần)' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Thêm trường thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/DocumentTypeField' } } } },
          400: { description: 'Thiếu field / data_type không hợp lệ / field_key sai format', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Loại tài liệu không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          409: { description: 'field_key đã tồn tại trong loại tài liệu này', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/document-types/{id}/fields/{fieldId}': {
      patch: {
        tags: ['DocumentTypes'],
        summary: 'Cập nhật định nghĩa trường',
        description: 'Quyền: **admin** hoặc **manager**. Không thể đổi `field_key` hoặc `data_type` (vì dữ liệu cũ đã lưu theo cột tương ứng). Truyền ít nhất 1 field.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id',      in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID của document type' },
          { name: 'fieldId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID của field' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  label:            { type: 'string', example: 'Số tiền chuyển khoản' },
                  unit:             { type: 'string', nullable: true, example: 'VND' },
                  is_required:      { type: 'boolean' },
                  is_filterable:    { type: 'boolean' },
                  is_reportable:    { type: 'boolean' },
                  aggregation_type: { type: 'string', enum: ['none','sum','avg','count','min','max'] },
                  display_order:    { type: 'integer', example: 2 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Cập nhật thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/DocumentTypeField' } } } },
          400: { description: 'Không có field nào để update', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Field không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },

      delete: {
        tags: ['DocumentTypes'],
        summary: 'Xóa trường khỏi loại tài liệu',
        description: `Quyền: **admin only**.

⚠️ **Cảnh báo**: Xóa trường sẽ **cascade xóa toàn bộ** \`record_field_values\` liên quan (dữ liệu trích xuất của trường đó trong tất cả record). Hành động không thể hoàn tác.`,
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id',      in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID của document type' },
          { name: 'fieldId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID của field cần xóa' },
        ],
        responses: {
          200: { description: 'Xóa thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
          403: { description: 'Không đủ quyền (cần admin)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Field không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════════
    // CATEGORIES
    // ════════════════════════════════════════════════════════════════════════════

    '/api/categories': {
      get: {
        tags: ['Categories'],
        summary: 'Danh sách danh mục',
        description: 'Mọi user đã login đều xem được. Mặc định chỉ trả về danh mục đang active. Admin/manager có thể truyền `include_inactive=true` để xem tất cả.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'include_inactive', in: 'query',
            schema: { type: 'string', enum: ['true', 'false'] },
            description: 'Admin/manager only — hiện cả danh mục đã ẩn',
          },
        ],
        responses: {
          200: {
            description: 'Danh sách danh mục',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
                  },
                },
              },
            },
          },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },

      post: {
        tags: ['Categories'],
        summary: 'Tạo danh mục mới',
        description: 'Quyền: **admin** hoặc **manager**.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name:        { type: 'string', example: 'Hóa đơn' },
                  description: { type: 'string', nullable: true, example: 'Hóa đơn VAT, phiếu thu chi...' },
                  color:       { type: 'string', example: '#52c41a', description: 'Hex color — mặc định #1890ff' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Tạo thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } },
          400: { description: 'Thiếu name', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          409: { description: 'Tên danh mục đã tồn tại', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/categories/{id}': {
      put: {
        tags: ['Categories'],
        summary: 'Cập nhật danh mục',
        description: 'Quyền: **admin** hoặc **manager**. Truyền bất kỳ field nào cần thay đổi.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Truyền ít nhất 1 field',
                properties: {
                  name:        { type: 'string', example: 'Hóa đơn VAT' },
                  description: { type: 'string', nullable: true },
                  color:       { type: 'string', example: '#faad14' },
                  is_active:   { type: 'boolean', example: false, description: 'false = ẩn khỏi danh sách chọn' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Cập nhật thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } } },
          400: { description: 'Không có field nào để update', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Danh mục không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════════
    // DASHBOARD
    // ════════════════════════════════════════════════════════════════════════════

    '/api/dashboard/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Thống kê tổng quan',
        description: 'Trả về số liệu hôm nay, tuần này và số bản ghi đang chờ duyệt.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Thống kê',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    today: {
                      type: 'object',
                      properties: {
                        total:    { type: 'integer', example: 12 },
                        new:      { type: 'integer', example: 5 },
                        reviewed: { type: 'integer', example: 3 },
                        approved: { type: 'integer', example: 3 },
                        flagged:  { type: 'integer', example: 1 },
                      },
                    },
                    this_week: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer', example: 47 },
                      },
                    },
                    pending_review: { type: 'integer', description: 'Số bản ghi status=new chưa xem', example: 8 },
                  },
                },
              },
            },
          },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════════
    // REPORTS
    // ════════════════════════════════════════════════════════════════════════════

    '/api/reports/summary': {
      get: {
        tags: ['Reports'],
        summary: 'Thống kê tổng hợp (by status / platform / doc type / category / timeline)',
        description: 'Quyền: **admin** hoặc **manager**. Trả về nhiều chiều thống kê theo bộ lọc chung.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'date_from',        in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-01' } },
          { name: 'date_to',          in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-30' } },
          { name: 'document_type_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'category_id',      in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'platform',         in: 'query', schema: { type: 'string', enum: ['telegram','zalo'] } },
        ],
        responses: {
          200: {
            description: 'Thống kê tổng hợp',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    by_status:        { type: 'array', items: { type: 'object', properties: { status: { type: 'string' }, count: { type: 'integer' } } } },
                    by_platform:      { type: 'array', items: { type: 'object', properties: { platform: { type: 'string' }, count: { type: 'integer' } } } },
                    by_document_type: { type: 'array', items: { type: 'object', properties: { code: { type: 'string' }, name: { type: 'string' }, count: { type: 'integer' } } } },
                    by_category:      { type: 'array', items: { type: 'object', properties: { category_name: { type: 'string' }, color: { type: 'string' }, count: { type: 'integer' } } } },
                    timeline:         { type: 'array', items: { type: 'object', properties: { date: { type: 'string', format: 'date' }, count: { type: 'integer' } } } },
                  },
                },
              },
            },
          },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/reports/financial': {
      get: {
        tags: ['Reports'],
        summary: 'Báo cáo tài chính — tổng hợp các trường aggregation_type=sum',
        description: `Quyền: **admin** hoặc **manager**. Mặc định chỉ tính record **đã duyệt** (status=approved). Truyền \`include_unapproved=true\` để tính tất cả.

Tổng hợp theo **metadata** từ \`document_type_fields.aggregation_type\` — không giả định cột cố định nào.`,
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'include_unapproved', in: 'query', schema: { type: 'string', enum: ['true','false'] }, description: 'Tính cả record chưa duyệt' },
          { name: 'date_from',          in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'date_to',            in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'document_type_id',   in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'category_id',        in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'platform',           in: 'query', schema: { type: 'string', enum: ['telegram','zalo'] } },
        ],
        responses: {
          200: {
            description: 'Kết quả tổng hợp tài chính',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total_records: { type: 'integer', example: 42 },
                    aggregations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          document_type_code: { type: 'string', example: 'bank_transfer' },
                          document_type_name: { type: 'string', example: 'Chuyển khoản ngân hàng' },
                          field_key:          { type: 'string', example: 'amount' },
                          field_label:        { type: 'string', example: 'Số tiền' },
                          unit:               { type: 'string', nullable: true, example: 'VND' },
                          record_count:       { type: 'integer', example: 12 },
                          total:              { type: 'number', example: 18000000 },
                          average:            { type: 'number', example: 1500000 },
                          min:                { type: 'number', example: 200000 },
                          max:                { type: 'number', example: 5000000 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/reports/by-type/{code}': {
      get: {
        tags: ['Reports'],
        summary: 'Báo cáo chi tiết theo loại tài liệu',
        description: 'Quyền: **admin** hoặc **manager**. Tổng hợp tất cả trường is_reportable=true của loại tài liệu đó.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string', example: 'bank_transfer' }, description: 'Code của document type' },
          { name: 'include_unapproved', in: 'query', schema: { type: 'string', enum: ['true','false'] } },
          { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'date_to',   in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'platform',  in: 'query', schema: { type: 'string', enum: ['telegram','zalo'] } },
        ],
        responses: {
          200: {
            description: 'Báo cáo theo loại tài liệu',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    document_type:  { $ref: '#/components/schemas/DocumentType' },
                    total_records:  { type: 'integer', example: 18 },
                    aggregations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          field_key:        { type: 'string', example: 'amount' },
                          label:            { type: 'string', example: 'Số tiền' },
                          data_type:        { type: 'string', example: 'money' },
                          unit:             { type: 'string', nullable: true },
                          aggregation_type: { type: 'string', example: 'sum' },
                          result:           { example: 18000000 },
                          count:            { type: 'integer', example: 18 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          404: { description: 'Loại tài liệu không tìm thấy', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/reports/staff': {
      get: {
        tags: ['Reports'],
        summary: 'Hiệu suất nhân viên (by sender)',
        description: 'Quyền: **admin** hoặc **manager**. Thống kê tổng / duyệt / flagged / tốc độ xử lý theo người gửi và nền tảng.',
        security: [{ BearerAuth: [] }],
        parameters: [..._rptFilters],
        responses: {
          200: {
            description: 'Báo cáo nhân viên',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    by_sender: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          sender_name:   { type: 'string', example: 'Nguyễn Văn A' },
                          platform:      { type: 'string', example: 'telegram' },
                          total:         { type: 'integer', example: 120 },
                          approved:      { type: 'integer', example: 95 },
                          flagged:       { type: 'integer', example: 3 },
                          pending:       { type: 'integer', example: 22 },
                          approval_rate: { type: 'number', example: 79.2, description: 'Phần trăm được duyệt' },
                          avg_hours:     { type: 'number', nullable: true, example: 4.5, description: 'Giờ xử lý trung bình (chỉ approved records)' },
                        },
                      },
                    },
                    by_platform: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          platform:      { type: 'string', example: 'telegram' },
                          total:         { type: 'integer', example: 300 },
                          approved:      { type: 'integer', example: 250 },
                          approval_rate: { type: 'number', example: 83.3 },
                        },
                      },
                    },
                    timeline: {
                      type: 'array',
                      items: { type: 'object', properties: { date: { type: 'string', format: 'date' }, count: { type: 'integer' } } },
                    },
                  },
                },
              },
            },
          },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/reports/heatmap': {
      get: {
        tags: ['Reports'],
        summary: 'Heatmap hoạt động (giờ × ngày trong tuần)',
        description: 'Quyền: **admin** hoặc **manager**. Trả về ma trận 7×24 — số records nhận theo thứ (0=CN) và giờ (0–23). Dùng để phát hiện giờ cao điểm.',
        security: [{ BearerAuth: [] }],
        parameters: [..._rptFilters],
        responses: {
          200: {
            description: 'Ma trận heatmap',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    cells: {
                      type: 'array',
                      description: 'Tối đa 168 phần tử (7 ngày × 24 giờ)',
                      items: {
                        type: 'object',
                        properties: {
                          day_of_week:  { type: 'integer', minimum: 0, maximum: 6, example: 1, description: '0=CN, 1=T2 … 6=T7' },
                          hour_of_day:  { type: 'integer', minimum: 0, maximum: 23, example: 9 },
                          count:        { type: 'integer', example: 42 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/reports/quality': {
      get: {
        tags: ['Reports'],
        summary: 'Chất lượng OCR & tỷ lệ flagged',
        description: 'Quyền: **admin** hoặc **manager**. Đánh giá chất lượng dữ liệu: phân bổ `ocr_status`, tỷ lệ flagged, breakdown theo nền tảng và người gửi.',
        security: [{ BearerAuth: [] }],
        parameters: [..._rptFilters],
        responses: {
          200: {
            description: 'Chất lượng OCR',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ocr_summary: {
                      type: 'object',
                      properties: {
                        total_with_ocr: { type: 'integer', example: 5000 },
                        pending:        { type: 'integer', example: 50 },
                        done:           { type: 'integer', example: 4800 },
                        failed:         { type: 'integer', example: 150 },
                        pending_pct:    { type: 'number', example: 1.0 },
                        done_pct:       { type: 'number', example: 96.0 },
                        failed_pct:     { type: 'number', example: 3.0 },
                      },
                    },
                    by_ocr_status: {
                      type: 'array',
                      items: { type: 'object', properties: { ocr_status: { type: 'string' }, count: { type: 'integer' } } },
                    },
                    flag_rate: {
                      type: 'object',
                      properties: {
                        total:    { type: 'integer', example: 91836 },
                        flagged:  { type: 'integer', example: 320 },
                        flag_pct: { type: 'number', example: 0.35 },
                      },
                    },
                    by_platform: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          platform:     { type: 'string', example: 'telegram' },
                          total:        { type: 'integer', example: 60000 },
                          flagged:      { type: 'integer', example: 200 },
                          flag_pct:     { type: 'number', example: 0.33 },
                          ocr_done_pct: { type: 'number', example: 95.8 },
                        },
                      },
                    },
                    by_sender: {
                      type: 'array',
                      description: 'Top 20 người gửi có tỷ lệ flag cao nhất',
                      items: {
                        type: 'object',
                        properties: {
                          sender_name: { type: 'string' },
                          total:       { type: 'integer' },
                          flagged:     { type: 'integer' },
                          flag_pct:    { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/reports/sla': {
      get: {
        tags: ['Reports'],
        summary: 'Tốc độ xử lý (SLA)',
        description: `Quyền: **admin** hoặc **manager**. Phân tích thời gian từ lúc nhận đến lúc duyệt (\`approved_at - received_at\`). Chỉ tính records đã approved và có \`approved_at IS NOT NULL\`.

**KPI chính:** avg_hours, median_hours, % xử lý trong 24h / 48h.`,
        security: [{ BearerAuth: [] }],
        parameters: [..._rptFilters],
        responses: {
          200: {
            description: 'Báo cáo SLA',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total_resolved:  { type: 'integer', example: 91836 },
                    avg_hours:       { type: 'number', nullable: true, example: 3.2 },
                    median_hours:    { type: 'number', nullable: true, example: 1.8 },
                    within_24h:      { type: 'integer', example: 85000 },
                    within_48h:      { type: 'integer', example: 90000 },
                    within_24h_pct:  { type: 'integer', nullable: true, example: 92, description: 'Phần trăm xử lý trong 24 giờ' },
                    within_48h_pct:  { type: 'integer', nullable: true, example: 98 },
                    backlog_count:   { type: 'integer', example: 243, description: 'Records đang còn tồn đọng (new + reviewed)' },
                    histogram: {
                      type: 'array',
                      description: '5 nhóm thời gian xử lý',
                      items: {
                        type: 'object',
                        properties: {
                          bucket: { type: 'string', example: '< 24 giờ' },
                          count:  { type: 'integer', example: 85000 },
                          pct:    { type: 'number', example: 92.5 },
                        },
                      },
                    },
                    by_document_type: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          code:         { type: 'string', example: 'bank_transfer' },
                          name:         { type: 'string', example: 'Chuyển khoản' },
                          total:        { type: 'integer', example: 500 },
                          avg_hours:    { type: 'number', example: 2.1 },
                          median_hours: { type: 'number', example: 1.5 },
                        },
                      },
                    },
                    by_platform: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          platform:     { type: 'string', example: 'telegram' },
                          total:        { type: 'integer', example: 60000 },
                          avg_hours:    { type: 'number', example: 2.8 },
                          median_hours: { type: 'number', example: 1.9 },
                        },
                      },
                    },
                    backlog: {
                      type: 'array',
                      description: 'Top 20 records tồn đọng lâu nhất',
                      items: {
                        type: 'object',
                        properties: {
                          id:                 { type: 'string', format: 'uuid' },
                          sender_name:        { type: 'string', nullable: true },
                          status:             { type: 'string', example: 'new' },
                          received_at:        { type: 'string', format: 'date-time' },
                          platform:           { type: 'string', example: 'telegram' },
                          document_type_name: { type: 'string', example: 'Chuyển khoản' },
                          age_hours:          { type: 'integer', example: 72, description: 'Số giờ kể từ lúc nhận đến hiện tại' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/reports/backlog': {
      get: {
        tags: ['Reports'],
        summary: 'Tồn đọng hiện tại (Backlog snapshot)',
        description: `Quyền: **admin** hoặc **manager**. Snapshot thời điểm hiện tại — toàn bộ records có \`status IN ('new','reviewed')\`. Không lọc theo date_from/date_to mặc định (hiện tại).

Hỗ trợ filter: platform, date_from, date_to (theo ngày nhận), document_type_id.`,
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'platform',         in: 'query', schema: { type: 'string', enum: ['telegram','zalo','manual'] } },
          { name: 'date_from',        in: 'query', schema: { type: 'string', format: 'date' }, description: 'Lọc theo ngày nhận' },
          { name: 'date_to',          in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'document_type_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'Tồn đọng hiện tại',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total_backlog:   { type: 'integer', example: 243 },
                    new_count:       { type: 'integer', example: 150, description: 'Records status=new' },
                    reviewed_count:  { type: 'integer', example: 93, description: 'Records status=reviewed' },
                    oldest_hours:    { type: 'integer', example: 720, description: 'Số giờ của record chờ lâu nhất' },
                    avg_wait_hours:  { type: 'number', example: 48.5 },
                    age_buckets: {
                      type: 'array',
                      description: '4 nhóm tuổi: < 24h, 1–3 ngày, 3–7 ngày, > 7 ngày',
                      items: {
                        type: 'object',
                        properties: {
                          bucket: { type: 'string', example: '1 – 3 ngày' },
                          count:  { type: 'integer', example: 80 },
                        },
                      },
                    },
                    by_document_type: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          code:           { type: 'string', example: 'bank_transfer' },
                          name:           { type: 'string', example: 'Chuyển khoản' },
                          count:          { type: 'integer', example: 50 },
                          oldest_hours:   { type: 'integer', example: 168 },
                          reviewed_count: { type: 'integer', example: 20 },
                        },
                      },
                    },
                    by_sender: {
                      type: 'array',
                      description: 'Top 10 người gửi có nhiều tồn đọng',
                      items: {
                        type: 'object',
                        properties: {
                          sender_name:  { type: 'string', example: 'Trần Thị B' },
                          count:        { type: 'integer', example: 25 },
                          oldest_hours: { type: 'integer', example: 96 },
                        },
                      },
                    },
                    records: {
                      type: 'array',
                      description: 'Top 50 records tồn đọng cũ nhất',
                      items: {
                        type: 'object',
                        properties: {
                          id:                 { type: 'string', format: 'uuid' },
                          sender_name:        { type: 'string', nullable: true },
                          status:             { type: 'string', example: 'new' },
                          received_at:        { type: 'string', format: 'date-time' },
                          platform:           { type: 'string', example: 'telegram' },
                          document_type_name: { type: 'string', example: 'Chuyển khoản' },
                          age_hours:          { type: 'integer', example: 168 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/reports/doc-trend': {
      get: {
        tags: ['Reports'],
        summary: 'Xu hướng loại tài liệu theo thời gian',
        description: 'Quyền: **admin** hoặc **manager**. Trả về top-8 loại tài liệu và timeline flat-rows cho top-5 (dùng để vẽ multi-line chart). Hỗ trợ so sánh kỳ trước.',
        security: [{ BearerAuth: [] }],
        parameters: [..._rptFilters],
        responses: {
          200: {
            description: 'Xu hướng loại tài liệu',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    by_document_type: {
                      type: 'array',
                      description: 'Top 8 loại tài liệu trong kỳ',
                      items: {
                        type: 'object',
                        properties: {
                          code:          { type: 'string', example: 'bank_transfer' },
                          name:          { type: 'string', example: 'Chuyển khoản' },
                          total:         { type: 'integer', example: 500 },
                          approved:      { type: 'integer', example: 450 },
                          flagged:       { type: 'integer', example: 10 },
                          approval_rate: { type: 'number', example: 90.0 },
                        },
                      },
                    },
                    timeline: {
                      type: 'array',
                      description: 'Flat rows — mỗi row là (date, code, name, count) cho top-5 loại; frontend pivot để vẽ line chart',
                      items: {
                        type: 'object',
                        properties: {
                          date:  { type: 'string', format: 'date', example: '2026-04-01' },
                          code:  { type: 'string', example: 'bank_transfer' },
                          name:  { type: 'string', example: 'Chuyển khoản' },
                          count: { type: 'integer', example: 12 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/reports/audit': {
      get: {
        tags: ['Reports'],
        summary: 'Phân tích Audit log (Tuân thủ)',
        description: `Quyền: **admin** hoặc **manager**. Thống kê nhật ký hoạt động hệ thống theo khoảng thời gian.

**Hành động nhạy cảm** (sensitive): \`delete\`, \`flag\`, \`password_change\` — được đếm riêng trong \`summary.sensitive_count\`.`,
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-01' }, description: 'Từ ngày tạo log' },
          { name: 'date_to',   in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-30' }, description: 'Đến ngày tạo log' },
          { name: 'user_id',   in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Lọc theo UUID người dùng cụ thể' },
        ],
        responses: {
          200: {
            description: 'Phân tích audit log',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    summary: {
                      type: 'object',
                      properties: {
                        total_logs:      { type: 'integer', example: 12500 },
                        unique_users:    { type: 'integer', example: 8 },
                        sensitive_count: { type: 'integer', example: 45, description: 'Số hành động nhạy cảm (delete, flag, password_change)' },
                        oldest_log:      { type: 'string', format: 'date-time', nullable: true },
                        newest_log:      { type: 'string', format: 'date-time', nullable: true },
                      },
                    },
                    by_action: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          action: { type: 'string', example: 'approve' },
                          count:  { type: 'integer', example: 8500 },
                        },
                      },
                    },
                    by_user: {
                      type: 'array',
                      description: 'Top 20 người dùng theo số hành động',
                      items: {
                        type: 'object',
                        properties: {
                          id:              { type: 'string', format: 'uuid' },
                          display_name:    { type: 'string', example: 'Nguyễn Hoàng Khải' },
                          role:            { type: 'string', example: 'admin' },
                          total_actions:   { type: 'integer', example: 3200 },
                          sensitive_count: { type: 'integer', example: 12 },
                          last_action_at:  { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                    timeline: {
                      type: 'array',
                      items: { type: 'object', properties: { date: { type: 'string', format: 'date' }, count: { type: 'integer' } } },
                    },
                    recent_logs: {
                      type: 'array',
                      description: '100 bản ghi nhật ký gần nhất',
                      items: { $ref: '#/components/schemas/AuditLogEntry' },
                    },
                  },
                },
              },
            },
          },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/reports/audit/archive': {
      post: {
        tags: ['Reports'],
        summary: 'Lưu trữ audit log cũ (Admin only)',
        description: `Quyền: **admin** only. Di chuyển log cũ hơn N tháng từ \`audit_logs\` sang \`audit_logs_archive\` bằng một transaction atomic (\`WITH moved AS (DELETE … RETURNING *) INSERT …\`).

Dữ liệu **không bị xóa** — vẫn truy xuất được từ bảng archive. Phù hợp chạy định kỳ (hàng quý hoặc hàng năm) để giữ bảng chính nhỏ gọn.`,
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'months', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 60, default: 12 }, description: 'Lưu trữ log cũ hơn N tháng' },
        ],
        responses: {
          200: {
            description: 'Kết quả lưu trữ',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    archived:       { type: 'integer', example: 5200, description: 'Số bản ghi đã chuyển sang archive' },
                    cutoff_months:  { type: 'integer', example: 12 },
                  },
                },
              },
            },
          },
          403: { description: 'Chỉ admin', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/reports/export': {
      get: {
        tags: ['Reports'],
        summary: 'Xuất báo cáo (XLSX / CSV)',
        description: `Quyền: **admin** hoặc **manager**. Stream file trực tiếp về client với \`Content-Disposition: attachment\`.

**Loại báo cáo (\`type\`):**
| type | Mô tả | XLSX | CSV |
|------|-------|:----:|:---:|
| \`records\` | Danh sách tài liệu (≤ 50k dòng) | ✅ | ✅ |
| \`summary\` | Tổng hợp 4 sheet: trạng thái / nền tảng / loại tài liệu / xu hướng | ✅ | ❌ |
| \`financial\` | Tổng hợp trường số theo loại tài liệu (approved only) | ✅ | ✅ |
| \`staff\` | Hiệu suất nhân viên | ✅ | ✅ |
| \`audit\` | Nhật ký hoạt động (≤ 100k dòng) | ✅ | ✅ |

**XLSX:** Header xanh #1F7A43, freeze row 1, auto-filter, alternating rows, date format \`dd/mm/yyyy hh:mm\`.
**CSV:** UTF-8 BOM (mở đúng tiếng Việt trên Excel Windows).`,
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'type',    in: 'query', required: true, schema: { type: 'string', enum: ['records','summary','financial','staff','audit'], default: 'records' }, description: 'Loại báo cáo' },
          { name: 'format',  in: 'query', schema: { type: 'string', enum: ['xlsx','csv'], default: 'xlsx' }, description: 'Định dạng file xuất' },
          { name: 'date_from',        in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-01' } },
          { name: 'date_to',          in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-30' } },
          { name: 'document_type_id', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Lọc theo loại tài liệu (records, financial, staff)' },
          { name: 'category_id',      in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Lọc theo danh mục (records, summary, financial)' },
          { name: 'platform',         in: 'query', schema: { type: 'string', enum: ['telegram','zalo','manual'] }, description: 'Lọc theo nền tảng (records, staff)' },
          { name: 'status',           in: 'query', schema: { type: 'string', enum: ['new','reviewed','approved','flagged'] }, description: 'Lọc theo trạng thái (chỉ type=records)' },
        ],
        responses: {
          200: {
            description: 'File XLSX hoặc CSV',
            headers: {
              'Content-Disposition': {
                schema: { type: 'string', example: 'attachment; filename="BBOTECH_records_2026-04-30.xlsx"' },
              },
              'Content-Type': {
                schema: { type: 'string', example: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
              },
            },
            content: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                schema: { type: 'string', format: 'binary' },
              },
              'text/csv': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          400: { description: 'type không hợp lệ', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════════
    // NOTIFICATIONS
    // ════════════════════════════════════════════════════════════════════════════

    '/api/notifications/summary': {
      get: {
        tags: ['Notifications'],
        summary: 'Lấy số lượng record mới chờ duyệt (badge số trên bell icon)',
        description: `Trả về \`pending\` = tổng số record có \`status = 'new'\`. Frontend gọi khi khởi động để khởi tạo badge, sau đó cập nhật realtime qua Socket.io event \`record_updated\`.

**Socket.io events** (kết nối với JWT trong \`auth.token\`):
- \`new_record\` — nhận khi có record mới: \`{ record: { id, sender_name, received_at, status }, count }\`
- \`record_updated\` — nhận khi record được cập nhật: \`{ record_id, new_status, pending }\``,
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Số lượng record pending',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    pending: { type: 'integer', example: 8, description: 'Số record status=new chưa xử lý' },
                  },
                },
              },
            },
          },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ════════════════════════════════════════════════════════════════════════════
    // SEARCH
    // ════════════════════════════════════════════════════════════════════════════

    '/api/search': {
      get: {
        tags: ['Search'],
        summary: 'Tìm kiếm toàn văn',
        description: `Tìm kiếm full-text trên \`note\`, \`ocr_text\`, \`sender_name\` dùng **PostgreSQL GIN index**.

- Từ khoá tự nhiên: \`q=hóa đơn tháng 4\` (không cần cú pháp tsquery)
- Kết hợp nhiều filter: keyword + date range + status + category
- Kết quả luôn ẩn bản ghi \`status=deleted\``,
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'q',           in: 'query', schema: { type: 'string' }, description: 'Từ khoá tìm kiếm — full-text trên note + ocr_text + sender_name', example: 'hóa đơn văn phòng phẩm' },
          { name: 'sender_name', in: 'query', schema: { type: 'string' }, description: 'Tên người gửi (ILIKE — không phân biệt hoa/thường)', example: 'Nguyễn' },
          { name: 'status',      in: 'query', schema: { type: 'string', enum: ['new', 'reviewed', 'approved', 'flagged'] } },
          { name: 'category_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'date_from',   in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-01' } },
          { name: 'date_to',     in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-30' } },
          { name: 'page',        in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit',       in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Kết quả tìm kiếm',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data:        { type: 'array', items: { $ref: '#/components/schemas/RecordSummary' } },
                    total:       { type: 'integer', example: 7 },
                    page:        { type: 'integer', example: 1 },
                    total_pages: { type: 'integer', example: 1 },
                    query:       { type: 'string', nullable: true, description: 'Từ khoá đã tìm', example: 'hóa đơn văn phòng phẩm' },
                  },
                },
              },
            },
          },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

  },
}

module.exports = spec
