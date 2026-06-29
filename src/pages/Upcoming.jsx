import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Search, CalendarClock, CalendarCheck, User, ShieldOff, RefreshCw } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import { RunBanner, LoadingState } from '../components/RunBanner.jsx'
import RequestCard from '../components/RequestCard.jsx'
import EmailHover from '../components/EmailHover.jsx'
import { loadUpcoming } from '../data/source.js'
import { buildMessage } from '../data/emailTemplates.js'

const fmt = (d) => { try { return format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy') } catch { return '—' } }
const WINDOWS = [30, 60, 90]

export default function Upcoming() {
  const [days, setDays] = useState(60)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  const refresh = (d = days) => {
    setLoading(true); setError(null)
    loadUpcoming(d).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { refresh(days) /* eslint-disable-next-line */ }, [days])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data.items
    return data.items.filter((i) =>
      [i.fullName, i.taskName, i.insightlyId, i.brokerName].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    )
  }, [data, query])

  const card = (i) => {
    const due = i.daysUntil === 0
      ? { key: 'd', label: 'Today', variant: 'red' }
      : { key: 'd', label: `In ${i.daysUntil} day${i.daysUntil > 1 ? 's' : ''}`, variant: i.daysUntil <= 7 ? 'amber' : 'slate' }
    // Build the same email the run will generate, so the hover shows the real draft.
    const msg = buildMessage(i.stage.template, {
      firstName: (i.fullName || '').split(' ')[0] || i.fullName,
      dealEndDate: i.dealEndDate,
      asanaLink: i.asanaLink,
    })
    return {
      icon: <CalendarClock size={18} />,
      flag: i.stopped,
      pills: [
        due,
        { key: 'stage', label: i.stage.title, color: i.stage.color },
        ...(i.stopped ? [{ key: 'stop', label: 'Stopped', variant: 'red', icon: <ShieldOff size={12} /> }] : []),
      ],
      chips: [
        { key: 'asana', label: 'Asana', ok: true, href: i.asanaLink },
        { key: 'ins', label: i.insightlyId ? 'Insightly' : 'No Insightly ID', ok: !!i.insightlyId },
      ],
      title: i.fullName,
      subtitle: i.taskName,
      date: fmt(i.triggerDate),
      dateLabel: 'Reminder sends',
      lines: [
        { key: 'deal', icon: <CalendarCheck size={13} />, text: `Deal ends ${fmt(i.confirmedDate)}`, muted: true },
        { key: 'broker', icon: <User size={13} />, text: i.brokerName || 'No broker', muted: !i.brokerName },
      ],
      hoverPreview: <EmailHover subject={msg.subject} bodyHtml={msg.bodyHtml} to={null} cc={i.brokerName} />,
      onClick: () => window.open(i.asanaLink, '_blank'),
    }
  }

  return (
    <>
      <Topbar crumb="Workflow" title="Upcoming Reminders" />
      <div className="content">
        <div className="content-narrow">
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div>
              <div className="page-title">Upcoming Reminders</div>
              <div className="page-sub">Who's due to be contacted in the next {days} days, across all six stages — forward visibility the daily queue can't give.</div>
            </div>
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => refresh()} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>

          <div style={{ marginBottom: 16 }}><RunBanner /></div>

          {error && (
            <div className="callout red"><div className="body"><strong>Couldn't load upcoming reminders.</strong> {error} — make sure <code>npm run server</code> is running.</div></div>
          )}

          {loading ? (
            <LoadingState label="Computing upcoming reminders…" />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
                <div className="viewseg">
                  {WINDOWS.map((w) => (
                    <button key={w} className={days === w ? 'on' : ''} onClick={() => setDays(w)}>Next {w}d</button>
                  ))}
                </div>
                <div className="gsheet-toolbar" style={{ margin: 0 }}>{rows.length} reminder{rows.length === 1 ? '' : 's'} scheduled</div>
                <div style={{ marginLeft: 'auto', position: 'relative' }}>
                  <Search size={14} color="var(--muted-2)" style={{ position: 'absolute', left: 10, top: 9 }} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, task, broker…"
                    style={{ padding: '7px 11px 7px 30px', border: '1px solid var(--line-strong)', borderRadius: 'var(--r-sm)', fontFamily: 'inherit', fontSize: 13, width: 240 }}
                  />
                </div>
              </div>

              {rows.length === 0 ? (
                <div className="card card-pad empty">
                  <CalendarClock size={26} color="var(--muted-2)" />
                  <div className="big">No reminders due in the next {days} days</div>
                  <div>{query ? 'No matches for your search.' : 'Nothing scheduled in this window.'}</div>
                </div>
              ) : (
                <div className="card-group">{rows.map((i) => <RequestCard key={i.id} {...card(i)} />)}</div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
