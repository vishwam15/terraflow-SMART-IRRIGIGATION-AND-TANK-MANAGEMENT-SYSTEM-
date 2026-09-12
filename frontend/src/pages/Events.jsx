import { ScrollText } from 'lucide-react';
import { useLive } from '../hooks/LiveDataContext.js';

export default function Events() {
  const { events } = useLive();

  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-2xl text-soil-950">Event log</h1>
        <p className="text-sm text-soil-700/70">Every automatic decision and manual override, most recent first</p>
      </div>

      <div className="bg-white rounded-2xl border border-soil-700/10 p-6">
        {events.length === 0 ? (
          <div className="text-center py-12">
            <ScrollText size={28} className="mx-auto text-soil-700/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-soil-700/60">No events recorded yet.</p>
          </div>
        ) : (
          <ul>
            {events.map((e, i) => (
              <li
                key={i}
                className="flex items-start justify-between text-sm border-b border-soil-700/10 last:border-0 py-3.5"
              >
                <span className="text-soil-950">{e.message}</span>
                <span className="text-xs text-soil-700/60 whitespace-nowrap ml-4">
                  {new Date(e.timestamp).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
