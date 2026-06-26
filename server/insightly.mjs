// Insightly client. Looks up a contact's email by record id (CONTACT_ID),
// mirroring the Zap's "search Contact by Record ID" step.
const BASE = () => (process.env.INSIGHTLY_API_URL || 'https://api.na1.insightly.com/v3.1').trim()
const KEY = () => (process.env.INSIGHTLY_API_KEY || '').trim()

function authHeader() {
  // Insightly uses HTTP Basic with the API key as the username and no password.
  const b64 = Buffer.from(`${KEY()}:`).toString('base64')
  return `Basic ${b64}`
}

export async function fetchContactEmail(contactId) {
  if (!contactId) return null
  const res = await fetch(`${BASE()}/Contacts/${encodeURIComponent(contactId)}`, {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Insightly ${res.status} for contact ${contactId}`)
  const c = await res.json()
  const email =
    c.EMAIL_ADDRESS ||
    (c.CONTACTINFOS || []).find((i) => i.TYPE === 'EMAIL')?.DETAIL ||
    null
  const name = [c.FIRST_NAME, c.LAST_NAME].filter(Boolean).join(' ') || null
  return email ? { email, name } : null
}

// Resolve many ids concurrently into a { id: {email,name} } map.
export async function fetchContactsByIds(ids) {
  const map = {}
  await Promise.all(
    [...new Set(ids.filter(Boolean))].map(async (id) => {
      try {
        const c = await fetchContactEmail(id)
        if (c) map[id] = c
      } catch (e) {
        // leave unresolved -> surfaces as a "no email" blocker in the queue
        map[id] = undefined
      }
    })
  )
  return map
}
