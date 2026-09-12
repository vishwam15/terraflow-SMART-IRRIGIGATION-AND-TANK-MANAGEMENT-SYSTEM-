import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function SensorTrend({ data, dataKey, color, domain = [0, 100] }) {
  const formatted = data.map((d) => ({
    time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: d[dataKey],
  }));

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <defs>
          <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e3e8e1" vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9fb0a6' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#9fb0a6' }} axisLine={false} tickLine={false} domain={domain} width={28} />
        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #dfe6dd', fontSize: 12 }} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#fill-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
