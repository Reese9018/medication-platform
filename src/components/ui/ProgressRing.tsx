interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

export function ProgressRing({
  value, size = 120, stroke = 10, color = '#4A8265', trackColor = '#DCEBE3', label, sublabel,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (value / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && <span className="text-2xl font-bold text-sage-800">{label}</span>}
        {sublabel && <span className="text-xs text-sage-500 mt-0.5">{sublabel}</span>}
      </div>
    </div>
  );
}
