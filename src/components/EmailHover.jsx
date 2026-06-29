import { Mail } from 'lucide-react'

// Compact email render for the card hover-preview popover. Purely visual
// (the popover is pointer-events:none), so the body is shown read-only.
export default function EmailHover({ subject, bodyHtml, to, cc }) {
  return (
    <div className="eh">
      <div className="eh-head"><Mail size={13} /> Email that will be sent</div>
      <div className="eh-sub">{subject}</div>
      <div className="eh-to">To {to || '— resolved from Insightly at send —'}{cc ? ` · cc ${cc}` : ''}</div>
      <div className="email-body eh-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <div className="eh-fade" />
    </div>
  )
}
