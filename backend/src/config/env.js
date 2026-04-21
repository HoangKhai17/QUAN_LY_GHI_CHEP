require('dotenv').config()

const required = [
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
  'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET',
]

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  zalo: {
    oaToken: process.env.ZALO_OA_TOKEN || '',
    webhookSecret: process.env.ZALO_WEBHOOK_SECRET || '',
  },

  storage: {
    cloudinaryUrl: process.env.CLOUDINARY_URL || '',
    signedUrlExpires: parseInt(process.env.SIGNED_URL_EXPIRES) || 3600,
  },

  ocr: {
    googleKeyFile: process.env.GOOGLE_VISION_KEY_FILE || '',
  },

  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
}
