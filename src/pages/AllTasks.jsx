import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Search, ExternalLink, RefreshCw, ClipboardList, Check, ShieldOff, User, Hash, LayoutList, Table2 } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import { LoadingState } from '../components/RunBanner.jsx'
import SheetTable from '../components/SheetTable.jsx'
import RequestCard from '../components/RequestCard.jsx'
import { loadTasks } from '../data/source.js'

const fmt = (d) => {
  if (!d) return '—'
  try { return format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy') } catch { return '—' }
}

export default function AllTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [view, setView] = useState('cards')

  const cardProps = (t) => ({
    icon: <ClipboardList size={18} />,
    flag: t.stopped,
    pills: [
      t.stopped
        ? { key: 'st', label: 'Stopped', variant: 'red', icon: <ShieldOff size={12} /> }
        : { key: 'st', label: 'Active', variant: 'green', icon: <Check size={12} /> },
      ...(t.confirmedDate ? [] : [{ key: 'nd', label: 'No date', variant: 'outline' }]),
    ],
    chips: [
      { key: 'asana', label: 'Asana', ok: true, href: t.asanaLink },
      { key: 'ins', label: t.insightlyId ? 'Insightly' : 'No Insightly ID', ok: !!t.insightlyId },
    ],
    title: t.fullName,
    subtitle: t.taskName,
    date: fmt(t.confirmedDate),
    dateLabel: 'Confirmed remortgage date',
    lines: [
      { key: 'broker', icon: <User size={13} />, text: t.brokerName || 'No broker', muted: !t.brokerName },
      ...(t.insightlyId ? [{ key: 'ins', icon: <Hash size={13} />, text: t.insightlyId, muted: true }] : []),
    ],
    onClick: () => window.open(t.asanaLink, '_blank'),
  })

  const refresh = () => {
    setLoading(true)
    setError(null)
    loadTasks()
      .then((r) => setTasks(r.tasks))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [])

  const columns = useMemo(() => [
    {
      key: 'name', label: 'Task Name', className: 'gs-name',
      render: (r) => (<>{r.stopped && <span className="gs-dot" style={{ background: 'var(--red)' }} title="Stop-automation set" />}{r.taskName}</>),
      sortValue: (r) => r.fullName.toLowerCase(),
    },
    { key: 'id', label: 'Task ID', className: 'gs-id', render: (r) => r.gid, sortValue: (r) => r.gid },
    { key: 'conf', label: 'Confirmed Remortgage Date', className: 'gs-date', render: (r) => fmt(r.confirmedDate), sortValue: (r) => r.confirmedDate || '' },
    { key: 'broker', label: 'Broker', render: (r) => r.brokerName || '—', sortValue: (r) => (r.brokerName || '').toLowerCase() },
    { key: 'ins', label: 'Insightly ID', className: 'gs-id', render: (r) => r.insightlyId || '—', sortValue: (r) => r.insightlyId || '' },
    {
      key: 'stop', label: 'Stop',
      render: (r) => (r.stopped ? <span className="pill pill-red">Yes</span> : <span style={{ color: 'var(--muted-2)' }}>—</span>),
      sortValue: (r) => (r.stopped ? 0 : 1),
    },
    {
      key: 'link', label: 'ASANA Link', className: 'gs-link', sortable: false,
      render: (r) => (<a href={r.asanaLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open task <ExternalLink size={12} style={{ verticalAlign: '-1px' }} /></a>),
    },
  ], [])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = tasks
    if (q) {
      out = out.filter((t) =>
        [t.fullName, t.taskName, t.insightlyId, t.gid, t.brokerName]
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
  }, [tasks, query, sortKey, sortDir, columns])

  const onSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <>
      <Topbar crumb="Workflow" title="All Tasks" />
      <div className="content">
        <div className="content-narrow">
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div>
              <div className="page-title">All Tasks</div>
              <div className="page-sub">Every task in <strong>ANa. PL - SUPP - Mortgage Team DYNAMIC</strong>, matched or not.</div>
            </div>
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={refresh} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>

          {error && (
            <div className="callout red"><div className="body"><strong>Couldn't load tasks.</strong> {error} — make sure <code>npm run server</code> is running.</div></div>
          )}

          {loading ? (
            <LoadingState label="Loading project tasks…" />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
                <div className="gsheet-toolbar" style={{ margin: 0 }}>{rows.length} of {tasks.length} tasks</div>
                <div style={{ marginLeft: 'auto', position: 'relative' }}>
                  <Search size={14} color="var(--muted-2)" style={{ position: 'absolute', left: 10, top: 9 }} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, task, Insightly ID…"
                    style={{ padding: '7px 11px 7px 30px', border: '1px solid var(--line-strong)', borderRadius: 'var(--r-sm)', fontFamily: 'inherit', fontSize: 13, width: 250 }}
                  />
                </div>
                <div className="viewseg">
                  <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}><LayoutList size={14} /> Cards</button>
                  <button className={view === 'sheet' ? 'on' : ''} onClick={() => setView('sheet')}><Table2 size={14} /> Sheet</button>
                </div>
              </div>
              {view === 'cards' ? (
                <div className="card-group">{rows.map((t) => <RequestCard key={t.id} {...cardProps(t)} />)}</div>
              ) : (
                <SheetTable
                  columns={columns}
                  rows={rows}
                  onRowClick={(id) => { const t = rows.find((r) => r.id === id); if (t) window.open(t.asanaLink, '_blank') }}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
