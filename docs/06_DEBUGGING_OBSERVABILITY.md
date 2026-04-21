# 🔍 DEBUGGING & OBSERVABILITY — T&D COMPANY
> Phiên bản: 1.0 | Cập nhật: 2026-04-20

---

## 🏗️ OBSERVABILITY STACK TỔNG QUAN

```
┌─────────────────────────────────────────────────────────────────┐
│                   OBSERVABILITY PYRAMID                          │
│                                                                  │
│              ▲  📊 METRICS                                       │
│             ▲▲▲   Prometheus + Grafana                          │
│            ▲▲▲▲▲  (Performance, resource usage)                 │
│                                                                  │
│           ▲▲▲▲▲▲▲  🔍 TRACING                                   │
│          ▲▲▲▲▲▲▲▲▲  OpenTelemetry                               │
│         ▲▲▲▲▲▲▲▲▲▲▲ (Request flow end-to-end)                  │
│                                                                  │
│        ▲▲▲▲▲▲▲▲▲▲▲▲▲  📋 LOGS                                   │
│       ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲  Structlog + Loki + Grafana              │
│      ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ (Structured, searchable)               │
│                                                                  │
│     ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲  🚨 ERROR TRACKING                     │
│    ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲  Sentry                               │
│   ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ (Real-time alerts)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ TOOLSET THEO MÔI TRƯỜNG

### A. Backend (Python / FastAPI)

#### 1. 📋 Structured Logging — `structlog`

```python
# config/logging.py
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.dev.ConsoleRenderer()   # Dev: đẹp, dễ đọc
        # structlog.processors.JSONRenderer()  # Prod: JSON cho Loki/ELK
    ]
)

logger = structlog.get_logger()

# Dùng trong code
logger.info("record.created",
    record_id=record.id,
    sender=sender_name,
    has_image=bool(image_url),
    ocr_status=ocr_status
)
# Output: 2026-04-20T09:30:00Z [info] record.created record_id=abc sender=NguyenA has_image=True
```

#### 2. 🚨 Error Tracking — Sentry

```python
# main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    environment=settings.ENV,          # "development" / "production"
    traces_sample_rate=0.1,            # 10% requests cho performance tracing
    integrations=[FastApiIntegration()],
    before_send=scrub_sensitive_data,  # Xóa token/password trước khi gửi
)

# Custom context cho mỗi request
def scrub_sensitive_data(event, hint):
    if "request" in event:
        event["request"].pop("headers", None)  # Không log auth headers
    return event
```

#### 3. 🔬 Local Debugging

```
Công cụ           Dùng khi nào
──────────────    ─────────────────────────────────────
ipdb              Debug breakpoint trong code Python
                  → import ipdb; ipdb.set_trace()

FastAPI /docs     Test API endpoint trực tiếp (Swagger UI)
                  → http://localhost:8000/docs

pytest -s -v      Chạy test với output chi tiết
pytest --pdb      Tự nhảy vào debugger khi test fail

httpx / curl      Test webhook Zalo manually
ngrok             Expose localhost để Zalo gọi vào webhook
```

---

### B. Frontend (React)

#### 1. 🔍 React DevTools

```
Cài extension Chrome: "React Developer Tools"
├─ Inspect component tree
├─ Xem props / state realtime
└─ Profiler: đo hiệu suất render
```

#### 2. 🌐 Network Debugging

```
Browser DevTools → Network tab
├─ Xem mọi API call (request/response)
├─ Filter: XHR / Fetch
├─ Copy as cURL → paste vào terminal để reproduce
└─ Throttle network: mô phỏng mạng chậm (3G)
```

#### 3. 🚨 Sentry cho Frontend

```javascript
// src/main.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,       // Ẩn text nhạy cảm trong replay
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,  // 100% session khi có lỗi
});
```

---

### C. Zalo Webhook Debugging

```
Thách thức: Zalo chỉ gọi được server có IP public

Giải pháp dev:
┌──────────────────────────────────────────────┐
│  ngrok http 8000                              │
│  → Tạo URL public: https://abc.ngrok.io      │
│  → Cấu hình URL này trong Zalo OA Dashboard  │
│                                              │
│  Theo dõi requests tại:                      │
│  http://localhost:4040 (ngrok inspector)     │
│  → Xem full request/response                 │
│  → Replay lại request (rất tiện debug)       │
└──────────────────────────────────────────────┘
```

---

## 📊 LOGGING STRATEGY

### Log Levels & Khi nào dùng

```
LEVEL       KHI NÀO DÙNG                           VÍ DỤ
──────────  ─────────────────────────────────────  ──────────────────────────
DEBUG       Chi tiết nội bộ (chỉ dev)              SQL query parameters
INFO        Sự kiện bình thường quan trọng         Record created, User login
WARNING     Bất thường nhưng hệ thống vẫn chạy    OCR failed, retry 2/3
ERROR       Lỗi cần xử lý ngay                    Zalo API timeout, DB conn fail
CRITICAL    Hệ thống sắp sập                      Disk full, DB unreachable
```

### Structured Log Format

```json
{
  "timestamp": "2026-04-20T09:30:00.123Z",
  "level": "info",
  "event": "record.created",
  "service": "backend-api",
  "environment": "production",
  "trace_id": "abc123",
  "record_id": "uuid-xxx",
  "sender_zalo_id": "zalo_123",
  "has_image": true,
  "ocr_status": "success",
  "processing_ms": 245
}
```

### Log Pipeline

```
Python App (structlog)
      │
      ▼
stdout/stderr (JSON)
      │
      ▼ Docker log driver
Promtail (log collector)
      │
      ▼
Loki (log storage & index)
      │
      ▼
Grafana (query & visualize)
      │
      ├─ Dashboard: Error rate theo giờ
      ├─ Alert: Error > 10/phút → Slack/Email
      └─ Search: tìm trace_id cụ thể
```

---

## 📈 METRICS & ALERTS

### Key Metrics cần theo dõi

```
BUSINESS METRICS
├─ 📨 Records nhận được / giờ
├─ ⏱️  Thời gian xử lý trung bình (webhook → DB)
├─ 🤖 Tỷ lệ OCR thành công/thất bại
└─ 📊 Số báo cáo xuất / ngày

TECHNICAL METRICS
├─ 🔴 Error rate (%) theo endpoint
├─ ⏱️  API Response time (p50, p95, p99)
├─ 💾 Database: connection pool usage, slow queries
└─ 💿 Storage: disk usage, S3 requests/cost
```

### Alert Rules (Grafana)

| Alert | Threshold | Action |
|-------|-----------|--------|
| Error rate cao | > 5% trong 5 phút | Slack + Email |
| API chậm | p95 > 2 giây | Slack |
| OCR fail liên tục | > 10 lần liên tiếp | Slack + PagerDuty |
| Disk sắp đầy | > 80% | Email |
| DB kết nối fail | Bất kỳ lần nào | PagerDuty (urgent) |

---

## 🧪 TESTING STRATEGY

```
┌─────────────────────────────────────────────────────────┐
│                  TEST PYRAMID                            │
│                                                          │
│              ▲  E2E Tests (Playwright)                   │
│             ▲▲▲  Số ít, chậm, test flow hoàn chỉnh     │
│                                                          │
│            ▲▲▲▲▲  Integration Tests (pytest)            │
│           ▲▲▲▲▲▲▲  Test API endpoint + DB thật          │
│                                                          │
│          ▲▲▲▲▲▲▲▲▲  Unit Tests (pytest)                 │
│         ▲▲▲▲▲▲▲▲▲▲▲  Nhiều, nhanh, test từng function  │
└─────────────────────────────────────────────────────────┘
```

### Môi trường

```
Local Dev    → pytest + ipdb + ngrok + FastAPI /docs
Staging      → Sentry (dev env) + Grafana + test data Zalo
Production   → Sentry (prod) + Grafana alerts + Real Zalo OA
```

---

## 🗂️ ENV CONFIGURATION

```bash
# .env.example (commit lên git)
APP_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/tnd_db
ZALO_OA_TOKEN=
ZALO_SECRET=
AWS_S3_BUCKET=
SENTRY_DSN=
OCR_API_KEY=

# .env (KHÔNG commit — thêm vào .gitignore)
# Chứa giá trị thật
```

---

## ⚡ QUICK DEBUG COMMANDS

```bash
# Xem log realtime (Docker)
docker compose logs -f backend --tail=100

# Xem slow queries PostgreSQL
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

# Test webhook Zalo locally
curl -X POST http://localhost:8000/webhook/zalo \
  -H "Content-Type: application/json" \
  -H "X-Zalo-Signature: <computed_sig>" \
  -d '{"event_name":"user_send_image","sender":{"id":"123"}}'

# Kiểm tra Sentry hoạt động
python -c "import sentry_sdk; sentry_sdk.capture_message('test')"
```
