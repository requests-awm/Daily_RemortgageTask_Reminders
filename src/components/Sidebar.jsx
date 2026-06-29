import { NavLink } from 'react-router-dom'
import { LayoutGrid, ListChecks, CalendarClock, Table2, History, Settings, LifeBuoy, LogOut } from 'lucide-react'
import { useStore } from '../data/store.jsx'
import logo from '../assets/ascot-logo.png'

export default function Sidebar() {
  const { counts } = useStore()
  const link = ({ isActive }) => 'nav-item' + (isActive ? ' active' : '')
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo-chip">
          <img src={logo} alt="Ascot Wealth Management" />
        </div>
        <div className="sub">Remortgage Reminders</div>
      </div>

      <div className="nav-section-label">Workflow</div>
      <NavLink to="/tasks" className={link}>
        <Table2 size={17} /> All Tasks
      </NavLink>
      <NavLink to="/upcoming" className={link}>
        <CalendarClock size={17} /> Upcoming
      </NavLink>
      <NavLink to="/review" className={link}>
        <ListChecks size={17} /> Review Queue
        {counts.pending > 0 && <span className="badge-count">{counts.pending}</span>}
      </NavLink>
      <NavLink to="/audit" className={link}>
        <History size={17} /> Audit Log
      </NavLink>
      <NavLink to="/" end className={link}>
        <LayoutGrid size={17} /> Overview
      </NavLink>

      <div className="nav-section-label">Configure</div>
      <NavLink to="/settings" className={link}>
        <Settings size={17} /> Settings
      </NavLink>

      <div className="spacer" />

      <div className="user">
        <div className="avatar">TF</div>
        <div>
          <div className="uname">Tumisang Filane</div>
          <div className="urole">Operations</div>
        </div>
      </div>
      <button className="foot-link"><LifeBuoy size={15} /> Report a bug</button>
      <button className="foot-link"><LogOut size={15} /> Sign out</button>
    </aside>
  )
}
