import { Droplets, Waves, FlaskConical, Thermometer } from 'lucide-react';
import SensorTrend from '../components/SensorTrend.jsx';
import { useLive } from '../hooks/LiveDataContext.js';

function minMax(history, key) {
  if (!history.length) return { min: '—', max: '—' };
  const values = history.map((h) => h[key]).filter((v) => v !== undefined);
  return { min: Math.min(...values), max: Math.max(...values) };
}

export default function Sensors() {
  const { latest, history } = useLive();

  const sensors = [
    {
      key: 'moisture', icon: Droplets, label: 'Soil moisture', color: '#2fa8a0', unit: '%',
      note: 'Capacitive sensor, GPIO 1. Irrigation triggers below 30%.', domain: [0, 100],
    },
    {
      key: 'tankLevel', icon: Waves, label: 'Tank level', color: '#b08159', unit: '%',
      note: 'Ultrasonic sensor via voltage divider, GPIO 4/5. Refill triggers below 20%.', domain: [0, 100],
    },
    {
      key: 'ph', icon: FlaskConical, label: 'Soil pH', color: '#6fcf97', unit: '',
      note: 'Analog pH probe, GPIO 2. Ideal range for most crops: 6.0 – 7.0.', domain: [5, 8],
    },
    {
      key: 'temperature', icon: Thermometer, label: 'Air temperature', color: '#4fc4bb', unit: '°C',
      note: 'DHT11, GPIO 8. Shown alongside humidity for context, not used in pump logic.', domain: [15, 40],
    },
  ];

  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-2xl text-soil-950">Sensors</h1>
        <p className="text-sm text-soil-700/70">Individual trends for every reading feeding the system</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {sensors.map(({ key, icon: Icon, label, color, unit, note, domain }) => {
          const { min, max } = minMax(history, key);
          return (
            <div key={key} className="bg-white rounded-2xl border border-soil-700/10 p-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Icon size={18} style={{ color }} strokeWidth={1.75} />
                  <h3 className="font-display text-lg text-soil-950">{label}</h3>
                </div>
                <span className="font-display text-2xl text-soil-950">
                  {latest?.[key] ?? '—'}{unit}
                </span>
              </div>
              <p className="text-xs text-soil-700/60 mb-3">{note}</p>
              <SensorTrend data={history} dataKey={key} color={color} domain={domain} />
              <div className="flex justify-between text-xs text-soil-700/60 mt-2">
                <span>Min: {min}{unit}</span>
                <span>Max: {max}{unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {latest && (
        <div className="mt-6 bg-white rounded-2xl border border-soil-700/10 p-6">
          <h3 className="font-display text-lg text-soil-950 mb-3">Humidity</h3>
          <p className="text-sm text-soil-700">
            Current relative humidity is <span className="text-soil-950 font-medium">{latest.humidity}%</span>,
            read from the same DHT11 module as air temperature.
          </p>
        </div>
      )}
    </>
  );
}
