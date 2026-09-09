import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeCls = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-sage-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative w-full bg-white rounded-2xl shadow-pop border border-sage-100 animate-slide-up max-h-[90vh] flex flex-col', sizeCls[size])}>
        {(title || subtitle) && (
          <div className="flex items-start justify-between p-5 pb-3 border-b border-sage-100">
            <div>
              {title && <h3 className="font-semibold text-sage-800 text-lg">{title}</h3>}
              {subtitle && <p className="text-sm text-sage-500 mt-1">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="text-sage-400 hover:text-sage-700 hover:bg-sage-50 rounded-lg p-1.5 transition">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="p-4 border-t border-sage-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
