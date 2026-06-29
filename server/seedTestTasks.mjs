// Create 6 TEST reminder tasks in the live project — one per stage — dated so
// TOMORROW's run fires each. Only the allowlisted test Insightly IDs are used.
// Run: node --env-file=server/.env server/seedTestTasks.mjs
import { addMonths, addDays, format } from 'date-fns'

const T = (process.env.ASANA_ACCESS_TOKEN || '').trim()
const P = (process.env.ASANA_PROJECT_ID || '').trim()
const CF_DATE = '1210659250129106'      // aU_Confirmed_Remortgage_Date (date)
const CF_BROKER = '1211493772039109'    // aDi_Mortgage_Broker_Appointed (enum)
const OPT_NWABISA = '1211493772039112'  // broker option
const CF_INSIGHTLY = '1202693938754570' // i_insightly_id (number)
const headers = { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }

const today = new Date(); today.setHours(12, 0, 0, 0)
const tomorrow = addDays(today, 1)

// A stage fires when confirmedDate = runDate + stage.months. runDate = tomorrow.
const STAGES = [
  { label: '6M Before', months: 6 },
  { label: '3M Before', months: 3 },
  { label: '1M Before', months: 1 },
  { label: '1M After', months: -1 },
  { label: '3M After', months: -3 },
  { label: '6M After', months: -6 },
]
const CONTACTS = [
  { id: 368444807, name: 'Petyr Baelish' },
  { id: 368777790, name: 'Severus Snape' },
  { id: 349057369, name: 'Jon Snow' },
  { id: 368444599, name: 'Joffrey Baratheon' },
]

console.log(`Tomorrow's run date: ${format(tomorrow, 'yyyy-MM-dd')}\n`)
const created = []
for (let i = 0; i < STAGES.length; i++) {
  const s = STAGES[i]
  const c = CONTACTS[i % CONTACTS.length]
  const remDate = format(addMonths(tomorrow, s.months), 'yyyy-MM-dd')
  const name = `[TEST] PL - ${c.name} - ${c.id} - ${s.label} Reminder - Residential Remortgage`
  const body = { data: { name, projects: [P], custom_fields: { [CF_DATE]: { date: remDate }, [CF_BROKER]: OPT_NWABISA, [CF_INSIGHTLY]: c.id } } }
  const res = await fetch('https://app.asana.com/api/1.0/tasks', { method: 'POST', headers, body: JSON.stringify(body) })
  const b = await res.json()
  if (!res.ok) { console.log(`FAIL  ${s.label.padEnd(9)} ${res.status} ${JSON.stringify(b.errors || b)}`); continue }
  created.push(b.data.gid)
  console.log(`OK    ${s.label.padEnd(9)} | ${c.name.padEnd(18)} (${c.id}) | confirmed ${remDate} | gid ${b.data.gid}`)
}
console.log(`\nCreated ${created.length}/6. Delete later with these gids:\n${created.join('\n')}`)
