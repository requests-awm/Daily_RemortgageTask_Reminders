import { PanelLeft } from 'lucide-react'

export default function Topbar({ crumb, title }) {
  return (
    <div className="topbar">
      <span className="icon-btn"><PanelLeft size={16} /></span>
      {crumb && <span className="crumb">{crumb} ›</span>}
      <h1>{title}</h1>
    </div>
  )
}
