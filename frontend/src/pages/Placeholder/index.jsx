export default function PlaceholderPage({ title, icon, phase }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', gap: 16, textAlign: 'center',
    }}>
      <div style={{ fontSize: 56 }}>{icon}</div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0d1f2d' }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 14, color: '#6b7680', maxWidth: 380, lineHeight: 1.6 }}>
        Tính năng này đang được phát triển và sẽ có mặt ở <strong>{phase}</strong>.
        <br />Phần login flow đã hoạt động end-to-end.
      </p>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#f5f7f4', border: '1px solid #dde1e6', borderRadius: 8,
        padding: '8px 16px', fontSize: 12, color: '#6b7680', fontFamily: 'monospace',
      }}>
        🚧 Coming in {phase}
      </div>
    </div>
  )
}
