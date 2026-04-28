import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/components.css'
import App from './App.jsx'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: true,          // Gửi IP + user context để debug dễ hơn
    tracesSampleRate: 1.0,         // 100% transactions — giảm xuống 0.1 khi production traffic lớn
    replaysOnErrorSampleRate: 1.0, // Ghi lại màn hình 100% khi có lỗi
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,   // Ẩn text nhạy cảm trong replay
        blockAllMedia: true,
      }),
    ],
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
