import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ShieldCheck, ShieldAlert, ShieldOff, Mail, MailX, UserCheck, UserX,
  ExternalLink, ArrowLeft, ArrowRight, Send, SkipForward, Pencil, MessageSquare, Sparkles, CheckCircle2,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import Stepper from '../components/Stepper.jsx'
import StageBadge, { StatusPill } from '../components/StageBadge.jsx'
import EmailPreview from '../components/EmailPreview.jsx'
import { useStore } from '../data/store.jsx'
import { MAIL } from '../data/brokers.js'

const STEPS = [{ label: 'Review & Compliance' }, { label: 'Message' }, { label: 'Confirm & Send' }]

export default function ReviewDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { getById, sendReminder, skipReminder, updateMessage, loading, sendMode } = useStore()
  const c = getById(id)

  const [step, setStep] = useState(0)
  const [override, setOverride] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(c ? { ...c.message } : null)
  const [skipping, setSkipping] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)

  if (!c) {
    return (
      <>
        <Topbar crumb="Workflow" title="Review" />
        <div className="content"><div className="content-narrow empty">
          {loading ? 'Loading…' : 'Reminder not found.'}
        </div></div>
      </>
    )
  }

  const handled = c.status !== 'pending'
  const hasEmail = !!c.clientEmail
  const canSend = hasEmail && (!c.stopped || override)

  const saveEdits = () => { updateMessage(c.id, draft); setEditing(false) }
  const doSend = async () => {
    setSending(true)
    setSendError(null)
    try {
      await sendReminder(c.id)
      nav('/review')
    } catch (e) {
      setSendError(e.message)
      setSending(false)
    }
  }
  const doSkip = () => { skipReminder(c.id, skipReason || 'No reason given'); nav('/review') }

  return (
    <>
      <Topbar crumb="Review Queue" title={c.fullName} />
      <div className="content">
        <div className="content-narrow">
          <Stepper steps={STEPS} current={handled ? 3 : step} />

          {handled && (
            <div className="callout green" style={{ marginBottom: 18 }}>
              <CheckCircle2 className="ico" size={18} color="var(--green)" />
              <div className="body">
                This reminder has already been <strong>{c.status}</strong>
                {c.sentAt ? ` at ${c.sentAt}` : ''}{c.skipReason ? ` — ${c.skipReason}` : ''}.
                <div style={{ marginTop: 8 }}><StatusPill status={c.status} /></div>
              </div>
            </div>
          )}

          {/* ---------------- STEP 0: Review & Compliance ---------------- */}
          {(step === 0 || handled) && (
            <>
              <div className="card card-pad">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <h3 style={{ fontSize: 17 }}>{c.fullName}</h3>
                  <StageBadge stage={c.stage} size="lg" />
                </div>
                <div className="kv-grid">
                  <div className="kv"><div className="k">Confirmed remortgage date <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--muted-2)' }}>(current deal ends)</span></div><div className="v">{c.dealEndDate}</div></div>
                  <div className="kv"><div className="k">Matched stage</div><div className="v">{c.stage.title} ({c.stage.label})</div></div>
                  <div className="kv"><div className="k">Mortgage broker</div><div className="v">{c.broker ? c.broker.name : '— none appointed —'}</div></div>
                  <div className="kv"><div className="k">Client email (Insightly)</div><div className="v">{c.clientEmail || '— not found —'}</div></div>
                  <div className="kv"><div className="k">Insightly ID</div><div className="v">{c.insightlyId || '—'}</div></div>
                  <div className="kv"><div className="k">Asana task</div><div className="v"><a href={c.asanaLink} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', display: 'inline-flex', gap: 5, alignItems: 'center' }}>Open task <ExternalLink size={13} /></a></div></div>
                </div>
              </div>

              {/* Compliance check: stop-automation */}
              <div className="card card-pad">
                <div className="card-head"><ShieldCheck size={15} /> Please Review</div>
                <div className="card-q">Is the <strong>stop-automation</strong> flag clear for this client?</div>
                {c.stopped ? (
                  <div className="callout cream">
                    <ShieldOff className="ico" size={18} color="var(--amber)" />
                    <div className="body">
                      <div className="title">Stop-automation flag is set ({String(c.stopValue)})</div>
                      This reminder is suppressed by default. Only override if you've confirmed the client should still be contacted.
                      <div style={{ marginTop: 10 }}>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                          Override and allow this reminder to send
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="callout green"><ShieldCheck className="ico" size={18} color="var(--green)" /><div className="body">No stop flag set — clear to proceed.</div></div>
                )}
              </div>

              {/* Compliance check: email */}
              <div className="card card-pad">
                <div className="card-head"><Mail size={15} /> Please Review</div>
                <div className="card-q">Do we have a <strong>client email</strong> to send to?</div>
                {hasEmail ? (
                  <div className="callout green"><Mail className="ico" size={18} color="var(--green)" /><div className="body">Found in Insightly: <strong>{c.clientEmail}</strong></div></div>
                ) : (
                  <div className="callout red"><MailX className="ico" size={18} color="var(--red)" /><div className="body">No email found for Insightly ID <strong>{c.insightlyId}</strong>. This reminder cannot send until an email is on file. Fix in Insightly, or skip.</div></div>
                )}
              </div>

              {/* Compliance check: broker */}
              <div className="card card-pad">
                <div className="card-head"><UserCheck size={15} /> Please Review</div>
                <div className="card-q">Is a <strong>mortgage broker</strong> appointed (CC + Asana assignee)?</div>
                {c.broker ? (
                  <div className="callout green"><UserCheck className="ico" size={18} color="var(--green)" /><div className="body"><strong>{c.broker.name}</strong> ({c.broker.email}) will be CC'd.</div></div>
                ) : (
                  <div className="callout cream"><UserX className="ico" size={18} color="var(--amber)" /><div className="body"><div className="title">No broker appointed</div>The email will send with no CC. Appoint a broker on the Asana task if one is expected.</div></div>
                )}
              </div>

              {/* AI / engine findings */}
              <div className="card card-pad">
                <div className="card-head"><Sparkles size={15} /> Why this fired today</div>
                <ul className="findings">
                  <li><span className="dot" />Confirmed remortgage date <strong>&nbsp;{c.dealEndDate}&nbsp;</strong> is exactly <strong>&nbsp;{c.stage.title.toLowerCase()}&nbsp;</strong> the deal-end date relative to today's run.</li>
                  <li><span className="dot" />Matched offset label <code>{c.stage.label}</code> → template <code>{c.stage.template}</code>.</li>
                  <li><span className="dot" />{c.stage.dir === 'before' ? 'Pre-expiry nudge: client still on their current deal.' : 'Post-expiry nudge: client likely on the lender SVR now.'}</li>
                </ul>
              </div>
            </>
          )}

          {/* ---------------- STEP 1: Message ---------------- */}
          {step === 1 && !handled && (
            <>
              <div className="card card-pad">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                  <div className="card-head" style={{ margin: 0 }}><Mail size={15} /> Email to client</div>
                  <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setDraft({ ...c.message }); setEditing((e) => !e) }}>
                    <Pencil size={13} /> {editing ? 'Cancel edit' : 'Edit message'}
                  </button>
                </div>
                {editing ? (
                  <>
                    <div className="field"><label>Subject</label><input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></div>
                    <div className="field"><label>Email body (HTML)</label><textarea style={{ minHeight: 200, fontFamily: 'ui-monospace, monospace', fontSize: 12 }} value={draft.bodyHtml} onChange={(e) => setDraft({ ...draft, bodyHtml: e.target.value })} /></div>
                    <button className="btn btn-primary btn-sm" onClick={saveEdits}>Save changes</button>
                  </>
                ) : (
                  <EmailPreview candidate={c} />
                )}
              </div>

              <div className="card card-pad">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <div className="card-head" style={{ margin: 0 }}><MessageSquare size={15} /> Asana comment</div>
                </div>
                {editing ? (
                  <div className="field"><label>Comment posted to the Asana task</label><textarea style={{ minHeight: 150 }} value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} /></div>
                ) : (
                  <div className="email-body" style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--line)', whiteSpace: 'pre-wrap' }}>{c.message.comment}</div>
                )}
              </div>
            </>
          )}

          {/* ---------------- STEP 2: Confirm & Send ---------------- */}
          {step === 2 && !handled && (
            <>
              <div className="card card-pad">
                <div className="card-head"><Send size={15} /> Confirm what will happen</div>
                <div className="card-q" style={{ marginBottom: 14 }}>Sending the <strong>{c.stage.title}</strong> reminder to {c.fullName}</div>
                <ul className="findings">
                  <li><span className="dot" />Email to <strong>&nbsp;{c.clientEmail || 'NO EMAIL'}&nbsp;</strong>{c.broker ? <>, cc <strong>&nbsp;{c.broker.email}&nbsp;</strong></> : ' (no cc)'}, bcc {MAIL.bcc.join(', ')}.</li>
                  <li><span className="dot" />Subject: <strong>&nbsp;{c.message.subject}&nbsp;</strong></li>
                  <li><span className="dot" />Comment posted to the Asana task.</li>
                  <li><span className="dot" />Outcome written to the Audit Log.</li>
                </ul>
              </div>

              {!hasEmail && (
                <div className="callout red"><MailX className="ico" size={18} color="var(--red)" /><div className="body">Cannot send: no client email on file. Resolve in Insightly or skip this reminder.</div></div>
              )}
              {c.stopped && !override && (
                <div className="callout cream"><ShieldOff className="ico" size={18} color="var(--amber)" /><div className="body">Stop-automation flag is set. Go back to step 1 to override if the client should still be contacted.</div></div>
              )}
              {canSend && sendMode === 'live' && (
                <div className="callout red"><Send className="ico" size={18} color="var(--red)" /><div className="body"><strong>Live sending is ON.</strong> Approving will email this client for real and post the Asana comment.</div></div>
              )}
              {canSend && sendMode !== 'live' && (
                <div className="callout green"><ShieldCheck className="ico" size={18} color="var(--green)" /><div className="body">Checks passed. Sending is in <strong>dry-run</strong> — approving records the decision but sends nothing.</div></div>
              )}
              {sendError && (
                <div className="callout red"><MailX className="ico" size={18} color="var(--red)" /><div className="body"><strong>Send failed.</strong> {sendError}</div></div>
              )}
            </>
          )}

          {/* Skip reason inline */}
          {skipping && !handled && (
            <div className="card card-pad">
              <div className="card-head"><SkipForward size={15} /> Skip this reminder</div>
              <div className="field"><label>Reason (written to the audit log)</label><input value={skipReason} onChange={(e) => setSkipReason(e.target.value)} placeholder="e.g. client already remortgaged" autoFocus /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-danger btn-sm" onClick={doSkip}>Confirm skip</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSkipping(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Bottom action bar ---------------- */}
      <div className="actionbar">
        <button className="btn btn-ghost" onClick={() => nav('/review')}><ArrowLeft size={15} /> Queue</button>
        {!handled && (
          <div className="dots">
            {STEPS.map((_, i) => <span key={i} className={`d ${i === step ? 'on' : ''}`} />)}
          </div>
        )}
        <div className="right">
          {!handled && !skipping && (
            <button className="btn btn-danger" onClick={() => setSkipping(true)}><SkipForward size={15} /> Skip</button>
          )}
          {!handled && step > 0 && (
            <button className="btn btn-outline" onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Back</button>
          )}
          {!handled && step < 2 && (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
              Continue to {STEPS[step + 1].label} <ArrowRight size={15} />
            </button>
          )}
          {!handled && step === 2 && (
            <button className="btn btn-primary" disabled={!canSend || sending} onClick={doSend}>
              <Send size={15} /> {sending ? 'Sending…' : sendMode === 'live' ? 'Approve & Send' : 'Approve (dry-run)'}
            </button>
          )}
          {handled && (
            <button className="btn btn-primary" onClick={() => nav('/review')}>Back to queue</button>
          )}
        </div>
      </div>
    </>
  )
}
