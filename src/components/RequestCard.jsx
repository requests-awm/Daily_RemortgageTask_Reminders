import { useRef, useState } from 'react'
import { ChevronDown, Check, X, ExternalLink, Calendar, MoreVertical } from 'lucide-react'

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
//   menu      : [{ key, label, icon, onClick, danger }] — kebab (⋮) actions
//   onClick
export default function RequestCard({ icon, flag, highlight, pills = [], chips = [], title, subtitle, date, dateLabel, lines = [], stamp, hoverPreview, menu, onClick }) {
  const cardRef = useRef(null)
  const timer = useRef(null)
  const [pop, setPop] = useState(false) // centered preview visible?
  const [menuOpen, setMenuOpen] = useState(false)

  // Open on intentional hover; keep open while the cursor is on card OR panel.
  // Suppressed while the kebab menu is open so the two don't fight.
  const openSoon = () => {
    if (!hoverPreview || menuOpen) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPop(true), 140)
  }
  const closeSoon = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPop(false), 160)
  }
  const keepOpen = () => clearTimeout(timer.current)

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
        onMouseEnter={openSoon}
        onMouseLeave={closeSoon}
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
          {menu && menu.length > 0 ? (
            <div className="req-menu-wrap">
              <button
                className="req-chev"
                title="Actions"
                onClick={(e) => { e.stopPropagation(); setPop(false); clearTimeout(timer.current); setMenuOpen((o) => !o) }}
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <>
                  <div className="req-menu-backdrop" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
                  <div className="req-menu" onClick={(e) => e.stopPropagation()}>
                    {menu.map((m) => (
                      <button key={m.key} className={`req-menu-item${m.danger ? ' danger' : ''}`} onClick={(e) => { e.stopPropagation(); setMenuOpen(false); m.onClick() }}>
                        {m.icon}{m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            onClick && <button className="req-chev" onClick={(e) => { e.stopPropagation(); onClick() }}><ChevronDown size={18} /></button>
          )}
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
        <>
          <div className="email-hover-backdrop" />
          <div className="email-hover-pop" onMouseEnter={keepOpen} onMouseLeave={closeSoon}>
            {hoverPreview}
          </div>
        </>
      )}
    </>
  )
}
