# QUAN LY GHI CHEP — Frontend

React 19 + Vite 8, kết nối với Backend Node.js/Express qua REST API + Socket.io.

---

## Mục lục

- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Chạy local (development)](#chạy-local-development)
- [Deploy lên VPS Linux (production)](#deploy-lên-vps-linux-production)
  - [1. Chuẩn bị VPS](#1-chuẩn-bị-vps)
  - [2. Cài PostgreSQL](#2-cài-postgresql)
  - [3. Cài Node.js](#3-cài-nodejs)
  - [4. Clone & cấu hình Backend](#4-clone--cấu-hình-backend)
  - [5. Chạy Backend với PM2](#5-chạy-backend-với-pm2)
  - [6. Build Frontend](#6-build-frontend)
  - [7. Cài Nginx & cấu hình reverse proxy](#7-cài-nginx--cấu-hình-reverse-proxy)
  - [8. SSL miễn phí với Let's Encrypt](#8-ssl-miễn-phí-với-lets-encrypt)
  - [9. Cấu hình Webhook Telegram / Zalo](#9-cấu-hình-webhook-telegram--zalo)
  - [10. Backup tự động](#10-backup-tự-động)
- [Biến môi trường](#biến-môi-trường)
- [Cấu trúc thư mục trên VPS](#cấu-trúc-thư-mục-trên-vps)

---

## Yêu cầu hệ thống

### Local
| Công cụ | Phiên bản tối thiểu |
|---------|---------------------|
| Node.js | 20 LTS |
| npm | 10+ |

### VPS Linux (production)
| Công cụ | Phiên bản khuyến nghị |
|---------|----------------------|
| Ubuntu | 22.04 LTS hoặc 24.04 LTS |
| Node.js | 20 LTS |
| PostgreSQL | 15+ |
| Nginx | 1.24+ |
| PM2 | 5+ |
| RAM | Tối thiểu 1 GB (khuyến nghị 2 GB+) |
| Disk | Tối thiểu 10 GB |

---

## Chạy local (development)

```bash
# Cài dependencies
npm install

# Khởi động dev server (hot reload, port 5173)
npm run dev
```

Frontend sẽ proxy API calls đến `http://localhost:3000` (cấu hình trong `vite.config.js`).

---

## Deploy lên VPS Linux (production)

Kiến trúc: **Frontend (Nginx tĩnh) + Backend (Node/PM2) + PostgreSQL** — cùng 1 VPS.

```
Internet → Nginx :80/:443
              ├── / → serve /dist (React build tĩnh)
              └── /api → proxy → Node.js :3000
                   └── /socket.io → proxy → Node.js :3000
```

---

### 1. Chuẩn bị VPS

```bash
# Đăng nhập vào VPS
ssh root@<your-vps-ip>

# Cập nhật hệ thống
apt update && apt upgrade -y

# Cài các công cụ cơ bản
apt install -y curl git build-essential ufw

# Cấu hình firewall
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

---

### 2. Cài PostgreSQL

```bash
apt install -y postgresql postgresql-contrib

# Khởi động PostgreSQL
systemctl enable --now postgresql

# Tạo database và user
sudo -u postgres psql <<'SQL'
CREATE USER bbotech WITH PASSWORD 'your_strong_password';
CREATE DATABASE quan_ly_ghi_chep OWNER bbotech;
GRANT ALL PRIVILEGES ON DATABASE quan_ly_ghi_chep TO bbotech;
SQL
```

---

### 3. Cài Node.js

```bash
# Cài Node.js 20 LTS qua NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Kiểm tra
node -v   # v20.x.x
npm -v    # 10.x.x

# Cài PM2 (process manager)
npm install -g pm2
```

---

### 4. Clone & cấu hình Backend

```bash
# Tạo thư mục app
mkdir -p /var/www/bbotech
cd /var/www/bbotech

# Clone repository (hoặc upload code bằng scp/rsync)
git clone <your-repo-url> .
# Hoặc dùng scp từ máy local:
# scp -r /path/to/project root@<vps-ip>:/var/www/bbotech

# Cài dependencies Backend
cd /var/www/bbotech/backend
npm install --production

# Tạo file .env từ mẫu
cp .env.example .env
nano .env
```

**Chỉnh sửa `.env` cho production** (xem phần [Biến môi trường](#biến-môi-trường) bên dưới).

```bash
# Chạy migration database
npm run migrate

# (Tuỳ chọn) Tạo tài khoản admin đầu tiên
npm run create-admin -- --password "Admin@2026!"
```

---

### 5. Chạy Backend với PM2

```bash
cd /var/www/bbotech/backend

# Khởi động app
pm2 start src/app.js --name bbotech-api --env production

# Tự khởi động khi VPS reboot
pm2 startup systemd
# Chạy lệnh mà PM2 in ra (bắt đầu bằng "sudo env PATH=...")
pm2 save

# Xem log
pm2 logs bbotech-api
pm2 status
```

---

### 6. Build Frontend

```bash
cd /var/www/bbotech/frontend

# Cài dependencies
npm install

# Tạo file .env.production
cat > .env.production <<'EOF'
VITE_API_BASE_URL=https://your-domain.com
EOF

# Build tĩnh
npm run build
# Output: /var/www/bbotech/frontend/dist/
```

> **Lưu ý:** Mỗi khi có thay đổi code frontend, chạy lại `npm run build` và nginx sẽ tự phục vụ file mới.

---

### 7. Cài Nginx & cấu hình reverse proxy

```bash
apt install -y nginx

# Tạo cấu hình site
nano /etc/nginx/sites-available/bbotech
```

Dán nội dung sau (thay `your-domain.com`):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Frontend — serve React build
    root /var/www/bbotech/frontend/dist;
    index index.html;

    # SPA fallback (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Socket.io (realtime notifications)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Swagger UI
    location /api-docs {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Giới hạn upload ảnh (đồng bộ với multer backend)
    client_max_body_size 35M;
}
```

```bash
# Kích hoạt site
ln -s /etc/nginx/sites-available/bbotech /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Kiểm tra cú pháp
nginx -t

# Reload
systemctl reload nginx
systemctl enable nginx
```

---

### 8. SSL miễn phí với Let's Encrypt

```bash
apt install -y certbot python3-certbot-nginx

# Xin chứng chỉ (domain phải trỏ về IP VPS trước)
certbot --nginx -d your-domain.com -d www.your-domain.com

# Certbot tự cập nhật nginx config và thêm HTTPS redirect
# Kiểm tra tự gia hạn
certbot renew --dry-run
```

Sau khi cài SSL, cập nhật `.env` backend:
```
FRONTEND_URL=https://your-domain.com
```
Rồi restart: `pm2 restart bbotech-api`

---

### 9. Cấu hình Webhook Telegram / Zalo

Webhook yêu cầu server có HTTPS public (sau bước 8).

```bash
# Cập nhật .env backend
WEBHOOK_BASE_URL=https://your-domain.com

# Restart backend
pm2 restart bbotech-api
```

Sau đó vào **Settings → Telegram Bot** trên Dashboard để nhập bot token và đăng ký webhook.

---

### 10. Backup tự động

Backend đã có cronjob backup tích hợp. Kiểm tra hoặc bật thêm cron hệ thống:

```bash
# Backup hàng ngày lúc 3 giờ sáng qua API nội bộ (ví dụ)
crontab -e
```

Thêm dòng:
```
0 3 * * * curl -s -X POST http://127.0.0.1:3000/api/backup \
  -H "Authorization: Bearer <admin_token>" >> /var/log/bbotech-backup.log 2>&1
```

File backup lưu tại thư mục `backend/backups/` (cấu hình trong `.env`).

---

## Biến môi trường

Sao chép `backend/.env.example` thành `backend/.env` và điền đầy đủ:

| Biến | Bắt buộc | Mô tả |
|------|:--------:|-------|
| `PORT` | ✅ | Port backend (mặc định: `3000`) |
| `NODE_ENV` | ✅ | `production` khi deploy |
| `FRONTEND_URL` | ✅ | URL frontend đầy đủ, dùng cho CORS (`https://your-domain.com`) |
| `DB_HOST` | ✅ | Host PostgreSQL (thường `localhost`) |
| `DB_PORT` | ✅ | Port PostgreSQL (mặc định: `5432`) |
| `DB_NAME` | ✅ | Tên database |
| `DB_USER` | ✅ | User PostgreSQL |
| `DB_PASSWORD` | ✅ | Password PostgreSQL |
| `JWT_ACCESS_SECRET` | ✅ | Chuỗi random ≥32 ký tự |
| `JWT_REFRESH_SECRET` | ✅ | Chuỗi random ≥32 ký tự (khác ACCESS_SECRET) |
| `JWT_ACCESS_EXPIRES` | | `15m` (mặc định) |
| `JWT_REFRESH_EXPIRES` | | `7d` (mặc định) |
| `SETTINGS_ENCRYPTION_KEY` | ✅ | 64 hex chars — tạo bằng: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CLOUDINARY_URL` | Nếu lưu ảnh | `cloudinary://key:secret@cloud_name` |
| `GEMINI_API_KEY` | Nếu dùng AI | Key từ aistudio.google.com |
| `TELEGRAM_BOT_TOKEN` | Nếu dùng Telegram | Token từ BotFather |
| `WEBHOOK_BASE_URL` | Nếu dùng webhook | Domain HTTPS public (không có `/` cuối) |
| `SENTRY_DSN` | Không | Monitoring lỗi |

---

## Cấu trúc thư mục trên VPS

```
/var/www/bbotech/
├── backend/
│   ├── src/
│   ├── backups/          # File backup .sql.gz
│   ├── .env              # Cấu hình production
│   └── package.json
└── frontend/
    ├── src/
    ├── dist/             # React build tĩnh (Nginx serve từ đây)
    └── package.json
```

---

## Lệnh thường dùng khi vận hành

```bash
# Xem status backend
pm2 status

# Xem log realtime
pm2 logs bbotech-api --lines 50

# Restart backend (sau khi thay đổi code backend)
cd /var/www/bbotech/backend
git pull
npm install --production
pm2 restart bbotech-api

# Deploy lại frontend (sau khi thay đổi code frontend)
cd /var/www/bbotech/frontend
git pull
npm install
npm run build
# Nginx tự phục vụ /dist mới — không cần restart Nginx

# Kiểm tra Nginx
nginx -t && systemctl reload nginx

# Xem log Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```
