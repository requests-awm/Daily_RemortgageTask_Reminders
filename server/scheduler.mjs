// Daily run scheduler. Fires the pipeline at RUN_CRON in RUN_TIMEZONE,
// honoring RUN_WEEKENDS. It only PRE-COMPUTES the day's review queue — it does
// not send anything (sending stays human-approved).
import cron from 'node-cron'

const tz = () => (process.env.RUN_TIMEZONE || 'Europe/London').trim()
const weekendsOn = () => (process.env.RUN_WEEKENDS || 'yes').toLowerCase() !== 'no'

function cronParts() {
  const raw = (process.env.RUN_CRON || '30 8 * * *').trim().split(/\s+/)
  return { min: parseInt(raw[0], 10) || 0, hour: parseInt(raw[1], 10) || 8 }
}

const pad = (n) => String(n).padStart(2, '0')

// Day-of-week field reflects the weekends setting.
export function cronExpr() {
  const { min, hour } = cronParts()
  return `${min} ${hour} * * ${weekendsOn() ? '*' : '1-5'}`
}

// Human-readable next fire in the run timezone (no UTC math — uses wall clock).
export function computeNextRunLabel() {
  const { min, hour } = cronParts()
  const zone = tz()
  const now = new Date()
  for (let i = 0; i < 8; i++) {
    const cand = new Date(now.getTime() + i * 86400000)
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(cand)
    const get = (t) => parts.find((p) => p.type === t)?.value
    const wd = get('weekday')
    if (!weekendsOn() && (wd === 'Sat' || wd === 'Sun')) continue
    if (i === 0) {
      const h = +get('hour'), m = +get('minute')
      if (h > hour || (h === hour && m >= min)) continue // today's run already passed
    }
    const when = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : wd
    return `${when} ${get('day')} ${get('month')}, ${pad(hour)}:${pad(min)} (${zone})`
  }
  return `${pad(hour)}:${pad(min)} (${zone})`
}

export function scheduleInfo() {
  const { min, hour } = cronParts()
  return {
    cron: cronExpr(),
    timezone: tz(),
    weekends: weekendsOn(),
    runTime: `${pad(hour)}:${pad(min)}`,
    nextRun: computeNextRunLabel(),
  }
}

let task = null
export function startScheduler(onRun) {
  const expr = cronExpr()
  if (task) task.stop()
  task = cron.schedule(expr, () => {
    Promise.resolve(onRun('schedule')).catch((e) => console.error('[cron] run failed:', e.message))
  }, { timezone: tz() })
  return expr
}
