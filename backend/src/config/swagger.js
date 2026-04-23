/**
 * OpenAPI 3.0 spec — tài liệu API cho QUAN LY GHI CHEP.
 *
 * Cập nhật file này khi thêm endpoint mới.
 * Không dùng swagger-jsdoc để tránh annotations rải rác trong router files.
 */

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Quản Lý Ghi Chép — API',
    version: '2.0.0',
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
    { name: 'Records',       description: 'Ghi chép nhận từ các nền tảng (Telegram, Zalo...)' },
    { name: 'DocumentTypes', description: 'Loại tài liệu động và định nghĩa trường' },
    { name: 'Categories',    description: 'Danh mục phân loại ghi chép' },
    { name: 'Dashboard',     description: 'Thống kê tổng quan' },
    { name: 'Reports',       description: 'Báo cáo tổng hợp theo loại tài liệu, ngày, kênh' },
    { name: 'Search',        description: 'Tìm kiếm toàn văn (full-text search)' },
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
        description: 'Mặc định ẩn bản ghi đã xoá (`status=deleted`). Truyền `status=deleted` để xem.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'status', in: 'query',
            schema: { type: 'string', enum: ['new', 'reviewed', 'approved', 'flagged', 'deleted'] },
            description: 'Lọc theo trạng thái. Mặc định: ẩn deleted.',
          },
          {
            name: 'platform', in: 'query',
            schema: { type: 'string', enum: ['telegram', 'zalo', 'discord'] },
            description: 'Lọc theo nền tảng',
          },
          { name: 'sender_id',   in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'UUID của user gửi' },
          { name: 'category_id', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'UUID của danh mục' },
          { name: 'document_type_id', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Lọc theo loại tài liệu' },
          { name: 'extraction_status', in: 'query', schema: { type: 'string', enum: ['pending','done','needs_review','failed'] }, description: 'Lọc theo trạng thái trích xuất AI' },
          { name: 'date_from',   in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-01' }, description: 'Từ ngày (received_at >=)' },
          { name: 'date_to',     in: 'query', schema: { type: 'string', format: 'date', example: '2026-04-30' }, description: 'Đến ngày (received_at <=, inclusive)' },
          { name: 'page',        in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit',       in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: { description: 'Danh sách ghi chép', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedRecords' } } } },
          400: { description: 'status không hợp lệ', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
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
        description: 'Trả về tất cả loại tài liệu đang active. Truyền `include_inactive=true` để lấy cả loại đã ẩn.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'include_inactive', in: 'query', schema: { type: 'string', enum: ['true','false'] }, description: 'Lấy cả loại không active' },
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
    },

    '/api/document-types/{id}/fields': {
      get: {
        tags: ['DocumentTypes'],
        summary: 'Chỉ lấy danh sách trường của loại tài liệu',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'Danh sách trường',
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
