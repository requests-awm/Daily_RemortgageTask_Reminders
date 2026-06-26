import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Overview from './pages/Overview.jsx'
import ReviewQueue from './pages/ReviewQueue.jsx'
import ReviewDetail from './pages/ReviewDetail.jsx'
import Upcoming from './pages/Upcoming.jsx'
import AllTasks from './pages/AllTasks.jsx'
import Audit from './pages/Audit.jsx'
import Settings from './pages/Settings.jsx'

export default function App() {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/review/:id" element={<ReviewDetail />} />
          <Route path="/upcoming" element={<Upcoming />} />
          <Route path="/tasks" element={<AllTasks />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
