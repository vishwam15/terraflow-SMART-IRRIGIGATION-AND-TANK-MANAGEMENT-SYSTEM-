import { Droplets, Waves, FlaskConical, Thermometer, Wifi, WifiOff } from 'lucide-react';
import StatCard from '../components/StatCard.jsx';
import TrendChart from '../components/TrendChart.jsx';
import PumpControl from '../components/PumpControl.jsx';
import EventLog from '../components/EventLog.jsx';
import { useLive } from '../hooks/LiveDataContext.js';

export default function Overview() {
  const { latest, history, events, connected, sendCommand } = useLive();

  const handleToggle = (pumpId, state) => {
    if (pumpId === 'auto') {
      sendCommand('AUTO_MODE');
      return;
    }
    if (pumpId === 'irrigation') sendCommand(state ? 'PUMP_ON' : 'PUMP_OFF');
    if (pumpId === 'fill') sendCommand(state ? 'FILL_ON' : 'FILL_OFF');
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-soil-950">Field overview</h1>
          <p className="text-sm text-soil-700/70">Live readings from the ESP32-S3 node</p>
        </div>
        <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full ${connected ? 'bg-growth-500/15 text-growth-500' : 'bg-soil-700/10 text-soil-700'}`}>
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {connected ? 'Connected' : 'Waiting for device'}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Droplets} label="Soil moisture" value={latest?.moisture ?? '—'} unit="%" tone="water" hint="Threshold: 30%" />
        <StatCard icon={Waves} label="Tank level" value={latest?.tankLevel ?? '—'} unit="%" tone="clay" hint="Refill below 20%" />
        <StatCard icon={FlaskConical} label="Soil pH" value={latest?.ph ?? '—'} tone="growth" hint="Ideal: 6.0 – 7.0" />
        <StatCard icon={Thermometer} label="Air temp / humidity" value={latest ? `${latest.temperature}°` : '—'} unit={latest ? `/ ${latest.humidity}%` : ''} tone="water" hint="DHT11 reading" />
      </div>

      <div className="grid md:grid-cols-[1.6fr,1fr] gap-6 mb-6">
        <TrendChart data={history} />
        <PumpControl latest={latest} onToggle={handleToggle} />
      </div>

      <EventLog events={events.slice(0, 6)} />
    </>
  );
}
