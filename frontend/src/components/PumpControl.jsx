export default function PumpControl({ latest, onToggle }) {
  const pumps = [
    { id: 'irrigation', label: 'Irrigation pump', desc: 'Waters soil when moisture drops low', on: latest?.irrigationPumpOn },
    { id: 'fill', label: 'Tank-fill pump', desc: 'Refills the main tank from source', on: latest?.tankFillPumpOn },
  ];

  return (
    <div className="bg-white rounded-2xl border border-soil-700/10 p-6">
      <h3 className="font-display text-lg text-soil-950 mb-1">Pump control</h3>
      <p className="text-xs text-soil-700/70 mb-5">Auto mode reacts to sensors — override any time.</p>

      <div className="space-y-4">
        {pumps.map((pump) => (
          <div key={pump.id} className="flex items-center justify-between border border-soil-700/10 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm text-soil-950">{pump.label}</p>
              <p className="text-xs text-soil-700/70">{pump.desc}</p>
            </div>
            <button
              onClick={() => onToggle(pump.id, !pump.on)}
              className={`w-12 h-7 rounded-full relative transition-colors ${
                pump.on ? 'bg-growth-500' : 'bg-soil-700/20'
              }`}
              aria-pressed={pump.on}
              aria-label={`Toggle ${pump.label}`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  pump.on ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => onToggle('auto', true)}
        className="mt-5 w-full text-center text-xs text-water-500 hover:text-water-400 transition-colors"
      >
        Return to automatic mode
      </button>
    </div>
  );
}
