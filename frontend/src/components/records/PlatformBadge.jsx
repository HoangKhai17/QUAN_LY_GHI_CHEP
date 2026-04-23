const PLATFORM_MAP = {
  telegram: { label: 'TELEGRAM', cls: 'platform-tg' },
  zalo:     { label: 'ZALO',     cls: 'platform-zl' },
}

export default function PlatformBadge({ platform }) {
  const cfg = PLATFORM_MAP[platform] ?? {
    label: (platform ?? '—').toUpperCase(),
    cls: '',
  }
  return <span className={`platform-badge ${cfg.cls}`}>{cfg.label}</span>
}
