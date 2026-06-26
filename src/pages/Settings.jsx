import Topbar from '../components/Topbar.jsx'
import { Clock, Mail, Users, Layers, Info } from 'lucide-react'
import { STAGES } from '../data/offsets.js'
import { BROKERS, MAIL } from '../data/brokers.js'

export default function Settings() {
  return (
    <>
      <Topbar crumb="Configure" title="Settings" />
      <div className="content">
        <div className="content-narrow">
          <div className="page-title">Settings</div>
          <div className="page-sub">Configuration carried over from the Zap. Editable here once the backend is wired.</div>

          <div className="callout blue" style={{ marginBottom: 18 }}>
            <Info className="ico" size={17} color="var(--blue)" />
            <div className="body">These values currently come from the data layer (mock). Persisting changes is a backend task for the Supabase phase.</div>
          </div>

          <div className="card card-pad">
            <div className="card-head"><Clock size={15} /> Schedule</div>
            <div className="kv-grid">
              <div className="field"><label>Run time</label><input defaultValue="8:30 AM" /></div>
              <div className="field"><label>Timezone</label><input defaultValue="Europe/London" /></div>
              <div className="field"><label>Run on weekends</label><select defaultValue="yes"><option value="yes">Yes</option><option value="no">No</option></select></div>
              <div className="field"><label>Asana project</label><input defaultValue="ANa. PL - SUPP - Mortgage Team DYNAMIC" /></div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head"><Mail size={15} /> Email defaults</div>
            <div className="kv-grid">
              <div className="field"><label>From name</label><input defaultValue={MAIL.fromName} /></div>
              <div className="field"><label>From address</label><input defaultValue={MAIL.fromAddress} /></div>
              <div className="field"><label>Reply-to</label><input defaultValue={MAIL.replyTo} /></div>
              <div className="field"><label>BCC (audit)</label><input defaultValue={MAIL.bcc.join(', ')} /></div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head"><Users size={15} /> Broker mapping</div>
            <table className="audit">
              <thead><tr><th>Name</th><th>Email (CC)</th><th>Asana field ID</th><th>Asana assignee GID</th></tr></thead>
              <tbody>
                {BROKERS.map((b) => (
                  <tr key={b.id}><td style={{ fontWeight: 550, color: 'var(--ink)' }}>{b.name}</td><td>{b.email}</td><td>{b.id}</td><td>{b.asanaGid}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card card-pad">
            <div className="card-head"><Layers size={15} /> Reminder stages</div>
            <table className="audit">
              <thead><tr><th>Stage</th><th>Offset label</th><th>Direction</th><th>Template</th></tr></thead>
              <tbody>
                {STAGES.map((s) => (
                  <tr key={s.label}>
                    <td><span className="pill" style={{ background: 'color-mix(in srgb,' + s.color + ' 12%,white)', color: s.color, borderColor: 'color-mix(in srgb,' + s.color + ' 30%,white)' }}><span className="swatch" style={{ background: s.color }} />{s.title}</span></td>
                    <td><code>{s.label}</code></td>
                    <td>{s.dir}</td>
                    <td><code>{s.template}</code></td>
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
