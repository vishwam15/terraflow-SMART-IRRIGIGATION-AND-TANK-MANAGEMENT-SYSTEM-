export default function PivotMotif({ className = '' }) {
  const rings = [60, 105, 150, 195, 240, 285];
  const spokes = Array.from({ length: 12 });

  return (
    <svg
      viewBox="0 0 600 600"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="pivotGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2fa8a0" stopOpacity="0.35" />
          <stop offset="55%" stopColor="#6fcf97" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0e1410" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="spokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2fa8a0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#b08159" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      <circle cx="300" cy="300" r="290" fill="url(#pivotGlow)" />

      {rings.map((r, i) => (
        <circle
          key={r}
          cx="300"
          cy="300"
          r={r}
          fill="none"
          stroke={i % 2 === 0 ? '#4fc4bb' : '#b08159'}
          strokeOpacity={0.35 - i * 0.03}
          strokeWidth="1"
        />
      ))}

      {spokes.map((_, i) => {
        const angle = (i * 360) / spokes.length;
        const rad = (angle * Math.PI) / 180;
        const x2 = 300 + 285 * Math.cos(rad);
        const y2 = 300 + 285 * Math.sin(rad);
        return (
          <line
            key={i}
            x1="300"
            y1="300"
            x2={x2}
            y2={y2}
            stroke="url(#spokeGrad)"
            strokeWidth="1"
          />
        );
      })}

      {spokes.map((_, i) => {
        const angle = (i * 360) / spokes.length + 15;
        const rad = (angle * Math.PI) / 180;
        const dist = 190;
        const cx = 300 + dist * Math.cos(rad);
        const cy = 300 + dist * Math.sin(rad);
        return <circle key={`d-${i}`} cx={cx} cy={cy} r="3" fill="#8fe0ae" fillOpacity="0.8" />;
      })}

      <circle cx="300" cy="300" r="8" fill="#7fd9d1" />
      <circle cx="300" cy="300" r="14" fill="none" stroke="#7fd9d1" strokeOpacity="0.5" strokeWidth="1" />
    </svg>
  );
}
