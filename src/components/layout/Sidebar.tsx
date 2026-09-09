import { NavLink } from 'react-router-dom';
import {
  Home, Bot, Pill, CalendarClock, ShieldAlert, Activity,
  FolderHeart, Users, FileText, Settings, ShieldPlus,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { Dots } from '@/components/ui/Decorations';

const elderNav = [
  { to: '/', label: '首页', icon: Home },
  { to: '/assistant', label: 'AI 智能用药助手', icon: Bot },
  { to: '/medications', label: '我的药品', icon: Pill },
  { to: '/schedule', label: '智能用药计划', icon: CalendarClock },
  { to: '/risk', label: 'AI 用药风险分析', icon: ShieldAlert },
  { to: '/health', label: '健康数据', icon: Activity },
  { to: '/profile', label: '个人健康档案', icon: FolderHeart },
  { to: '/family', label: '家属监护', icon: Users },
  { to: '/reports', label: '健康报告', icon: FileText },
  { to: '/settings', label: '系统设置', icon: Settings },
];

const familyNav = [
  { to: '/', label: '家庭健康中心', icon: Home },
  { to: '/assistant', label: 'AI 智能用药助手', icon: Bot },
  { to: '/medications', label: '老人药品', icon: Pill },
  { to: '/schedule', label: '用药记录', icon: CalendarClock },
  { to: '/risk', label: 'AI 用药风险分析', icon: ShieldAlert },
  { to: '/health', label: '健康数据', icon: Activity },
  { to: '/profile', label: '老人健康档案', icon: FolderHeart },
  { to: '/reports', label: '健康报告', icon: FileText },
  { to: '/settings', label: '系统设置', icon: Settings },
];

export function Sidebar() {
  const { user, settings } = useApp();
  const nav = user?.role === 'family' ? familyNav : elderNav;

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-cream-50 border-r border-sage-100 flex flex-col">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sage-600 flex items-center justify-center shadow-soft">
            <ShieldPlus className="text-white" size={24} />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-sage-800 leading-tight">智药护航</h1>
            <p className="text-[11px] text-sage-500 leading-tight">AI 智能用药管理平台</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto pb-4">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => cn('nav-item nav-item-label', isActive && 'nav-item-active')}
            >
              <Icon size={19} className="shrink-0" />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer decoration */}
      {!settings.reducedDeco && (
        <div className="px-4 pb-4 text-sage-200">
          <Dots className="w-12 h-12" />
        </div>
      )}
    </aside>
  );
}
