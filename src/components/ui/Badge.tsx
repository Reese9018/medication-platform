import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/types';

interface BadgeProps {
  children: React.ReactNode;
  level?: RiskLevel | 'info' | 'neutral';
  className?: string;
}

const levelStyles: Record<string, string> = {
  high: 'bg-coral-50 text-coral-700 border border-coral-200',
  mid: 'bg-amber-50 text-amber-700 border border-amber-200',
  low: 'bg-sage-50 text-sage-700 border border-sage-200',
  info: 'bg-sky-50 text-sky-700 border border-sky-200',
  neutral: 'bg-cream-100 text-sage-700 border border-sage-200',
};

export function Badge({ children, level = 'neutral', className }: BadgeProps) {
  return (
    <span className={cn('badge', levelStyles[level], className)}>
      {children}
    </span>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const map = { high: '高风险', mid: '中风险', low: '低风险' };
  return <Badge level={level}>{map[level]}</Badge>;
}
