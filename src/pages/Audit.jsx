import Topbar from '../components/Topbar.jsx'
import { Download } from 'lucide-react'
import { useStore } from '../data/store.jsx'

function OutcomePill({ outcome }) {
  const map = { sent: ['pill-green', 'Sent'], skipped: ['pill-slate', 'Skipped'], stopped: ['pill-red', 'Stopped'] }
  const [cls, label] = map[outcome] || ['pill-slate', outcome]
  return <span className={`pill ${cls}`}>{label}</span>
}

export default function Audit() {
  const { audit } = useStore()
  return (
    <>
      <Topbar crumb="Workflow" title="Audit Log" />
      <div className="content">
        <div className="content-narrow">
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div>
              <div className="page-title">Audit Log</div>
              <div className="page-sub">Every send and skip, in place of the old Google Sheet. {audit.length} entries.</div>
            </div>
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}><Download size={14} /> Export CSV</button>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="audit">
              <thead>
                <tr>
                  <th>When</th><th>Client</th><th>Stage</th><th>Email</th><th>Broker</th><th>Outcome</th><th>Note</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.when}</td>
                    <td style={{ color: 'var(--ink)', fontWeight: 550 }}>{r.client}</td>
                    <td>{r.stage}</td>
                    <td>{r.email || '—'}</td>
                    <td>{r.broker}</td>
                    <td><OutcomePill outcome={r.outcome} /></td>
                    <td style={{ color: 'var(--muted)' }}>{r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
