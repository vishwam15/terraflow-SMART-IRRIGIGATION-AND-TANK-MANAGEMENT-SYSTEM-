export default function StatCard({ icon: Icon, label, value, unit, tone = 'water', hint }) {
  const toneMap = {
    water: 'text-water-500',
    growth: 'text-growth-500',
    clay: 'text-clay-500',
  };

  return (
    <div className="bg-white rounded-2xl border border-soil-700/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-soil-700 text-sm">{label}</span>
        <Icon size={18} className={toneMap[tone]} strokeWidth={1.75} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-3xl text-soil-950">{value}</span>
        {unit && <span className="text-soil-700 text-sm">{unit}</span>}
      </div>
      {hint && <p className="mt-2 text-xs text-soil-700/70">{hint}</p>}
    </div>
  );
}
