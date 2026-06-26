import { addMonths, format } from 'date-fns'
import { BROKERS } from './brokers.js'

// Mock data is shaped to match real Asana task + Insightly contact payloads so
// the engine code is identical whether fed mock or live data. Confirmed dates
// are generated relative to `today` so the review queue is always populated.
const today = new Date()
today.setHours(0, 0, 0, 0)

function dateField(monthsFromToday) {
  const d = format(addMonths(today, monthsFromToday), 'yyyy-MM-dd')
  return { name: 'aU_Confirmed_Remortgage_Date', type: 'date', date_value: { date: d }, display_value: d }
}
function brokerField(broker) {
  if (!broker) return { name: 'aDi_Mortgage_Broker_Appointed', type: 'enum', enum_value: null }
  return { name: 'aDi_Mortgage_Broker_Appointed', type: 'enum', enum_value: { gid: broker.id, name: broker.name } }
}
function insightlyField(id) {
  return { name: 'i_Insightly_ID', type: 'text', text_value: id, display_value: id }
}
function stopField(on) {
  return { name: 'af_Remortgage_Stop_Automation', type: 'enum', enum_value: on ? { gid: 'stop', name: 'Yes' } : null }
}

const N = BROKERS[0] // Nwabisa
const D = BROKERS[1] // Dextter

let gid = 1210000000000001
const next = () => String(gid++)

function task(prefix, name, monthsOffset, broker, insightlyId, { stopped = false, testColor = null } = {}) {
  return {
    gid: next(),
    name: `${prefix} - ${name} - Remortgage`,
    due_on: null,
    // Manually-added QA fixtures carry a colour so they stand out in the queue;
    // real Asana tasks never have these props (the engine just ignores them).
    isTest: !!testColor,
    testColor,
    custom_fields: [
      dateField(monthsOffset),
      brokerField(broker),
      insightlyField(insightlyId),
      stopField(stopped),
    ],
  }
}

// monthsOffset is how far the confirmed date sits from today; it equals the
// stage's `months` value, so each row below fires exactly one stage today.
// monthsOffset is how far the confirmed date sits from today; it equals the
// stage's `months` value, so each row below fires exactly one stage today.
export const MOCK_TASKS = [
  // --- Before deal end ---
  task('SUPP', 'Margaret Holloway', 6, N, 'INS-10241'),
  task('SUPP', 'David Chen', 6, D, 'INS-10255'),
  task('SUPP', 'Priya Nair', 3, N, 'INS-10262'),
  task('SUPP', 'James Okoro', 3, D, 'INS-10277'),
  task('SUPP', 'Sofia Rossi', 1, N, 'INS-10288'),
  task('SUPP', 'Tom Bradley', 1, D, 'INS-10290'),

  // --- After deal end (on SVR) ---
  task('SUPP', 'Aisha Khan', -1, N, 'INS-10301'),
  task('SUPP', 'Robert Fenwick', -3, D, 'INS-10312'),
  task('SUPP', 'Grace Mbeki', -6, N, 'INS-10320'),

  // --- Edge cases a human should catch ---
  task('SUPP', 'Henry Watts', 3, N, 'INS-10333', { stopped: true }), // stop flag set
  task('SUPP', 'Lucy Adeyemi', 1, D, 'INS-99999'), // insightly id has no contact -> no email
  task('SUPP', 'Oliver Stone', 6, null, 'INS-10350'), // no broker appointed

  // --- Non-matching tasks (confirmed date far from any offset) ---
  task('SUPP', 'Nina Patel', 4, N, 'INS-10360'),
  task('SUPP', 'Mark Reilly', -2, D, 'INS-10371'),
  task('SUPP', 'Eve Thornton', 9, N, 'INS-10380'),

  // --- QA TEST FIXTURES (manually added to test the send flow) ----------------
  // Two cards per client (an original + a duplicate), each pair sharing one
  // bright colour so they're easy to spot. All offsets match a stage, so every
  // card fires on today's run and lands straight in the Review Queue.
  // Petyr Baelish — violet  (Insightly CONTACT_ID 368444807)
  task('SUPP', 'Petyr Baelish', 6, N, '368444807', { testColor: '#9333ea' }),
  task('SUPP', 'Petyr Baelish', 3, D, '368444807', { testColor: '#9333ea' }),
  // Severus Snape — teal  (Insightly CONTACT_ID 368777790)
  task('SUPP', 'Severus Snape', 1, N, '368777790', { testColor: '#0d9488' }),
  task('SUPP', 'Severus Snape', -1, D, '368777790', { testColor: '#0d9488' }),
  // Jon Snow — blue  (Insightly CONTACT_ID 349057369)
  task('SUPP', 'Jon Snow', -3, N, '349057369', { testColor: '#2563eb' }),
  task('SUPP', 'Jon Snow', -6, D, '349057369', { testColor: '#2563eb' }),
  // Joffrey Baratheon — pink  (Insightly CONTACT_ID 368444599)
  task('SUPP', 'Joffrey Baratheon', 6, D, '368444599', { testColor: '#db2777' }),
  task('SUPP', 'Joffrey Baratheon', 3, N, '368444599', { testColor: '#db2777' }),
]

// Insightly "contacts" keyed by record id, as returned by the search step.
export const MOCK_CONTACTS = {
  'INS-10241': { email: 'm.holloway@example.com', name: 'Margaret Holloway' },
  'INS-10255': { email: 'david.chen@example.com', name: 'David Chen' },
  'INS-10262': { email: 'priya.nair@example.com', name: 'Priya Nair' },
  'INS-10277': { email: 'j.okoro@example.com', name: 'James Okoro' },
  'INS-10288': { email: 'sofia.rossi@example.com', name: 'Sofia Rossi' },
  'INS-10290': { email: 'tom.bradley@example.com', name: 'Tom Bradley' },
  'INS-10301': { email: 'aisha.khan@example.com', name: 'Aisha Khan' },
  'INS-10312': { email: 'r.fenwick@example.com', name: 'Robert Fenwick' },
  'INS-10320': { email: 'grace.mbeki@example.com', name: 'Grace Mbeki' },
  'INS-10333': { email: 'henry.watts@example.com', name: 'Henry Watts' },
  'INS-10350': { email: 'oliver.stone@example.com', name: 'Oliver Stone' },
  'INS-10360': { email: 'nina.patel@example.com', name: 'Nina Patel' },
  'INS-10371': { email: 'mark.reilly@example.com', name: 'Mark Reilly' },
  'INS-10380': { email: 'eve.thornton@example.com', name: 'Eve Thornton' },
  // note: INS-99999 deliberately missing -> Lucy Adeyemi has no email on file

  // QA test fixtures — real emails pulled live from Insightly by record ID.
  '368444807': { email: 'aime.ndumuhire@ascotwm.com', name: 'Petyr Baelish' },
  '368777790': { email: 'shema.fiacre@ascotwm.com', name: 'Severus Snape' },
  '349057369': { email: 'reed.colin89@gmail.com', name: 'Jon Snow' },
  '368444599': { email: 'jody.moses@ascotwm.com', name: 'Joffrey Baratheon' },
}

export const RUN_DATE = today
