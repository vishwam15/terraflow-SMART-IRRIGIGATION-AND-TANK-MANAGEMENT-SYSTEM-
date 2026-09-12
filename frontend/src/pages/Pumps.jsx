import { Droplets, Waves } from 'lucide-react';
import { useLive } from '../hooks/LiveDataContext.js';

export default function Pumps() {
  const { latest, events, sendCommand } = useLive();

  const lastEventFor = (label) => events.find((e) => e.message.toLowerCase().includes(label));

  const pumps = [
    {
      id: 'irrigation',
      icon: Droplets,
      label: 'Irrigation pump',
      desc: 'Waters the soil bed. Auto mode turns this on when soil moisture drops below 30%, and off once moisture recovers.',
      on: latest?.irrigationPumpOn,
      onKey: 'PUMP_ON',
      offKey: 'PUMP_OFF',
      lastEvent: lastEventFor('irrigation'),
      color: 'water',
    },
    {
      id: 'fill',
      icon: Waves,
      label: 'Tank-fill pump',
      desc: 'Refills the main tank from the source container. Auto mode turns this on below 20% tank level, and off above 95%.',
      on: latest?.tankFillPumpOn,
      onKey: 'FILL_ON',
      offKey: 'FILL_OFF',
      lastEvent: lastEventFor('tank-fill'),
      color: 'clay',
    },
  ];

  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-2xl text-soil-950">Pump control</h1>
        <p className="text-sm text-soil-700/70">Override either pump manually, or hand control back to the automatic logic</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {pumps.map(({ id, icon: Icon, label, desc, on, onKey, offKey, lastEvent, color }) => (
          <div key={id} className="bg-white rounded-2xl border border-soil-700/10 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon size={20} className={color === 'water' ? 'text-water-500' : 'text-clay-500'} strokeWidth={1.75} />
                <h3 className="font-display text-lg text-soil-950">{label}</h3>
              </div>
              <span
                className={`text-xs px-3 py-1 rounded-full ${
                  on ? 'bg-growth-500/15 text-growth-500' : 'bg-soil-700/10 text-soil-700'
                }`}
              >
                {on ? 'Running' : 'Idle'}
              </span>
            </div>

            <p className="text-sm text-soil-700 leading-relaxed mb-5">{desc}</p>

            <div className="flex gap-3">
              <button
                onClick={() => sendCommand(onKey)}
                disabled={on}
                className="flex-1 rounded-full py-2.5 text-sm font-medium bg-growth-500 text-soil-950 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-growth-400 transition-colors"
              >
                Turn on
              </button>
              <button
                onClick={() => sendCommand(offKey)}
                disabled={!on}
                className="flex-1 rounded-full py-2.5 text-sm font-medium bg-soil-800 text-cream-100 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-soil-700 transition-colors"
              >
                Turn off
              </button>
            </div>

            {lastEvent && (
              <p className="text-xs text-soil-700/60 mt-4">
                Last change: {lastEvent.message} at{' '}
                {new Date(lastEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-soil-700/10 p-6 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-soil-950 mb-1">Automatic mode</h3>
          <p className="text-sm text-soil-700/70">
            Clears any manual override on both pumps and hands control back to the moisture/tank-level logic.
          </p>
        </div>
        <button
          onClick={() => sendCommand('AUTO_MODE')}
          className="shrink-0 rounded-full px-6 py-2.5 text-sm font-medium bg-soil-950 text-cream-100 hover:bg-soil-800 transition-colors"
        >
          Return to auto
        </button>
      </div>
    </>
  );
}
