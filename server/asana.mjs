// Asana client. Pulls project tasks with the custom fields the engine reads.
const BASE = 'https://app.asana.com/api/1.0'
const TOKEN = () => (process.env.ASANA_ACCESS_TOKEN || '').trim()
const PROJECT_ID = () => (process.env.ASANA_PROJECT_ID || '').trim()

const OPT_FIELDS = [
  'name', 'gid', 'due_on',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.text_value',
  'custom_fields.number_value',
  'custom_fields.date_value',
  'custom_fields.enum_value.name',
  'custom_fields.enum_value.gid',
].join(',')

function headers() {
  return { Authorization: `Bearer ${TOKEN()}` }
}

export async function fetchAllTasks(maxPages = 10) {
  const project = PROJECT_ID()
  let url = `${BASE}/projects/${project}/tasks?limit=100&opt_fields=${encodeURIComponent(OPT_FIELDS)}`
  const all = []
  for (let page = 0; page < maxPages && url; page++) {
    const res = await fetch(url, { headers: headers() })
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

// Fetch a single task with the same fields, to re-resolve recipients at send time.
export async function fetchTask(gid) {
  const res = await fetch(
    `${BASE}/tasks/${gid}?opt_fields=${encodeURIComponent(OPT_FIELDS)}`,
    { headers: headers() }
  )
  const body = await res.json()
  if (!res.ok) {
    const msg = body?.errors?.map((e) => e.message).join('; ') || res.statusText
    throw new Error(`Asana ${res.status}: ${msg}`)
  }
  return body.data
}

// Post a comment (story) to a task.
export async function postComment(taskGid, text) {
  const res = await fetch(`${BASE}/tasks/${taskGid}/stories`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { text } }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Asana comment ${res.status}: ${JSON.stringify(body.errors || {})}`)
  }
  return res.json()
}
