// Small inline SVG decorations — tasteful, not cartoonish
export function PillIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 3.5a5 5 0 0 0-7 7l6 6a5 5 0 0 0 7-7l-6-6z" />
      <path d="M8.5 8.5l7 7" />
    </svg>
  );
}

export function HeartPulseIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 5.7a5 5 0 0 0-7.1 0L12 7.4l-1.7-1.7a5 5 0 0 0-7.1 7.1l1.1 1.1" />
      <path d="M3 14h4l2-3 2 5 2-4h6" />
    </svg>
  );
}

export function LeafIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 4 13c0-6 7-9 16-9 0 9-3 16-9 16z" />
      <path d="M4 20c4-4 7-7 13-13" />
    </svg>
  );
}

export function ShieldCrossIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
      <path d="M12 8v6M9 11h6" />
    </svg>
  );
}

export function FamilyIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="7" r="2.5" />
      <circle cx="16" cy="7" r="2.5" />
      <path d="M3 20c0-3 2.5-5 5-5s5 2 5 5" />
      <path d="M11 20c0-3 2.5-5 5-5s5 2 5 5" />
    </svg>
  );
}

export function Dots({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="80" height="80" viewBox="0 0 80 80" fill="none">
      {Array.from({ length: 5 }).map((_, r) =>
        Array.from({ length: 5 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={6 + c * 17} cy={6 + r * 17} r="2.5" fill="currentColor" opacity={0.25 + (r + c) * 0.05} />
        ))
      )}
    </svg>
  );
}

export function WaveLine({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 40" fill="none" preserveAspectRatio="none">
      <path d="M0 20 Q25 5 50 20 T100 20 T150 20 T200 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function Blob({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none">
      <path d="M100 20c30 0 60 10 70 40s-10 60-30 80-50 40-80 30-50-50-40-80 20-70 80-70z" fill="currentColor" opacity="0.08" />
    </svg>
  );
}
