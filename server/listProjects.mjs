// List all projects available to this token in the workspace.
// Run: node --env-file=server/.env server/listProjects.mjs
const TOKEN = (process.env.ASANA_ACCESS_TOKEN || '').trim()
const WS = (process.env.ASANA_WORKSPACE_ID || '').trim()
const headers = { Authorization: `Bearer ${TOKEN}` }

async function listAll(maxPages = 20) {
  let url = `https://app.asana.com/api/1.0/projects?workspace=${WS}&limit=100&opt_fields=name,archived`
  const all = []
  for (let page = 0; page < maxPages && url; page++) {
    const res = await fetch(url, { headers })
    const body = await res.json()
    if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(body.errors || body)}`)
    all.push(...(body.data || []))
    url = body.next_page?.uri || null
  }
  return all
}

const projects = await listAll()
const active = projects.filter((p) => !p.archived)
console.log(`Workspace ${WS}: ${projects.length} projects (${active.length} active)\n`)
for (const p of active.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${p.gid}  ${p.name}`)
}
