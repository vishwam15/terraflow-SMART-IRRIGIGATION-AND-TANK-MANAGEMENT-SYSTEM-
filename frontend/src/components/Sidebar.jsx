import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Droplets, SlidersHorizontal, ScrollText, ArrowLeft } from 'lucide-react';

const items = [
  { icon: LayoutGrid, label: 'Overview', path: '/dashboard' },
  { icon: Droplets, label: 'Sensors', path: '/dashboard/sensors' },
  { icon: SlidersHorizontal, label: 'Pump control', path: '/dashboard/pumps' },
  { icon: ScrollText, label: 'Event log', path: '/dashboard/events' },
];

export default function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="w-60 shrink-0 bg-soil-950 text-cream-100 h-screen sticky top-0 flex flex-col">
      <div className="px-6 py-6 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-water-400" />
        <span className="font-display text-lg">Terraflow</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {items.map(({ icon: Icon, label, path }) => {
          const active = pathname === path;
          return (
            <Link
              key={label}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? 'bg-soil-800 text-cream-100' : 'text-cream-400 hover:text-cream-100 hover:bg-soil-900'
              }`}
            >
              <Icon size={17} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <Link
        to="/"
        className="mx-3 mb-6 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-cream-400 hover:text-cream-100 hover:bg-soil-900 transition-colors"
      >
        <ArrowLeft size={17} strokeWidth={1.75} />
        Back to site
      </Link>
    </aside>
  );
}
