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
    version: '1.0.0',
    description: `
**Hệ thống quản lý ghi chép nội bộ doanh nghiệp.**

Nhận ảnh chứng từ từ Telegram → AI trích xuất nội dung → Manager duyệt qua Dashboard.

### Auth flow
1. Bootstrap admin: \`node src/db/seeds/create_admin.js --password <pw>\`
2. \`POST /api/auth/login\` → nhận \`access_token\` + \`refresh_token\`
3. Click **Authorize** → nhập \`Bearer <access_token>\`
4. Gọi các API cần auth

### Token model
- **access_token**: JWT, hết hạn sau 15 phút
- **refresh_token**: opaque, hết hạn sau 7 ngày, rotation mỗi lần dùng
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
    },
  },

  // ── Tags ────────────────────────────────────────────────────────────────────
  tags: [
    {
      name: 'Auth',
      description: 'Đăng nhập, refresh token, logout, đổi mật khẩu',
    },
    {
      name: 'Users',
      description: 'Quản lý tài khoản nội bộ — chỉ admin/manager',
    },
  ],

  // ── Paths ───────────────────────────────────────────────────────────────────
  paths: {

    // ── /api/auth/login ──────────────────────────────────────────────────────
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập',
        description: 'Public. Không cần token.',
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

    // ── /api/auth/refresh ────────────────────────────────────────────────────
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Làm mới access token',
        description: 'Public. Gửi refresh_token → nhận cặp token mới. Token cũ bị revoke ngay (rotation).',
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
          200: {
            description: 'Token mới',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenPair' } } },
          },
          401: { description: 'Token không hợp lệ / đã revoke / hết hạn', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          403: { description: 'Tài khoản bị vô hiệu hoá', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── /api/auth/logout ─────────────────────────────────────────────────────
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng xuất',
        description: 'Cần Bearer token. Revoke refresh_token hiện tại.',
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

    // ── /api/auth/logout-all ─────────────────────────────────────────────────
    '/api/auth/logout-all': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng xuất tất cả thiết bị',
        description: 'Cần Bearer token. Revoke toàn bộ refresh_token của user đang đăng nhập.',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Đã kick tất cả sessions', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
          401: { description: 'Không có / sai access token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── /api/auth/me ─────────────────────────────────────────────────────────
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Xem thông tin user đang đăng nhập',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Thông tin user',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UserPublic' } } },
          },
          401: { description: 'Chưa đăng nhập', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── /api/auth/change-password ────────────────────────────────────────────
    '/api/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Đổi mật khẩu',
        description: 'Cần Bearer token. Sau khi đổi thành công, tất cả refresh_token bị revoke (buộc login lại trên thiết bị khác).',
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
          400: { description: 'Thiếu field / mật khẩu mới < 8 ký tự / trùng với mật khẩu cũ', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { description: 'Mật khẩu hiện tại sai', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── /api/users ───────────────────────────────────────────────────────────
    '/api/users': {
      post: {
        tags: ['Users'],
        summary: 'Tạo user nội bộ',
        description: 'Cần Bearer token. Quyền: **admin** hoặc **manager** (manager không tạo được admin). Nếu không truyền `password`, hệ thống tự sinh mật khẩu tạm và trả về trong `temp_password` (chỉ hiện 1 lần).',
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
                  password: { type: 'string', minLength: 8, description: 'Nếu bỏ trống, hệ thống tự sinh', nullable: true },
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
                        temp_password: {
                          type: 'string',
                          description: 'Chỉ có khi không truyền password — hiện 1 lần duy nhất',
                          example: 'X7mK!p2QnR4v',
                          nullable: true,
                        },
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
        description: 'Cần Bearer token. Quyền: **admin** hoặc **manager**.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['admin', 'manager', 'staff'] }, description: 'Lọc theo role' },
          { name: 'is_active', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Lọc theo trạng thái' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Danh sách users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data:  { type: 'array', items: { $ref: '#/components/schemas/UserPublic' } },
                    total: { type: 'integer', example: 5 },
                    page:  { type: 'integer', example: 1 },
                  },
                },
              },
            },
          },
          403: { description: 'Không đủ quyền', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── /api/users/:id ───────────────────────────────────────────────────────
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Xem chi tiết user',
        description: 'Cần Bearer token. Admin/manager xem được mọi user. Staff chỉ xem được chính mình.',
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

    // ── /api/users/:id/activate ──────────────────────────────────────────────
    '/api/users/{id}/activate': {
      patch: {
        tags: ['Users'],
        summary: 'Kích hoạt / vô hiệu hoá user',
        description: 'Cần Bearer token. Quyền: **admin only**. Khi deactivate: toàn bộ session bị revoke ngay.',
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

    // ── /api/users/:id/reset-password ────────────────────────────────────────
    '/api/users/{id}/reset-password': {
      post: {
        tags: ['Users'],
        summary: 'Reset mật khẩu user',
        description: 'Cần Bearer token. Quyền: **admin only**. Sinh mật khẩu tạm, buộc user đổi khi login lại. Tất cả session bị revoke.',
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
                    temp_password: { type: 'string', description: 'Hiện 1 lần — thông báo cho user', example: 'X7mK!p2QnR4v' },
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

    // ── /api/users/:id/role ──────────────────────────────────────────────────
    '/api/users/{id}/role': {
      patch: {
        tags: ['Users'],
        summary: 'Đổi role user',
        description: 'Cần Bearer token. Quyền: **admin only**. Không thể tự đổi role của chính mình.',
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

  },
}

module.exports = spec
