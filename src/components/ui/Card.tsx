import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'soft';
}

export function Card({ children, className, variant = 'default' }: CardProps) {
  return (
    <div className={cn(variant === 'soft' ? 'card-soft' : 'card', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon, action }: {
  title: string; subtitle?: string; icon?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between p-5 pb-3">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-sage-600">{icon}</span>}
        <div>
          <h3 className="font-semibold text-sage-800 text-base">{title}</h3>
          {subtitle && <p className="text-xs text-sage-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
