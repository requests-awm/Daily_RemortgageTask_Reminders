// Minimal backend API for the remortgage reminder app.
// Run: npm run server   (which passes --env-file=server/.env)
//
// Holds the secrets and does the Asana/Insightly work the browser can't.
// Read-only today: /api/run pulls + matches; sending is intentionally not here.
import { createServer } from 'node:http'
import { format } from 'date-fns'
import { runPipeline, sendReminder, sendMode, listTasks, listUpcoming } from './pipeline.mjs'
import { startScheduler, scheduleInfo } from './scheduler.mjs'

const PORT = Number(process.env.PORT || 8787)

// In-memory cache of today's run (no DB yet). The scheduler refreshes this at
// 8:30; /api/run serves it for the rest of the day so the queue is instant.
let cachedResult = null            // full runPipeline result
let lastRun = null                 // { ranAt, runDate, matched, total, source }
const runHistory = []              // recent runs (capped)
const todayStr = () => format(new Date(), 'yyyy-MM-dd')

async function runAndCache(source) {
  const result = await runPipeline(new Date())
  cachedResult = result
  lastRun = { ranAt: new Date().toISOString(), runDate: result.runDate, matched: result.matched, total: result.totalTasks, source }
  runHistory.unshift(lastRun)
  if (runHistory.length > 30) runHistory.pop()
  console.log(`[run:${source}] ${result.runDate}: ${result.matched}/${result.totalTasks} matched`)
  return result
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1e6) reject(new Error('Payload too large'))
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function send(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(json)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (req.method === 'OPTIONS') return send(res, 204, {})

  if (url.pathname === '/api/health') {
    return send(res, 200, { ok: true, mode: 'live', sendMode: sendMode(), time: new Date().toISOString() })
  }

  if (url.pathname === '/api/tasks' && req.method === 'GET') {
    try {
      const result = await listTasks()
      console.log(`[tasks] ${result.total} tasks listed`)
      return send(res, 200, result)
    } catch (e) {
      console.error('[tasks] error:', e.message)
      return send(res, 502, { error: e.message })
    }
  }

  if (url.pathname === '/api/upcoming' && req.method === 'GET') {
    try {
      const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days') || '60', 10)))
      const result = await listUpcoming(days)
      console.log(`[upcoming] ${result.total} reminders in next ${days}d`)
      return send(res, 200, result)
    } catch (e) {
      console.error('[upcoming] error:', e.message)
      return send(res, 502, { error: e.message })
    }
  }

  if (url.pathname === '/api/send' && req.method === 'POST') {
    try {
      const payload = await readJson(req)
      if (!payload.id) return send(res, 400, { error: 'Missing reminder id' })
      const result = await sendReminder(payload)
      console.log(`[send] ${result.dryRun ? 'DRY' : 'LIVE'} ${payload.id} -> ${result.plan.to.join(', ')}`)
      return send(res, 200, result)
    } catch (e) {
      console.error('[send] error:', e.message)
      return send(res, e.status || 502, { error: e.message })
    }
  }

  if (url.pathname === '/api/run' && req.method === 'GET') {
    try {
      const dateParam = url.searchParams.get('date')
      if (dateParam) {
        // Explicit date: always compute fresh, don't touch the cache.
        const result = await runPipeline(new Date(dateParam + 'T00:00:00'))
        console.log(`[run:adhoc] ${result.runDate}: ${result.matched}/${result.totalTasks} matched`)
        return send(res, 200, result)
      }
      // No date = today: serve cache if it's today's run, else compute + cache.
      if (cachedResult && cachedResult.runDate === todayStr()) {
        return send(res, 200, { ...cachedResult, cached: true })
      }
      const result = await runAndCache('on-demand')
      return send(res, 200, result)
    } catch (e) {
      console.error('[run] error:', e.message)
      return send(res, 502, { error: e.message })
    }
  }

  // Force a run now (manual trigger / "Run now" button).
  if (url.pathname === '/api/run/now' && req.method === 'POST') {
    try {
      const result = await runAndCache('manual')
      return send(res, 200, { ok: true, ...lastRun, candidates: result.candidates })
    } catch (e) {
      console.error('[run:now] error:', e.message)
      return send(res, 502, { error: e.message })
    }
  }

  // Scheduler status for the UI.
  if (url.pathname === '/api/schedule' && req.method === 'GET') {
    return send(res, 200, { ...scheduleInfo(), lastRun, history: runHistory.slice(0, 10) })
  }

  return send(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`Remortgage backend listening on http://localhost:${PORT}`)
  const expr = startScheduler(runAndCache)
  const info = scheduleInfo()
  console.log(`  scheduler armed: "${expr}" ${info.timezone} (weekends: ${info.weekends ? 'yes' : 'no'})`)
  console.log(`  next run: ${info.nextRun}`)
  console.log(`  routes: /api/health /api/run /api/run/now /api/tasks /api/send /api/schedule`)
})
