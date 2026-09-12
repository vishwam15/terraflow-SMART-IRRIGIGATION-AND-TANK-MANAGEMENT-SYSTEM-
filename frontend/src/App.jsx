import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import Overview from './pages/Overview.jsx'
import Sensors from './pages/Sensors.jsx'
import Pumps from './pages/Pumps.jsx'
import Events from './pages/Events.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Overview />} />
        <Route path="sensors" element={<Sensors />} />
        <Route path="pumps" element={<Pumps />} />
        <Route path="events" element={<Events />} />
      </Route>
    </Routes>
  )
}
