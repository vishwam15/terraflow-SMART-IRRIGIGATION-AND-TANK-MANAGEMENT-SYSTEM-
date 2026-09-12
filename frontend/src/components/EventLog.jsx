export default function EventLog({ events }) {
  return (
    <div className="bg-white rounded-2xl border border-soil-700/10 p-6">
      <h3 className="font-display text-lg text-soil-950 mb-4">Recent events</h3>
      {events.length === 0 ? (
        <p className="text-sm text-soil-700/60">No events yet — readings will appear here as they happen.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e, i) => (
            <li key={i} className="flex items-start justify-between text-sm border-b border-soil-700/10 last:border-0 pb-3 last:pb-0">
              <span className="text-soil-950">{e.message}</span>
              <span className="text-xs text-soil-700/60 whitespace-nowrap ml-4">
                {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
