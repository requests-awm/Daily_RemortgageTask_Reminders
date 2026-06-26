import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { STAGES } from './offsets.js'
import { loadRun, sendCandidate } from './source.js'

// ---------------------------------------------------------------------------
// Single seam between the UI and the backend. `source.js` decides mock vs live
// (VITE_USE_MOCK). Live mode fetches /api/run from the backend service, which
// runs the SAME engine over real Asana + Insightly data. Sending is NOT wired:
// approving updates local state + audit only — no email leaves the building yet.
// ---------------------------------------------------------------------------

const SEED_AUDIT = [
  { id: 'h1', when: '2026-06-24 08:31', client: 'Daniel Pope', stage: '3 Months Before', email: 'd.pope@example.com', broker: 'Nwabisa Janda', outcome: 'sent' },
  { id: 'h2', when: '2026-06-24 08:31', client: 'Hannah Lewis', stage: '6 Months After', email: 'h.lewis@example.com', broker: 'Dextter Roberts', outcome: 'sent' },
  { id: 'h3', when: '2026-06-23 08:30', client: 'Yusuf Ali', stage: '1 Month Before', email: 'y.ali@example.com', broker: 'Nwabisa Janda', outcome: 'skipped', note: 'Client already remortgaged' },
]

const withStatus = (candidates) =>
  candidates.map((c) => ({
    ...c,
    status: c.stopped ? 'stopped' : 'pending', // pending | sent | skipped | stopped
    skipReason: null,
    sentAt: null,
  }))

const StoreCtx = createContext(null)

export function StoreProvider({ children }) {
  const [candidates, setCandidates] = useState([])
  const [audit, setAudit] = useState(SEED_AUDIT)
  const [runDate, setRunDate] = useState(new Date())
  const [mode, setMode] = useState('mock')
  const [sendMode, setSendMode] = useState('dry')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = (date) => {
    setLoading(true)
    setError(null)
    return loadRun(date)
      .then((run) => {
        setCandidates(withStatus(run.candidates))
        setRunDate(run.runDate)
        setMode(run.mode)
        setSendMode(run.sendMode || 'dry')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stamp = () => format(new Date(), 'yyyy-MM-dd HH:mm')

  const auditEntry = (c, outcome, note) => ({
    id: `a-${c.id}-${outcome}-${stamp()}`,
    when: stamp(),
    client: c.fullName,
    stage: c.stage.title,
    email: c.clientEmail,
    broker: c.broker?.name || '—',
    outcome,
    note,
  })

  // Async: hits the backend (live) or simulates (mock). Throws on failure so
  // the UI can surface it. Edits made via updateMessage are already in c.message.
  const sendReminder = async (id) => {
    const c = candidates.find((x) => x.id === id)
    if (!c) throw new Error('Reminder not found')
    const result = await sendCandidate(c)
    const note = result.dryRun
      ? 'DRY-RUN — not actually sent'
      : result.postError
        ? `email sent; Asana comment failed: ${result.postError}`
        : 'email sent + Asana comment posted'
    setCandidates((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: 'sent', sentAt: stamp() } : x))
    )
    setAudit((a) => [auditEntry(c, 'sent', note), ...a])
    return result
  }

  const skipReminder = (id, reason) => {
    const c = candidates.find((x) => x.id === id)
    if (!c) return
    setCandidates((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: 'skipped', skipReason: reason } : x))
    )
    setAudit((a) => [auditEntry(c, 'skipped', reason), ...a])
  }

  const updateMessage = (id, patch) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, message: { ...c.message, ...patch } } : c))
    )
  }

  const value = useMemo(() => {
    const pending = candidates.filter((c) => c.status === 'pending')
    const counts = {
      total: candidates.length,
      pending: pending.length,
      sent: candidates.filter((c) => c.status === 'sent').length,
      skipped: candidates.filter((c) => c.status === 'skipped').length,
      stopped: candidates.filter((c) => c.status === 'stopped').length,
      blocked: pending.filter((c) => c.blockers.length).length,
    }
    const byStage = STAGES.map((s) => ({
      stage: s,
      total: candidates.filter((c) => c.stageLabel === s.label).length,
      pending: candidates.filter((c) => c.stageLabel === s.label && c.status === 'pending').length,
    }))
    return {
      runDate,
      mode,
      sendMode,
      loading,
      error,
      candidates,
      counts,
      byStage,
      sendReminder,
      skipReminder,
      updateMessage,
      reload,
      getById: (id) => candidates.find((c) => c.id === id) || null,
      audit,
    }
  }, [candidates, audit, runDate, mode, sendMode, loading, error])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
