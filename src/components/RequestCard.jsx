import { useRef, useState } from 'react'
import { ChevronDown, Check, X, ExternalLink, Calendar } from 'lucide-react'

// Card-feed item modelled on the task-booker request list.
// props:
//   icon      : node (left square)
//   flag      : bool (red left edge)
//   pills     : [{ key, label, variant: green|amber|red|slate|outline, color?, icon? }]
//   chips     : [{ key, label, ok, href }]
//   title, subtitle
//   date      : string shown with a calendar icon (top of the right column)
//   dateLabel : small caption above the date (e.g. "Confirmed remortgage date")
//   lines     : [{ key, icon, text, muted }]
//   stamp     : string (small coloured timestamp)
//   highlight : color string — paints a coloured left edge + tint (e.g. test cards)
//   hoverPreview : node shown in a floating panel while hovering the card
//   onClick
export default function RequestCard({ icon, flag, highlight, pills = [], chips = [], title, subtitle, date, dateLabel, lines = [], stamp, hoverPreview, onClick }) {
  const cardRef = useRef(null)
  const [pop, setPop] = useState(null) // { top, left, maxH }

  const showPreview = () => {
    if (!hoverPreview || !cardRef.current) return
    const r = cardRef.current.getBoundingClientRect()
    const W = 430, gap = 12
    // Prefer the right of the card; fall back to the left if there's no room.
    const left = window.innerWidth - r.right > W + gap + 8 ? r.right + gap : Math.max(8, r.left - W - gap)
    const top = Math.max(8, Math.min(r.top, window.innerHeight - 16 - 320))
    setPop({ top, left, maxH: window.innerHeight - top - 16 })
  }
  const hidePreview = () => setPop(null)

  const hlStyle = highlight
    ? { borderColor: highlight, background: `color-mix(in srgb, ${highlight} 6%, white)` }
    : undefined

  return (
    <>
      <div
        ref={cardRef}
        className={`req-card${flag ? ' flag' : ''}${highlight ? ' hl' : ''}`}
        style={hlStyle}
        onClick={onClick}
        onMouseEnter={showPreview}
        onMouseLeave={hidePreview}
      >
        {highlight && <span className="req-edge" style={{ background: highlight }} />}
        <div className="req-icon" style={highlight ? { background: `color-mix(in srgb, ${highlight} 16%, white)`, color: highlight } : undefined}>{icon}</div>

        <div className="req-main">
          <div className="req-pills">
            {pills.map((p) => (
              <span
                key={p.key}
                className={`rpill ${p.color ? '' : `rpill-${p.variant || 'outline'}`}`}
                style={p.color ? { background: `color-mix(in srgb, ${p.color} 14%, white)`, color: p.color } : undefined}
              >
                {p.icon}
                {p.label}
              </span>
            ))}
            {chips.map((c) =>
              c.href ? (
                <a key={c.key} className={`chip${c.ok === false ? ' bad' : ''}`} href={c.href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  {c.ok === false ? <X size={12} /> : <Check size={12} />}{c.label}<ExternalLink size={11} />
                </a>
              ) : (
                <span key={c.key} className={`chip${c.ok === false ? ' bad' : ''}`}>
                  {c.ok === false ? <X size={12} /> : <Check size={12} />}{c.label}
                </span>
              )
            )}
          </div>

          <div className="req-title">{title}</div>
          {subtitle && <div className="req-sub">{subtitle}</div>}
        </div>

        <div className="req-right">
          {onClick && <button className="req-chev" onClick={(e) => { e.stopPropagation(); onClick() }}><ChevronDown size={18} /></button>}
          <div className="req-meta">
            {date && (
              <div className="req-dateblock">
                {dateLabel && <div className="req-cap">{dateLabel}</div>}
                <div className="req-line"><Calendar size={13} />{date}</div>
              </div>
            )}
            {lines.map((l) => (
              <div key={l.key} className={`req-line${l.muted ? ' muted' : ''}`}>{l.icon}{l.text}</div>
            ))}
            {stamp && <div className="req-stamp">{stamp}</div>}
          </div>
        </div>
      </div>

      {pop && hoverPreview && (
        <div className="email-hover-pop" style={{ top: pop.top, left: pop.left, maxHeight: pop.maxH }}>
          {hoverPreview}
        </div>
      )}
    </>
  )
}
