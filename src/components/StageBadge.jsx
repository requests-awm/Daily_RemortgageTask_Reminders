export default function StageBadge({ stage, size }) {
  if (!stage) return null
  return (
    <span
      className="pill"
      style={{
        background: 'color-mix(in srgb, ' + stage.color + ' 12%, white)',
        color: stage.color,
        borderColor: 'color-mix(in srgb, ' + stage.color + ' 30%, white)',
        fontSize: size === 'lg' ? '12.5px' : undefined,
      }}
    >
      <span className="swatch" style={{ background: stage.color }} />
      {stage.title}
    </span>
  )
}

export function StatusPill({ status }) {
  const map = {
    pending: ['pill-amber', 'Awaiting review'],
    sent: ['pill-green', 'Sent'],
    skipped: ['pill-slate', 'Skipped'],
    stopped: ['pill-red', 'Stopped'],
    deleted: ['pill-slate', 'Deleted'],
  }
  const [cls, label] = map[status] || ['pill-slate', status]
  return <span className={`pill ${cls}`}>{label}</span>
}
