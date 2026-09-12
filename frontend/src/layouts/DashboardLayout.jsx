import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import { useLiveData } from '../hooks/useLiveData.js';
import { LiveDataContext } from '../hooks/LiveDataContext.js';

export default function DashboardLayout() {
  const liveData = useLiveData();

  return (
    <LiveDataContext.Provider value={liveData}>
      <div className="flex bg-cream-200 min-h-screen font-body">
        <Sidebar />
        <main className="flex-1 px-8 py-8 max-w-6xl">
          <Outlet />
        </main>
      </div>
    </LiveDataContext.Provider>
  );
}
