/**
 * Bootstrap Admin — tạo tài khoản admin đầu tiên.
 *
 * Dùng: node src/db/seeds/create_admin.js
 *
 * Đọc từ env hoặc prompt nếu không truyền arg:
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=xxx node src/db/seeds/create_admin.js
 *   hoặc:
 *   node src/db/seeds/create_admin.js --username admin --name "Quản trị viên" --password ChangeMe@2026
 *
 * must_change_pw=true: admin phải đổi mật khẩu khi login lần đầu.
 */

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

// ── Parse CLI args ─────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function getArg(name) {
  const i = args.indexOf(`--${name}`)
  return i !== -1 ? args[i + 1] : undefined
}

const username = getArg('username') || process.env.ADMIN_USERNAME || 'admin'
const name     = getArg('name')     || process.env.ADMIN_NAME     || 'Quản trị viên'
const password = getArg('password') || process.env.ADMIN_PASSWORD

if (!password) {
  console.error('❌  Password is required.')
  console.error('    Usage: node src/db/seeds/create_admin.js --password <password>')
  console.error('    Or set ADMIN_PASSWORD env var.')
  process.exit(1)
}

if (password.length < 8) {
  console.error('❌  Password must be at least 8 characters.')
  process.exit(1)
}

// ── DB connection ──────────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

async function run() {
  const client = await pool.connect()
  try {
    const rounds = process.env.NODE_ENV === 'production' ? 12 : 10
    const hash = await bcrypt.hash(password, rounds)

    const { rows } = await client.query(
      `INSERT INTO users (platform, username, password_hash, name, role, must_change_pw, is_active)
       VALUES ('web', $1, $2, $3, 'admin', TRUE, TRUE)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = 'admin',
             is_active = TRUE,
             must_change_pw = TRUE,
             updated_at = NOW()
       RETURNING id, username, name, role`,
      [username.toLowerCase(), hash, name]
    )

    console.log('✅  Admin account ready:')
    console.log(`    ID:       ${rows[0].id}`)
    console.log(`    Username: ${rows[0].username}`)
    console.log(`    Name:     ${rows[0].name}`)
    console.log(`    Role:     ${rows[0].role}`)
    console.log('    ⚠️  must_change_pw=true — đổi mật khẩu khi login lần đầu')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error('❌  Error:', err.message)
  process.exit(1)
})
