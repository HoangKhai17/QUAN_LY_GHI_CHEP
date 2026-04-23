const STATUS_MAP = {
  new:      { label: 'Mới',         cls: 'badge-new'      },
  reviewed: { label: 'Đang rà',     cls: 'badge-review'   },
  approved: { label: 'Đã duyệt',    cls: 'badge-approved' },
  flagged:  { label: 'Flagged',     cls: 'badge-flagged'  },
  deleted:  { label: 'Đã xóa',      cls: 'badge-deleted'  },
}

export default function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] ?? { label: status, cls: '' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}
