import { addMonths, format, parseISO, differenceInCalendarDays } from 'date-fns'
import { STAGES } from './offsets.js'
import { brokerByFieldId, brokerByEmail } from './brokers.js'
import { buildMessage } from './emailTemplates.js'

const PROJECT_ID = '344726377347711' // Asana project gid: ANa. PL - SUPP - Mortgage Team DYNAMIC

// ---- Custom-field helpers (mirror the Zap's get_field_value / get_custom_field) ----
export function findField(task, name) {
  return (task.custom_fields || []).find(
    (f) => f.name && f.name.trim().toLowerCase() === name.toLowerCase()
  )
}

function fieldDate(field) {
  if (!field) return null
  const dv = field.date_value
  let candidate = typeof dv === 'object' && dv ? dv.date || dv.date_time : dv
  if (!candidate) candidate = field.display_value
  if (!candidate || typeof candidate !== 'string') return null
  const datePart = candidate.split('T')[0]
  try {
    return parseISO(datePart)
  } catch {
    return null
  }
}

export function fieldValue(field) {
  if (!field) return null
  if (field.enum_value) return field.enum_value.name
  if (field.date_value)
    return typeof field.date_value === 'object'
      ? field.date_value.date || field.date_value.date_time
      : field.date_value
  if (field.number_value != null) return field.number_value
  if (field.text_value) return field.text_value
  if (field.display_value) return field.display_value
  return null
}

// Task name format: "PREFIX - Full Name - ...". Mirrors the Zap's split(" - ")[1].
function parseName(taskName) {
  const groups = (taskName || '').split(' - ')
  const fullName = (groups[1] || groups[0] || '').trim()
  const parts = fullName.split(' ')
  return { fullName, firstName: parts[0] || '', lastName: parts[1] || '' }
}

// ---- Core: evaluate which tasks fire a reminder on `runDate` ----
// Strict exact match: confirmed date must equal runDate + offset exactly.
export function evaluateTasks(tasks, runDate, contactsById = {}) {
  const candidates = []

  for (const task of tasks) {
    const remField = findField(task, 'aU_Confirmed_Remortgage_Date')
    const remDate = fieldDate(remField)
    if (!remDate) continue

    let matchedStage = null
    for (const stage of STAGES) {
      const target = addMonths(runDate, stage.months)
      if (differenceInCalendarDays(remDate, target) === 0) {
        matchedStage = stage
        break
      }
    }
    if (!matchedStage) continue

    const stopField = findField(task, 'af_Remortgage_Stop_Automation')
    const stopValue = fieldValue(stopField)
    const stopped = !!stopValue && String(stopValue).trim() !== ''

    const insightlyId = fieldValue(findField(task, 'i_Insightly_ID'))
    const brokerField = findField(task, 'aDi_Mortgage_Broker_Appointed')
    // Live Asana returns the broker's email in display_value; the mock uses the
    // enum option GID. Match against both so one engine serves both data sources.
    const brokerVal = fieldValue(brokerField)
    const broker =
      brokerByFieldId(brokerField?.enum_value?.gid) ||
      brokerByEmail(brokerVal) ||
      brokerByFieldId(brokerVal)

    const { fullName, firstName, lastName } = parseName(task.name)
    const contact = (insightlyId && contactsById[insightlyId]) || null
    const clientEmail = contact?.email || null

    const dealEndDate = format(remDate, 'MMMM dd yyyy')
    const asanaLink = `https://app.asana.com/0/${PROJECT_ID}/${task.gid}`
    const msg = buildMessage(matchedStage.template, {
      firstName: firstName || fullName,
      dealEndDate,
      asanaLink,
    })

    candidates.push({
      id: task.gid,
      taskName: task.name,
      isTest: !!task.isTest,
      testColor: task.testColor || null,
      fullName,
      firstName,
      lastName,
      asanaGid: task.gid,
      asanaLink,
      insightlyId: insightlyId || null,
      clientEmail,
      broker,
      stageLabel: matchedStage.label,
      stage: matchedStage,
      confirmedDate: format(remDate, 'yyyy-MM-dd'),
      dealEndDate,
      stopped,
      stopValue: stopped ? stopValue : null,
      message: msg,
      // Blockers that a human should resolve before sending.
      blockers: [
        !clientEmail && 'No Insightly email on file',
        !broker && 'No mortgage broker appointed',
        stopped && 'Stop-automation flag is set',
      ].filter(Boolean),
    })
  }

  // Sort: actionable (no blockers) first, then by stage order.
  const stageOrder = Object.fromEntries(STAGES.map((s, i) => [s.label, i]))
  candidates.sort(
    (a, b) =>
      a.blockers.length - b.blockers.length ||
      stageOrder[a.stageLabel] - stageOrder[b.stageLabel]
  )
  return candidates
}

// Forward calendar: for every task, compute all 6 offset trigger dates and
// return the ones landing within `windowDays` of `fromDate`. This is the
// visibility the strict same-day match can't give — who's coming up, and when.
export function computeUpcoming(tasks, fromDate, windowDays = 60) {
  const out = []
  for (const task of tasks) {
    const remDate = fieldDate(findField(task, 'aU_Confirmed_Remortgage_Date'))
    if (!remDate) continue
    const refs = extractContactRefs(task)
    const { fullName } = parseName(task.name)
    for (const stage of STAGES) {
      // A stage fires when today = confirmedDate - stage.months.
      const trigger = addMonths(remDate, -stage.months)
      const daysUntil = differenceInCalendarDays(trigger, fromDate)
      if (daysUntil < 0 || daysUntil > windowDays) continue
      out.push({
        id: `${task.gid}-${stage.label}`,
        gid: task.gid,
        taskName: task.name,
        fullName,
        stageLabel: stage.label,
        stage,
        triggerDate: format(trigger, 'yyyy-MM-dd'),
        daysUntil,
        confirmedDate: format(remDate, 'yyyy-MM-dd'),
        dealEndDate: format(remDate, 'MMMM dd yyyy'),
        brokerName: refs.brokerEmail ? brokerByEmail(refs.brokerEmail)?.name || refs.brokerEmail : null,
        brokerEmail: refs.brokerEmail,
        insightlyId: refs.insightlyId,
        stopped: refs.stopped,
        asanaLink: `https://app.asana.com/0/${PROJECT_ID}/${task.gid}`,
      })
    }
  }
  out.sort((a, b) => a.daysUntil - b.daysUntil || a.fullName.localeCompare(b.fullName))
  return out
}

// Flat, display-friendly summary of a single task — used by the "All Tasks"
// view to list every task in the project, matched or not.
export function summarizeTask(task) {
  const remDate = fieldDate(findField(task, 'aU_Confirmed_Remortgage_Date'))
  const brokerField = findField(task, 'aDi_Mortgage_Broker_Appointed')
  const brokerVal = fieldValue(brokerField)
  const broker =
    brokerByFieldId(brokerField?.enum_value?.gid) ||
    brokerByEmail(brokerVal) ||
    brokerByFieldId(brokerVal)
  const brokerEmail = broker?.email || (typeof brokerVal === 'string' && brokerVal.includes('@') ? brokerVal : null)
  const stopVal = fieldValue(findField(task, 'af_Remortgage_Stop_Automation'))
  const { fullName } = parseName(task.name)
  return {
    id: task.gid,
    gid: task.gid,
    taskName: task.name,
    fullName,
    confirmedDate: remDate ? format(remDate, 'yyyy-MM-dd') : null,
    brokerName: broker?.name || brokerEmail || null,
    brokerEmail,
    insightlyId: fieldValue(findField(task, 'i_Insightly_ID')) || null,
    stopped: !!stopVal && String(stopVal).trim() !== '',
    dueOn: task.due_on || null,
    asanaLink: `https://app.asana.com/0/${PROJECT_ID}/${task.gid}`,
  }
}

// Used by the send endpoint to re-derive recipients from a single task,
// server-side, instead of trusting whatever the client posts.
export function extractContactRefs(task) {
  const brokerField = findField(task, 'aDi_Mortgage_Broker_Appointed')
  const brokerVal = fieldValue(brokerField)
  const broker =
    brokerByFieldId(brokerField?.enum_value?.gid) ||
    brokerByEmail(brokerVal) ||
    brokerByFieldId(brokerVal)
  const stopVal = fieldValue(findField(task, 'af_Remortgage_Stop_Automation'))
  return {
    name: task.name,
    insightlyId: fieldValue(findField(task, 'i_Insightly_ID')) || null,
    brokerEmail: broker?.email || (typeof brokerVal === 'string' && brokerVal.includes('@') ? brokerVal : null),
    stopped: !!stopVal && String(stopVal).trim() !== '',
  }
}
