import { useState } from 'react'
import { Mail, ChevronDown, ChevronRight } from 'lucide-react'
import { MAIL } from '../data/brokers.js'

export default function EmailPreview({ candidate }) {
  const [open, setOpen] = useState(true)
  const { message, clientEmail, broker } = candidate
  return (
    <div className="email">
      <div className="email-head">
        <Mail size={15} />
        Email preview {broker ? `· cc ${broker.name}` : ''}
        <button className="hide" onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {open ? 'hide' : 'show'}
        </button>
      </div>
      {open && (
        <>
          <div className="email-meta">
            <div className="row"><span className="k">To</span><span className="v">{clientEmail || '— no email on file —'}</span></div>
            <div className="row"><span className="k">From</span><span className="v">{MAIL.fromName}</span></div>
            <div className="row"><span className="k">Cc</span><span className="v">{broker ? broker.email : '— no broker —'}</span></div>
            <div className="row"><span className="k">Bcc</span><span className="v">{MAIL.bcc.join(', ')}</span></div>
            <div className="row"><span className="k">Reply-To</span><span className="v">{MAIL.replyTo}</span></div>
            <div className="row"><span className="k">Subject</span><span className="v" style={{ fontWeight: 600, color: 'var(--ink)' }}>{message.subject}</span></div>
          </div>
          <div className="email-body" dangerouslySetInnerHTML={{ __html: message.bodyHtml }} />
        </>
      )}
    </div>
  )
}
