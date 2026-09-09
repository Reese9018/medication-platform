import { cn } from '@/lib/utils';

export function EmptyState({ icon, title, hint, action }: {
  icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-sage-300 mb-3">{icon}</div>}
      <p className="text-sage-600 font-medium">{title}</p>
      {hint && <p className="text-sm text-sage-400 mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionTitle({ title, subtitle, icon, right }: {
  title: string; subtitle?: string; icon?: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-sage-600">{icon}</span>}
        <div>
          <h2 className="text-xl font-semibold text-sage-800">{title}</h2>
          {subtitle && <p className="text-sm text-sage-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function StatPill({ label, value, unit, color = 'sage' }: {
  label: string; value: string | number; unit?: string; color?: 'sage' | 'sky' | 'coral' | 'amber';
}) {
  const colorMap = {
    sage: 'text-sage-700 bg-sage-50',
    sky: 'text-sky-700 bg-sky-50',
    coral: 'text-coral-700 bg-coral-50',
    amber: 'text-amber-700 bg-amber-50',
  };
  return (
    <div className={cn('inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl', colorMap[color])}>
      <span className="text-xs font-medium opacity-70">{label}</span>
      <span className="text-lg font-bold">{value}</span>
      {unit && <span className="text-xs opacity-70">{unit}</span>}
    </div>
  );
}
