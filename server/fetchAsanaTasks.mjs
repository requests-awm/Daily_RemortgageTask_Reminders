// Pull recent tasks from the Asana mortgage project.
// Run: node --env-file=server/.env server/fetchAsanaTasks.mjs
// (Node 20.6+ / 24 — no dependencies, uses built-in fetch + --env-file.)

const TOKEN = (process.env.ASANA_ACCESS_TOKEN || '').trim()
const PROJECT_ID = (process.env.ASANA_PROJECT_ID || '').trim()

if (!TOKEN || !PROJECT_ID) {
  console.error('Missing ASANA_ACCESS_TOKEN or ASANA_PROJECT_ID. Did you pass --env-file=server/.env ?')
  process.exit(1)
}

const OPT_FIELDS = [
  'name', 'due_on', 'created_at', 'modified_at', 'completed',
  'custom_fields.name', 'custom_fields.display_value',
].join(',')

const headers = { Authorization: `Bearer ${TOKEN}` }

async function fetchAllTasks(maxPages = 5) {
  let url = `https://app.asana.com/api/1.0/projects/${PROJECT_ID}/tasks?limit=100&opt_fields=${encodeURIComponent(OPT_FIELDS)}`
  const all = []
  for (let page = 0; page < maxPages && url; page++) {
    const res = await fetch(url, { headers })
    const body = await res.json()
    if (!res.ok) {
      const msg = body?.errors?.map((e) => e.message).join('; ') || res.statusText
      throw new Error(`Asana ${res.status}: ${msg}`)
    }
    all.push(...(body.data || []))
    url = body.next_page?.uri || null
  }
  return all
}

function cf(task, name) {
  const f = (task.custom_fields || []).find(
    (x) => x.name && x.name.trim().toLowerCase() === name.toLowerCase()
  )
  return f?.display_value || ''
}

function pad(s, n) {
  s = String(s ?? '')
  return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n)
}

const tasks = await fetchAllTasks()
tasks.sort((a, b) => new Date(b.modified_at) - new Date(a.modified_at))

console.log(`\nProject ${PROJECT_ID} — ${tasks.length} tasks pulled\n`)
console.log(pad('Modified', 11), pad('Task name', 38), pad('Remortgage date', 16), pad('Broker', 16), pad('Stop', 5), 'Insightly')
console.log('-'.repeat(110))

const recent = tasks.slice(0, 25)
for (const t of recent) {
  console.log(
    pad((t.modified_at || '').slice(0, 10), 11),
    pad(t.name, 38),
    pad(cf(t, 'aU_Confirmed_Remortgage_Date'), 16),
    pad(cf(t, 'aDi_Mortgage_Broker_Appointed'), 16),
    pad(cf(t, 'af_Remortgage_Stop_Automation') ? 'yes' : '', 5),
    cf(t, 'i_Insightly_ID')
  )
}

const withDate = tasks.filter((t) => cf(t, 'aU_Confirmed_Remortgage_Date')).length
console.log(`\nShowing 25 most-recently-modified of ${tasks.length}. ${withDate} have a confirmed remortgage date.`)
