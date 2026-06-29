// Minimal backend API for the remortgage reminder app.
// Run: npm run server   (which passes --env-file=server/.env)
//
// Holds the secrets and does the Asana/Insightly work the browser can't.
// Read-only today: /api/run pulls + matches; sending is intentionally not here.
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, normalize, join } from 'node:path'
import { format } from 'date-fns'
import { runPipeline, runAndDispatch, sendReminder, sendMode, listTasks, listUpcoming } from './pipeline.mjs'
import { startScheduler, scheduleInfo } from './scheduler.mjs'
import { notifyHeld } from './notify.mjs'

const PORT = Number(process.env.PORT || 8787)

// --- Static SPA serving (single-container / Cloud Run) -----------------------
// When a built ./dist exists, this server also serves the web app, so one
// origin answers both the SPA and /api/* — no separate frontend host, no CORS.
const STATIC_DIR = fileURLToPath(new URL('../dist', import.meta.url))
const STATIC_READY = existsSync(join(STATIC_DIR, 'index.html'))
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.map': 'application/json', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  let rel = decodeURIComponent(url.pathname)
  if (rel === '/') rel = '/index.html'
  const filePath = normalize(join(STATIC_DIR, rel))
  if (!filePath.startsWith(STATIC_DIR)) return send(res, 403, { error: 'Forbidden' }) // path-traversal guard
  try {
    const s = await stat(filePath)
    const target = s.isDirectory() ? join(filePath, 'index.html') : filePath
    const body = await readFile(target)
    const isHtml = extname(target) === '.html'
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      // Hashed assets are immutable; index.html must always re-check.
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
    })
    return res.end(body)
  } catch {
    // Unknown path -> SPA client-side route: serve index.html (200).
    try {
      const body = await readFile(join(STATIC_DIR, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
      return res.end(body)
    } catch {
      return send(res, 404, { error: 'Not found' })
    }
  }
}

// --- Production hardening: CORS allowlist + optional API token ---------------
// CORS_ALLOWED_ORIGINS: comma-separated origins, or "*" (default) for any.
const CORS_ALLOWED = (process.env.CORS_ALLOWED_ORIGINS || '*')
  .split(',').map((s) => s.trim()).filter(Boolean)
// API_TOKEN: when set, mutating routes require "Authorization: Bearer <token>".
// Leave blank to disable (e.g. the API is only reached over a trusted network).
// NOTE: a token baked into the browser bundle is public — this guard is for
// server-to-server / trusted callers, not for protecting browser-issued sends.
const API_TOKEN = (process.env.API_TOKEN || '').trim()

function applyCors(req, res) {
  const origin = req.headers.origin
  let allow = ''
  if (CORS_ALLOWED.includes('*')) allow = '*'
  else if (origin && CORS_ALLOWED.includes(origin)) allow = origin
  if (allow) {
    res.setHeader('Access-Control-Allow-Origin', allow)
    if (allow !== '*') res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function authorized(req) {
  if (!API_TOKEN) return true
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')
  return !!m && m[1] === API_TOKEN
}

// Don't let an unhandled async error take the process down silently.
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e?.message || e))
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e?.message || e))

// In-memory cache of today's run (no DB yet). The scheduler refreshes this at
// 8:30; /api/run serves it for the rest of the day so the queue is instant.
let cachedResult = null            // full runPipeline result
let lastRun = null                 // { ranAt, runDate, matched, total, source }
const runHistory = []              // recent runs (capped)
const todayStr = () => format(new Date(), 'yyyy-MM-dd')

async function runAndCache(source) {
  // The real run: this is the only path allowed to actually send (live:true).
  const result = await runAndDispatch(new Date(), { live: true })
  cachedResult = result
  lastRun = { ranAt: new Date().toISOString(), runDate: result.runDate, matched: result.matched, total: result.totalTasks, autoSent: result.autoSent, held: result.held, dry: result.dry, source }
  runHistory.unshift(lastRun)
  if (runHistory.length > 30) runHistory.pop()
  console.log(`[run:${source}] ${result.runDate}: ${result.matched} matched · ${result.autoSent} auto-sent${result.dry ? ' (dry)' : ''} · ${result.held} held`)

  // Tell a human about held reminders so they don't go unnoticed.
  try {
    const n = await notifyHeld(result)
    if (n.sent) console.log(`[notify] emailed ${n.to} about ${n.count} held reminder(s)`)
    else if (result.held) console.log(`[notify] ${result.held} held — not emailed (${n.reason || n.error})`)
    lastRun.notified = !!n.sent
  } catch (e) {
    console.error('[notify] failed:', e.message)
  }
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
  // CORS headers are set per-request by applyCors() before any send().
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(json)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  applyCors(req, res)

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
    if (!authorized(req)) return send(res, 401, { error: 'Unauthorized' })
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
        // Explicit date: compute fresh, don't touch the cache, NEVER send for real
        // (live:false) — clean rows are shown as a dry-sent simulation only.
        const result = await runAndDispatch(new Date(dateParam + 'T00:00:00'), { live: false })
        console.log(`[run:adhoc] ${result.runDate}: ${result.matched} matched · ${result.autoSent} auto-sent (dry) · ${result.held} held`)
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
    if (!authorized(req)) return send(res, 401, { error: 'Unauthorized' })
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

  // Unknown API route -> JSON 404. Everything else -> the SPA (if built in).
  if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' })
  if (STATIC_READY && req.method === 'GET') return serveStatic(req, res)
  return send(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`Remortgage backend listening on port ${PORT}`)
  console.log(`  static SPA: ${STATIC_READY ? 'serving ./dist (single-origin app + API)' : 'disabled (no ./dist) — API only'}`)
  console.log(`  CORS: ${CORS_ALLOWED.includes('*') ? 'any origin (*)' : CORS_ALLOWED.join(', ')}; API token: ${API_TOKEN ? 'required' : 'disabled'}`)
  const expr = startScheduler(runAndCache)
  const info = scheduleInfo()
  console.log(`  scheduler armed: "${expr}" ${info.timezone} (weekends: ${info.weekends ? 'yes' : 'no'})`)
  console.log(`  next run: ${info.nextRun}`)
  console.log(`  routes: /api/health /api/run /api/run/now /api/tasks /api/send /api/schedule`)
})
