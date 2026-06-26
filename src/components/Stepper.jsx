import { Check } from 'lucide-react'

// steps: [{ label }]; current: index of the active step.
export default function Stepper({ steps, current }) {
  return (
    <div className="stepper">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : ''
        return (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
            <div className={`step ${state}`}>
              <div className="dot">{i < current ? <Check size={12} /> : i + 1}</div>
              <div className="label">{s.label}</div>
            </div>
            {i < steps.length - 1 && <div className={`line ${i < current ? 'done' : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}
