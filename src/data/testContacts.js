// Allowlist of approved TEST recipients, keyed by Insightly CONTACT_ID.
//
// SAFETY NET: while the server's TEST_RECIPIENTS_ONLY guard is on (default), the
// live send path will ONLY email a contact whose Insightly id is in this list.
// Any other recipient is refused before an email leaves the building — so a
// published or deployed copy can never reminder a real client by accident.
//
// To go fully live to real clients, set TEST_RECIPIENTS_ONLY=false in server/.env.
export const TEST_CONTACT_IDS = [
  '368444807', // Petyr Baelish
  '368777790', // Severus Snape
  '349057369', // Jon Snow
  '368444599', // Joffrey Baratheon
]

export function isTestContact(insightlyId) {
  return !!insightlyId && TEST_CONTACT_IDS.includes(String(insightlyId).trim())
}
