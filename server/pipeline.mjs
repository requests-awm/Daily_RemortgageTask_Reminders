// The daily run, server-side. Pulls Asana tasks, matches offsets via the SAME
// engine the frontend mock uses, then resolves client emails from Insightly
// only for the matched tasks. Read-only: nothing is sent.
import { format } from 'date-fns'
import { evaluateTasks, extractContactRefs, summarizeTask, computeUpcoming } from '../src/data/reminderEngine.js'
import { fetchAllTasks, fetchTask, postComment } from './asana.mjs'
import { fetchContactsByIds, fetchContactEmail } from './insightly.mjs'
import { sendEmail } from './mailer.mjs'
import { isTestContact, TEST_CONTACT_IDS } from '../src/data/testContacts.js'

export function sendMode() {
  return (process.env.SEND_MODE || 'dry').toLowerCase() === 'live' ? 'live' : 'dry'
}

// Default-on safety net: only the allowlisted test contacts may be emailed.
// Set TEST_RECIPIENTS_ONLY=false in server/.env to send to real clients.
export function testRecipientsOnly() {
  return (process.env.TEST_RECIPIENTS_ONLY ?? 'true').toLowerCase() !== 'false'
}

export async function runPipeline(runDate = new Date()) {
  const tasks = await fetchAllTasks()

  // Pass 1: match offsets with no contacts, to learn which Insightly ids we need.
  const prelim = evaluateTasks(tasks, runDate, {})
  const ids = prelim.map((c) => c.insightlyId).filter(Boolean)
  const contactsById = await fetchContactsByIds(ids)

  // Pass 2: re-run with resolved emails so messages + blockers are final.
  const candidates = evaluateTasks(tasks, runDate, contactsById)

  return {
    runDate: format(runDate, 'yyyy-MM-dd'),
    totalTasks: tasks.length,
    matched: candidates.length,
    sendMode: sendMode(),
    candidates,
  }
}

// Forward calendar of reminders due within `days` — for the "Upcoming" view.
export async function listUpcoming(days = 60) {
  const tasks = await fetchAllTasks()
  const items = computeUpcoming(tasks, new Date(), days)
  return { from: format(new Date(), 'yyyy-MM-dd'), days, total: items.length, items }
}

// Every task in the project, matched or not — for the "All Tasks" view.
export async function listTasks() {
  const tasks = await fetchAllTasks()
  const summaries = tasks.map(summarizeTask).sort((a, b) => a.fullName.localeCompare(b.fullName))
  return { total: summaries.length, tasks: summaries }
}

// Send one reminder. Re-resolves the recipient from Asana + Insightly so a
// tampered client payload can't redirect a client email elsewhere.
// SEND_MODE=dry returns the resolved plan without sending anything.
export async function sendReminder({ id, subject, bodyHtml, comment, override }) {
  const task = await fetchTask(id)
  const refs = extractContactRefs(task)

  // Safety net: refuse anyone who isn't an approved test contact (default-on).
  if (testRecipientsOnly() && !isTestContact(refs.insightlyId)) {
    const e = new Error(
      `Blocked by TEST_RECIPIENTS_ONLY: ${refs.insightlyId || 'this contact'} is not in the test allowlist (${TEST_CONTACT_IDS.length} approved). Set TEST_RECIPIENTS_ONLY=false to send to real clients.`
    )
    e.status = 403
    throw e
  }

  if (refs.stopped && !override) {
    const e = new Error('Stop-automation flag is set on this task')
    e.status = 409
    throw e
  }

  const contact = await fetchContactEmail(refs.insightlyId)
  if (!contact?.email) {
    const e = new Error('No client email on file in Insightly')
    e.status = 400
    throw e
  }

  const redirect = (process.env.SEND_REDIRECT_TO || '').trim()
  const bccEnv = (process.env.MAIL_BCC || '').split(',').map((s) => s.trim()).filter(Boolean)

  let to = [contact.email]
  let cc = refs.brokerEmail ? [refs.brokerEmail] : []
  let bcc = bccEnv
  if (redirect) {
    // Test mode: everything goes to the redirect address; don't email the real broker/bcc.
    to = [redirect]
    cc = []
    bcc = []
  }

  const plan = { to, cc, bcc, subject, realClient: contact.email, broker: refs.brokerEmail }

  if (sendMode() !== 'live') {
    return { ok: true, dryRun: true, plan, posted: false, note: 'SEND_MODE=dry — nothing sent' }
  }

  const email = await sendEmail({
    fromName: process.env.MAIL_FROM_NAME || '',
    fromAddress: process.env.MAIL_FROM_ADDRESS || '',
    to,
    cc,
    bcc,
    replyTo: process.env.MAIL_REPLY_TO || '',
    subject,
    html: bodyHtml,
  })

  // Skip the Asana comment when redirecting (test) so we don't write to a real client task.
  let posted = false
  let postError = null
  if (comment && !redirect) {
    try {
      await postComment(id, comment)
      posted = true
    } catch (e) {
      postError = e.message
    }
  }

  return { ok: true, dryRun: false, plan, email, posted, postError }
}
