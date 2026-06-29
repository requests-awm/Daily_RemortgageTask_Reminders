import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Search, ExternalLink, AlertTriangle, Mail, Clock, Check, SkipForward, ShieldOff, User, LayoutList, Table2 } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import { RunBanner, LoadingState } from '../components/RunBanner.jsx'
import StageBadge from '../components/StageBadge.jsx'
import SheetTable from '../components/SheetTable.jsx'
import RequestCard from '../components/RequestCard.jsx'
import EmailHover from '../components/EmailHover.jsx'
import { STAGES } from '../data/offsets.js'
import { useStore } from '../data/store.jsx'

const STATUS_PILL = {
  pending: { label: 'Awaiting', variant: 'amber', icon: <Clock size={12} /> },
  sent: { label: 'Sent', variant: 'green', icon: <Check size={12} /> },
  skipped: { label: 'Skipped', variant: 'slate', icon: <SkipForward size={12} /> },
  stopped: { label: 'Stopped', variant: 'red', icon: <ShieldOff size={12} /> },
}

const TABS = [
  { key: 'pending', label: 'Awaiting review' },
  { key: 'sent', label: 'Sent' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'stopped', label: 'Stopped' },
]

const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s.label, i]))
const fmt = (d) => {
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy') } catch { return '' }
}
const AsanaLink = (r) => (
  <a href={r.asanaLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
    Open task <ExternalLink size={12} style={{ verticalAlign: '-1px' }} />
  </a>
)

export default function ReviewQueue() {
  const { candidates, counts, loading, runDate } = useStore()
  const [tab, setTab] = useState('pending')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [view, setView] = useState('cards')
  const nav = useNavigate()
  const nextDate = fmt(runDate)

  const cardProps = (c) => {
    const stamp =
      c.status === 'sent' ? `Sent ${c.sentAt || ''}`.trim()
        : c.status === 'skipped' ? (c.skipReason || 'Skipped')
        : c.status === 'stopped' ? 'Automation stopped'
        : `Next: ${nextDate}`
    return {
      icon: <Mail size={18} />,
      flag: c.status === 'pending' && c.blockers.length > 0,
      highlight: c.testColor || undefined,
      pills: [
        c.isTest && { key: 'test', label: 'TEST', color: c.testColor },
        { key: 'st', ...STATUS_PILL[c.status] },
        c.leadDay && { key: 'lead', label: 'Sends tomorrow', variant: 'amber', icon: <Clock size={12} /> },
        { key: 'stage', label: c.stage.title, color: c.stage.color },
        { key: 'dir', label: c.stage.dir === 'before' ? 'Pre-expiry' : 'On SVR', variant: 'outline' },
      ].filter(Boolean),
      chips: [
        { key: 'asana', label: 'Asana', ok: true, href: c.asanaLink },
        { key: 'ins', label: c.clientEmail ? 'Insightly' : 'No email', ok: !!c.clientEmail },
      ],
      title: c.fullName,
      subtitle: c.taskName,
      date: fmt(c.confirmedDate),
      dateLabel: 'Confirmed remortgage date',
      lines: [
        { key: 'broker', icon: <User size={13} />, text: c.broker ? c.broker.name : 'No broker', muted: !c.broker },
        { key: 'email', icon: <Mail size={13} />, text: c.clientEmail || 'No email on file', muted: true },
      ],
      stamp,
      hoverPreview: <EmailHover subject={c.message.subject} bodyHtml={c.message.bodyHtml} to={c.clientEmail} cc={c.broker?.email} />,
      onClick: () => nav(`/review/${c.id}`),
    }
  }

  // Column sets per tab. Common columns first, then status-specific.
  const columns = useMemo(() => {
    const nameCol = {
      key: 'name', label: 'Task Name', className: 'gs-name',
      render: (r) => (<><span className="gs-dot" style={{ background: r.stage.color }} title={r.stage.title} />{r.taskName}</>),
      sortValue: (r) => r.fullName.toLowerCase(),
    }
    const stageCol = {
      key: 'stage', label: 'Stage',
      render: (r) => <StageBadge stage={r.stage} />,
      sortValue: (r) => STAGE_ORDER[r.stageLabel],
    }
    const idCol = { key: 'id', label: 'Task ID', className: 'gs-id', render: (r) => r.asanaGid, sortValue: (r) => r.asanaGid }
    const confCol = { key: 'conf', label: 'Confirmed Remortgage Date', className: 'gs-date', render: (r) => fmt(r.confirmedDate), sortValue: (r) => r.confirmedDate }
    const linkCol = { key: 'link', label: 'ASANA Link', className: 'gs-link', sortable: false, render: AsanaLink }

    if (tab === 'pending') {
      return [
        nameCol, stageCol, idCol,
        { key: 'next', label: 'Next Remortgage Date', className: 'gs-date', sortable: false, render: () => nextDate },
        confCol,
        {
          key: 'flag', label: 'Status',
          render: (r) => r.blockers.length
            ? <span className="pill pill-red"><AlertTriangle size={12} />{r.blockers.length} blocker{r.blockers.length > 1 ? 's' : ''}</span>
            : <span className="pill pill-green">Ready</span>,
          sortValue: (r) => -r.blockers.length,
        },
        linkCol,
      ]
    }
    if (tab === 'sent') {
      return [nameCol, stageCol, idCol, confCol,
        { key: 'sent', label: 'Sent At', className: 'gs-date', render: (r) => r.sentAt || '—', sortValue: (r) => r.sentAt || '' }, linkCol]
    }
    if (tab === 'skipped') {
      return [nameCol, stageCol, idCol, confCol,
        { key: 'reason', label: 'Skip Reason', render: (r) => r.skipReason || '—', sortValue: (r) => r.skipReason || '' }, linkCol]
    }
    return [nameCol, stageCol, idCol, confCol,
      { key: 'stopv', label: 'Stop Flag', render: (r) => String(r.stopValue ?? '—'), sortValue: (r) => String(r.stopValue ?? '') }, linkCol]
  }, [tab, nextDate])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = candidates.filter((c) => c.status === tab)
    if (q) {
      out = out.filter((c) =>
        [c.fullName, c.taskName, c.clientEmail, c.insightlyId, c.asanaGid]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
      )
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey)
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const av = col.sortValue(a), bv = col.sortValue(b)
          const cmp = av < bv ? -1 : av > bv ? 1 : 0
          return sortDir === 'asc' ? cmp : -cmp
        })
      }
    }
    return out
  }, [candidates, tab, query, sortKey, sortDir, columns])

  const onSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <>
      <Topbar crumb="Workflow" title="Review Queue" />
      <div className="content">
        <div className="content-narrow">
          <div className="page-title">Review Queue</div>
          <div className="page-sub">Approve, edit or skip each reminder before it sends.</div>

          <div style={{ marginBottom: 18 }}><RunBanner /></div>
          {loading && <LoadingState />}

          {!loading && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    className={`btn ${tab === t.key ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => { setTab(t.key); setSortKey(null) }}
                  >
                    {t.label} ({counts[t.key]})
                  </button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} color="var(--muted-2)" style={{ position: 'absolute', left: 10, top: 9 }} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name, task, email…"
                      style={{ padding: '7px 11px 7px 30px', border: '1px solid var(--line-strong)', borderRadius: 'var(--r-sm)', fontFamily: 'inherit', fontSize: 13, width: 230 }}
                    />
                  </div>
                  <div className="viewseg">
                    <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}><LayoutList size={14} /> Cards</button>
                    <button className={view === 'sheet' ? 'on' : ''} onClick={() => setView('sheet')}><Table2 size={14} /> Sheet</button>
                  </div>
                </div>
              </div>

              {rows.length === 0 ? (
                <div className="card card-pad empty">
                  <Mail size={26} color="var(--muted-2)" />
                  <div className="big">Nothing here</div>
                  <div>{query ? 'No matches for your search.' : 'No reminders with this status for this run.'}</div>
                </div>
              ) : (
                <>
                  <div className="gsheet-toolbar">
                    {rows.length} {TABS.find((t) => t.key === tab).label.toLowerCase()} · click to open the review
                  </div>
                  {view === 'cards' ? (
                    <div className="card-group">{rows.map((c) => <RequestCard key={c.id} {...cardProps(c)} />)}</div>
                  ) : (
                    <SheetTable
                      columns={columns}
                      rows={rows}
                      onRowClick={(id) => nav(`/review/${id}`)}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={onSort}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
