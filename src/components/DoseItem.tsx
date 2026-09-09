import { Check, Circle, AlertTriangle, Clock } from 'lucide-react';
import type { ScheduleDose } from '@/types';
import { cn } from '@/lib/utils';

const statusConfig = {
  taken: { icon: Check, color: 'text-sage-600 bg-sage-100 border-sage-300', label: '已服' },
  pending: { icon: Circle, color: 'text-sky-600 bg-sky-50 border-sky-200', label: '待服' },
  missed: { icon: AlertTriangle, color: 'text-coral-600 bg-coral-50 border-coral-200', label: '漏服' },
};

export function DoseStatusIcon({ status, size = 18 }: { status: ScheduleDose['status']; size?: number }) {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-full border', cfg.color)}>
      <Icon size={size} strokeWidth={2.5} />
    </span>
  );
}

export function DoseItem({ dose, onMark }: { dose: ScheduleDose; onMark?: (id: string) => void }) {
  const cfg = statusConfig[dose.status];
  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <DoseStatusIcon status={dose.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-sage-800 truncate">{dose.medicationName}</p>
        <p className="text-xs text-sage-500 mt-0.5 flex items-center gap-2">
          <Clock size={12} /> {dose.time} · {dose.dosage} · {dose.usage}
        </p>
      </div>
      <span className={cn('badge', cfg.color, 'border')}>{cfg.label}</span>
      {onMark && dose.status !== 'taken' && (
        <button
          onClick={() => onMark(dose.id)}
          className="text-xs text-sage-600 hover:text-sage-800 hover:bg-sage-50 px-2.5 py-1.5 rounded-lg transition opacity-0 group-hover:opacity-100"
        >
          确认已服
        </button>
      )}
    </div>
  );
}
