// Confirm auth + find the mortgage project's real GID by name.
// Run: node --env-file=server/.env server/findProject.mjs
const TOKEN = (process.env.ASANA_ACCESS_TOKEN || '').trim()
const WS = (process.env.ASANA_WORKSPACE_ID || '').trim()
const headers = { Authorization: `Bearer ${TOKEN}` }

async function get(url) {
  const res = await fetch(url, { headers })
  const body = await res.json()
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(body.errors || body)}`)
  return body.data
}

const me = await get('https://app.asana.com/api/1.0/users/me?opt_fields=name,email')
console.log(`Authenticated as: ${me.name} <${me.email}>`)

const q = encodeURIComponent('Mortgage')
const hits = await get(
  `https://app.asana.com/api/1.0/workspaces/${WS}/typeahead?resource_type=project&query=${q}&count=20&opt_fields=name`
)
console.log(`\nProjects matching "Mortgage" in workspace ${WS}:`)
for (const p of hits) console.log(`  ${p.gid}  ${p.name}`)
