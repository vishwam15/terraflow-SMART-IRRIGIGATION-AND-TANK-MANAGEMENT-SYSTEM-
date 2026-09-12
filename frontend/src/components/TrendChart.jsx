import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function TrendChart({ data }) {
  const formatted = data.map((d) => ({
    time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    moisture: d.moisture,
    tank: d.tankLevel,
  }));

  return (
    <div className="bg-white rounded-2xl border border-soil-700/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-lg text-soil-950">Moisture &amp; tank trend</h3>
          <p className="text-xs text-soil-700/70">Last 30 readings</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-soil-700">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-water-500" />Soil moisture</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-clay-500" />Tank level</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={formatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="moistureFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2fa8a0" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#2fa8a0" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="tankFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b08159" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#b08159" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e3e8e1" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9fb0a6' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9fb0a6' }} axisLine={false} tickLine={false} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #dfe6dd', fontSize: 12 }}
          />
          <Area type="monotone" dataKey="moisture" stroke="#2fa8a0" strokeWidth={2} fill="url(#moistureFill)" />
          <Area type="monotone" dataKey="tank" stroke="#b08159" strokeWidth={2} fill="url(#tankFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
