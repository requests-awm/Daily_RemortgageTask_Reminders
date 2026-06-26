import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { CalendarClock, ArrowRight, AlertTriangle, ShieldOff, Clock, Play } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import { RunBanner, LoadingState } from '../components/RunBanner.jsx'
import { useStore } from '../data/store.jsx'
import { loadSchedule, triggerRun } from '../data/source.js'

export default function Overview() {
  const { runDate, counts, byStage, loading, mode, reload } = useStore()
  const nav = useNavigate()
  const maxStage = Math.max(1, ...byStage.map((s) => s.total))
  const [schedule, setSchedule] = useState(null)
  const [running, setRunning] = useState(false)

  const refreshSchedule = () => loadSchedule().then(setSchedule).catch(() => {})
  useEffect(() => { refreshSchedule() }, [])

  const runNow = async () => {
    setRunning(true)
    try { await triggerRun(); await reload(); await refreshSchedule() }
    finally { setRunning(false) }
  }

  if (loading) {
    return (
      <>
        <Topbar title="Overview" />
        <div className="content"><div className="content-narrow">
          <div style={{ marginBottom: 18 }}><RunBanner /></div>
          <LoadingState />
        </div></div>
      </>
    )
  }

  return (
    <>
      <Topbar title="Overview" />
      <div className="content">
        <div className="content-narrow">
          <div style={{ marginBottom: 18 }}><RunBanner /></div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div className="page-title">Today's remortgage run</div>
              <div className="page-sub" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CalendarClock size={15} /> {format(runDate, 'EEEE, d MMMM yyyy')}
                {schedule && <> · scheduled {schedule.runTime} {schedule.timezone}{schedule.weekends ? '' : ' (weekdays)'}</>}
              </div>
              {schedule && (
                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> Next run: <strong style={{ color: 'var(--ink-soft)' }}>{schedule.nextRun}</strong></span>
                  <span>Last run: <strong style={{ color: 'var(--ink-soft)' }}>{schedule.lastRun ? `${schedule.lastRun.ranAt.slice(0, 16).replace('T', ' ')} · ${schedule.lastRun.matched} matched (${schedule.lastRun.source})` : 'not yet today'}</strong></span>
                </div>
              )}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {mode === 'live' && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)' }}>
                    Run for
                    <input
                      type="date"
                      defaultValue={format(runDate, 'yyyy-MM-dd')}
                      onChange={(e) => e.target.value && reload(e.target.value)}
                      style={{ padding: '7px 9px', border: '1px solid var(--line-strong)', borderRadius: 'var(--r-sm)', fontFamily: 'inherit', fontSize: 13 }}
                    />
                  </label>
                  <button className="btn btn-outline" onClick={runNow} disabled={running}>
                    <Play size={15} className={running ? 'spin' : ''} /> {running ? 'Running…' : 'Run now'}
                  </button>
                </>
              )}
              <button className="btn btn-primary btn-lg" onClick={() => nav('/review')} disabled={!counts.pending}>
                Start review <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat">
              <div className="label">Awaiting review</div>
              <div className="num">{counts.pending}</div>
              <div className="sub">clients matched a reminder stage</div>
            </div>
            <div className="stat">
              <div className="label">Sent today</div>
              <div className="num" style={{ color: 'var(--green)' }}>{counts.sent}</div>
              <div className="sub">emails + Asana comments</div>
            </div>
            <div className="stat">
              <div className="label">Skipped</div>
              <div className="num">{counts.skipped}</div>
              <div className="sub">held back by reviewer</div>
            </div>
            <div className="stat">
              <div className="label">Automation stopped</div>
              <div className="num" style={{ color: counts.stopped ? 'var(--red)' : undefined }}>{counts.stopped}</div>
              <div className="sub">stop-flag set on task</div>
            </div>
          </div>

          {counts.blocked > 0 && (
            <div className="callout cream" style={{ marginBottom: 18 }}>
              <AlertTriangle className="ico" size={18} color="var(--amber)" />
              <div className="body">
                <div className="title">{counts.blocked} reminder{counts.blocked > 1 ? 's' : ''} need attention before sending</div>
                Missing client email or no broker appointed. These are held in the queue and won't send until resolved — the kind of silent gap the Zap used to skip without telling anyone.
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-pad" style={{ paddingBottom: 6 }}>
              <div className="card-head">Breakdown by stage</div>
            </div>
            {byStage.map(({ stage, total, pending }) => (
              <div className="stage-row" key={stage.label}>
                <span className="pill" style={{ minWidth: 132, background: 'color-mix(in srgb,' + stage.color + ' 12%,white)', color: stage.color, borderColor: 'color-mix(in srgb,' + stage.color + ' 30%,white)' }}>
                  <span className="swatch" style={{ background: stage.color }} /> {stage.title}
                </span>
                <div className="bar-wrap">
                  <div className="bar" style={{ width: `${(total / maxStage) * 100}%`, background: stage.color }} />
                </div>
                <span className="count">{total}</span>
                <span style={{ width: 92, fontSize: 12, color: 'var(--muted)' }}>
                  {pending ? `${pending} to review` : total ? 'all handled' : '—'}
                </span>
              </div>
            ))}
          </div>

          <div className="callout blue">
            <ShieldOff className="ico" size={18} color="var(--blue)" />
            <div className="body">
              <strong>Why this replaces the Zap:</strong> matching, broker mapping and templating run the same logic, but nothing leaves the building until a person approves it here. Every send and skip is written to the Audit Log instead of a Google Sheet.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
