import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-cream-50 flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-sage-900/30 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <div className={cn('absolute left-0 top-0 h-full animate-slide-up')}>
            <div className="relative h-full">
              <button
                onClick={() => setMobileNavOpen(false)}
                className="absolute -right-12 top-3 text-white p-2"
              >
                <X size={24} />
              </button>
              <Sidebar />
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main key={location.pathname} className="flex-1 p-5 lg:p-7 animate-fade-in">
          {children}
        </main>
        <footer className="px-7 py-4 text-center text-xs text-sage-400 border-t border-sage-100/60">
          本平台提供健康管理辅助信息，不能替代医生诊断和处方。如出现严重不适或用药疑问，请及时咨询医生或药师。
        </footer>
      </div>
    </div>
  );
}
