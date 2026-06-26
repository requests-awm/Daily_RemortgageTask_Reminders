// The six reminder stages, ported 1:1 from the Zap's offset branch logic.
//
// A task fires a stage on the day when:
//     today == aU_Confirmed_Remortgage_Date - offset
// i.e. the confirmed deal-end date is `offset` away from today.
//
// `before` stages fire ahead of the deal end; `after` stages fire once the
// client has rolled onto the lender's SVR.
export const STAGES = [
  { label: 'today+6months', title: '6 Months Before', short: '6M before', months: 6,  dir: 'before', color: 'var(--stage-6b)', template: 'before6' },
  { label: 'today+3months', title: '3 Months Before', short: '3M before', months: 3,  dir: 'before', color: 'var(--stage-3b)', template: 'before3' },
  { label: 'today+1month',  title: '1 Month Before',  short: '1M before', months: 1,  dir: 'before', color: 'var(--stage-1b)', template: 'before1' },
  { label: 'today-1month',  title: '1 Month After',   short: '1M after',  months: -1, dir: 'after',  color: 'var(--stage-1a)', template: 'after1'  },
  { label: 'today-3months', title: '3 Months After',  short: '3M after',  months: -3, dir: 'after',  color: 'var(--stage-3a)', template: 'after3'  },
  { label: 'today-6months', title: '6 Months After',  short: '6M after',  months: -6, dir: 'after',  color: 'var(--stage-6a)', template: 'after6'  },
]

export function stageByLabel(label) {
  return STAGES.find((s) => s.label === label) || null
}
