// Notify a human when a run holds reminders that need attention, so blocked
// items (no email / no broker / stop-flag) don't sit unnoticed in the queue.
// Opt-in: set NOTIFY_EMAIL in server/.env. This is an INTERNAL ops email — it
// is not a client send, so it's independent of the client-recipient guards.
import { sendEmail } from './mailer.mjs'

const notifyEmail = () => (process.env.NOTIFY_EMAIL || '').trim()
// Reminders blocked by a missing broker or client email are escalated here so
// someone can complete the details. Defaults to lithakazi; override with FALLBACK_EMAIL.
const fallbackEmail = () => (process.env.FALLBACK_EMAIL || 'lithakazi.mququ@ascotwm.com').trim()
const appUrl = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')

function mailFrom() {
  return {
    fromName: process.env.MAIL_FROM_NAME || 'Remortgage Reminders',
    fromAddress: process.env.MAIL_FROM_ADDRESS || '',
    replyTo: process.env.MAIL_REPLY_TO || '',
  }
}

export async function notifyHeld(result) {
  const to = notifyEmail()
  const held = (result.candidates || []).filter((c) => c.autoStatus === 'held')

  if (!to) return { sent: false, reason: 'NOTIFY_EMAIL not set' }
  if (held.length === 0) return { sent: false, reason: 'nothing held' }

  const rows = held
    .map((c) => `<li><strong>${c.fullName}</strong> — ${c.stage.title} — <em>${c.holdReason || 'needs review'}</em></li>`)
    .join('')
  const html = `
    <p>The remortgage reminder run on <strong>${result.runDate}</strong> auto-sent
      <strong>${result.autoSent || 0}</strong> reminder(s) and <strong>held ${held.length}</strong>
      that need attention before they can send:</p>
    <ul>${rows}</ul>
    <p>Open the queue to resolve them: <a href="${appUrl()}/review">${appUrl()}/review</a></p>
    <p style="color:#666;font-size:12px">Common reasons: no client email in Insightly, no broker appointed,
      or the stop-automation flag is set on the task.</p>`

  try {
    await sendEmail({
      ...mailFrom(),
      to: [to],
      cc: [],
      bcc: [],
      subject: `⚠️ ${held.length} remortgage reminder${held.length > 1 ? 's' : ''} need attention — ${result.runDate}`,
      html,
    })
    return { sent: true, to, count: held.length }
  } catch (e) {
    return { sent: false, error: e.message }
  }
}

// Escalate reminders blocked by a MISSING BROKER or CLIENT EMAIL to the fallback
// handler (lithakazi by default), with the draft email so they can complete it.
export async function notifyFallback(result) {
  const to = fallbackEmail()
  const blocked = (result.candidates || []).filter(
    (c) => c.autoStatus === 'held' && /broker|email/i.test(c.holdReason || '')
  )
  if (!to) return { sent: false, reason: 'FALLBACK_EMAIL not set' }
  if (blocked.length === 0) return { sent: false, reason: 'none blocked by broker/email' }

  const rows = blocked
    .map((c) => `<li><strong>${c.fullName}</strong> — ${c.stage.title} — missing: <em>${c.holdReason}</em>
      <div style="color:#555;font-size:12px">Draft subject: ${c.message?.subject || '(n/a)'}</div></li>`)
    .join('')
  const html = `
    <p><strong>${blocked.length}</strong> remortgage reminder(s) on <strong>${result.runDate}</strong> could not be
      sent because the <strong>broker or client email is missing</strong>. Please appoint the broker / add the
      Insightly email so they can go out:</p>
    <ul>${rows}</ul>
    <p>Resolve them here: <a href="${appUrl()}/review">${appUrl()}/review</a></p>`

  try {
    await sendEmail({
      ...mailFrom(),
      to: [to],
      cc: [],
      bcc: [],
      subject: `Action needed: ${blocked.length} remortgage reminder(s) missing broker/email — ${result.runDate}`,
      html,
    })
    return { sent: true, to, count: blocked.length }
  } catch (e) {
    return { sent: false, error: e.message }
  }
}
