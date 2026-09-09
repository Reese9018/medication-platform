import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';

export function ToastContainer() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl shadow-pop border animate-slide-up min-w-[260px] max-w-sm',
            t.type === 'success' && 'bg-white border-sage-200',
            t.type === 'error' && 'bg-white border-coral-200',
            t.type === 'info' && 'bg-white border-sky-200',
          )}
        >
          {t.type === 'success' && <CheckCircle2 className="text-sage-600 shrink-0" size={20} />}
          {t.type === 'error' && <AlertCircle className="text-coral-600 shrink-0" size={20} />}
          {t.type === 'info' && <Info className="text-sky-600 shrink-0" size={20} />}
          <span className="text-sm text-sage-800 flex-1">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="text-sage-300 hover:text-sage-600">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
