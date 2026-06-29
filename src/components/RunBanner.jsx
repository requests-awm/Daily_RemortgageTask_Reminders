import { Radio, FlaskConical, AlertOctagon, Loader2 } from 'lucide-react'
import { useStore } from '../data/store.jsx'

export function RunBanner() {
  const { mode, sendMode, autoSend, error } = useStore()
  const policy = autoSend === 'off' ? 'every reminder waits for manual approval' : 'clean reminders auto-send; blocked ones are held for review'
  if (error) {
    return (
      <div className="callout red" style={{ marginTop: 0 }}>
        <AlertOctagon className="ico" size={18} color="var(--red)" />
        <div className="body">
          <strong>Couldn't reach the backend.</strong> {error}
          <div style={{ marginTop: 4, color: 'var(--muted)' }}>
            Start it with <code>npm run server</code>, or set <code>VITE_USE_MOCK=true</code> to use sample data.
          </div>
        </div>
      </div>
    )
  }
  if (mode === 'live' && sendMode === 'live') {
    return (
      <div className="callout red" style={{ marginTop: 0 }}>
        <AlertOctagon className="ico" size={18} color="var(--red)" />
        <div className="body">
          <strong>LIVE SENDING IS ON.</strong> Live Asana + Insightly data — on the daily run, {policy} (real
          emails + Asana comments). Set <code>SEND_MODE=dry</code> to disable.
        </div>
      </div>
    )
  }
  if (mode === 'live') {
    return (
      <div className="callout cream" style={{ marginTop: 0 }}>
        <Radio className="ico" size={18} color="var(--amber)" />
        <div className="body">
          <span className="title">Live data · dry-run.</span> Pulled live from Asana + Insightly. Auto-send policy: {policy} —
          but in dry-run nothing actually sends (clean ones are simulated as sent). Set <code>SEND_MODE=live</code> to send for real.
        </div>
      </div>
    )
  }
  return (
    <div className="callout blue" style={{ marginTop: 0 }}>
      <FlaskConical className="ico" size={18} color="var(--blue)" />
      <div className="body">Sample data (mock). Set <code>VITE_USE_MOCK=false</code> and run <code>npm run server</code> to pull live.</div>
    </div>
  )
}

export function LoadingState({ label = 'Pulling reminders…' }) {
  return (
    <div className="card card-pad empty">
      <Loader2 size={26} color="var(--muted-2)" className="spin" />
      <div className="big">{label}</div>
      <div>Fetching Asana tasks and resolving client emails.</div>
    </div>
  )
}
