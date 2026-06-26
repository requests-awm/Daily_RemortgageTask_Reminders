// Broker mapping ported from the Zap (steps 7 & 13).
// Asana custom-field GID -> broker; email -> Asana assignee GID.
export const BROKERS = [
  {
    id: '1211493772039112',
    name: 'Nwabisa Janda',
    email: 'nwabisa.janda@ascotwm.com',
    asanaGid: '1208080218675239',
  },
  {
    id: '1211493772039113',
    name: 'Dextter Roberts',
    email: 'dextter.roberts@ascotwm.com',
    asanaGid: '1210705556888612',
  },
]

export function brokerByFieldId(id) {
  return BROKERS.find((b) => b.id === id) || null
}

export function brokerByEmail(email) {
  return BROKERS.find((b) => b.email === email) || null
}

// Fixed recipients carried over from the Zap email steps.
export const MAIL = {
  fromName: 'mortgages@ascotwm.com',
  fromAddress: 'requests@ascotwm.com',
  replyTo: 'mortgages@ascotwm.com',
  bcc: ['jody.moses@ascotwm.com'],
  phone: '01344 851 250',
}
