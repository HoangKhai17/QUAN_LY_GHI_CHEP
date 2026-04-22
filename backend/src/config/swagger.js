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
          id:              { type: 'string', format: 'uuid' },
          platform:        { type: 'string', enum: ['telegram', 'zalo', 'discord'], example: 'telegram' },
          sender_id:       { type: 'string', format: 'uuid', nullable: true },
          sender_name:     { type: 'string', example: 'Nguyễn Văn A' },
          image_url:       { type: 'string', format: 'uri', nullable: true, example: 'https://res.cloudinary.com/...' },
          image_thumbnail: { type: 'string', format: 'uri', nullable: true },
          ocr_text:        { type: 'string', nullable: true, example: 'Hóa đơn số 001 ngày 22/04/2026...' },
          note:            { type: 'string', nullable: true },
          status:          { type: 'string', enum: ['new', 'reviewed', 'approved', 'flagged', 'deleted'], example: 'new' },
          flag_reason:     { type: 'string', nullable: true },
          category_id:     { type: 'string', format: 'uuid', nullable: true },
          category_name:   { type: 'string', nullable: true, example: 'Hóa đơn' },
          category_color:  { type: 'string', nullable: true, example: '#1890ff' },
          ocr_status:      { type: 'string', enum: ['pending', 'done', 'failed'], nullable: true },
          ocr_confidence:  { type: 'number', nullable: true, example: 0.9 },
          received_at:     { type: 'string', format: 'date-time' },
          created_at:      { type: 'string', format: 'date-time' },
          updated_at:      { type: 'string', format: 'date-time' },
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
    },
  },

  // ── Tags ─────────────────────────────────────────────────────────────────────
  tags: [
    { name: 'Auth',       description: 'Đăng nhập, refresh token, logout, đổi mật khẩu' },
    { name: 'Users',      description: 'Quản lý tài khoản nội bộ — admin/manager' },
    { name: 'Records',    description: 'Ghi chép nhận từ các nền tảng (Telegram, Zalo...)' },
    { name: 'Categories', description: 'Danh mục phân loại ghi chép' },
    { name: 'Dashboard',  description: 'Thống kê tổng quan' },
    { name: 'Search',     description: 'Tìm kiếm toàn văn (full-text search)' },
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
                description: 'Truyền ít nhất 1 trong 2 field',
                properties: {
                  note:        { type: 'string', nullable: true, example: 'Hóa đơn mua văn phòng phẩm tháng 4' },
                  category_id: { type: 'string', format: 'uuid', nullable: true, example: 'a1b2c3d4-0000-0000-0000-000000000001' },
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
