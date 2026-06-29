import { format, parseISO } from 'date-fns'
import { evaluateTasks, summarizeTask, computeUpcoming } from './reminderEngine.js'
import { MOCK_TASKS, MOCK_CONTACTS, RUN_DATE } from './mockTasks.js'
import { USE_MOCK, API_BASE_URL } from '../config/env.js'

// The one place that decides mock vs live. Returns { runDate: Date, candidates, mode }.
export async function loadRun(date) {
  if (USE_MOCK) {
    // Mirror the backend auto-send-clean policy as a dry simulation so mock mode
    // previews the hybrid: clean reminders -> Sent, blocked ones -> Awaiting.
    const stamp = format(new Date(), 'yyyy-MM-dd HH:mm')
    const candidates = evaluateTasks(MOCK_TASKS, RUN_DATE, MOCK_CONTACTS).map((c) =>
      c.blockers.length === 0 ? { ...c, autoStatus: 'sent', dryRun: true, sentAt: stamp } : c
    )
    return { mode: 'mock', sendMode: 'dry', autoSend: 'clean', runDate: RUN_DATE, candidates }
  }

  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  const res = await fetch(`${API_BASE_URL}/api/run${qs}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Backend responded ${res.status}`)
  }
  const data = await res.json()
  return {
    mode: 'live',
    sendMode: data.sendMode || 'dry',
    autoSend: data.autoSend || 'clean',
    runDate: data.runDate ? parseISO(data.runDate) : new Date(),
    candidates: data.candidates || [],
  }
}

// Forward calendar of reminders due within `days` for the Upcoming view.
export async function loadUpcoming(days = 60) {
  if (USE_MOCK) {
    const items = computeUpcoming(MOCK_TASKS, RUN_DATE, days)
    return { mode: 'mock', from: format(RUN_DATE, 'yyyy-MM-dd'), days, total: items.length, items }
  }
  const res = await fetch(`${API_BASE_URL}/api/upcoming?days=${days}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Backend responded ${res.status}`)
  }
  return res.json()
}

// Scheduler status (next/last run) for the Overview.
export async function loadSchedule() {
  if (USE_MOCK) {
    return { cron: '30 8 * * *', timezone: 'Europe/London', weekends: true, runTime: '08:30', nextRun: 'Daily 08:30 (mock)', lastRun: null }
  }
  const res = await fetch(`${API_BASE_URL}/api/schedule`)
  if (!res.ok) throw new Error(`Backend responded ${res.status}`)
  return res.json()
}

// Force an immediate run (the "Run now" button). Mock: no-op.
export async function triggerRun() {
  if (USE_MOCK) return { ok: true, mock: true }
  const res = await fetch(`${API_BASE_URL}/api/run/now`, { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Run failed (${res.status})`)
  return data
}

// Every task in the project (matched or not) for the All Tasks view.
export async function loadTasks() {
  if (USE_MOCK) {
    const tasks = MOCK_TASKS.map(summarizeTask).sort((a, b) => a.fullName.localeCompare(b.fullName))
    return { mode: 'mock', total: tasks.length, tasks }
  }
  const res = await fetch(`${API_BASE_URL}/api/tasks`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Backend responded ${res.status}`)
  }
  const data = await res.json()
  return { mode: 'live', total: data.total, tasks: data.tasks || [] }
}

// Send (or dry-run) one reminder. In mock mode it's always simulated.
export async function sendCandidate(candidate) {
  if (USE_MOCK) {
    return { ok: true, dryRun: true, simulated: true, plan: { to: [candidate.clientEmail] } }
  }
  const res = await fetch(`${API_BASE_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: candidate.id,
      subject: candidate.message.subject,
      bodyHtml: candidate.message.bodyHtml,
      comment: candidate.message.comment,
      override: candidate.stopped,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Send failed (${res.status})`)
  return data
}

export { format }
