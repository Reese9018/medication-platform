import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Accessibility, ChevronDown, LogOut, User, CheckCheck, Menu } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout, notifications, markNotificationRead, markAllRead, settings, updateSettings, showToast } = useApp();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][today.getDay()];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    showToast('已安全退出登录', 'info');
    navigate('/login');
  };

  const toggleElderMode = () => {
    updateSettings({ elderMode: !settings.elderMode });
    showToast(settings.elderMode ? '已关闭适老化模式' : '已开启适老化模式', 'info');
  };

  const levelColor = (lvl: string) => ({
    info: 'bg-sky-500', warn: 'bg-amber-500', danger: 'bg-coral-500',
  }[lvl] || 'bg-sage-500');

  return (
    <header className="sticky top-0 z-30 bg-cream-50/85 backdrop-blur-md border-b border-sage-100">
      <div className="flex items-center justify-between px-5 py-3">
        {/* Left: mobile menu + date */}
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button onClick={onMenuClick} className="lg:hidden text-sage-600 p-1.5 rounded-lg hover:bg-sage-50">
              <Menu size={22} />
            </button>
          )}
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-sage-700">{dateStr} {weekDay}</p>
            <p className="text-xs text-sage-400">愿您今日健康平安</p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Accessibility toggle */}
          <button
            onClick={toggleElderMode}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition elder-btn',
              settings.elderMode ? 'bg-sage-600 text-white' : 'text-sage-600 hover:bg-sage-50',
            )}
            title="适老化模式"
          >
            <Accessibility size={18} />
            <span className="hidden sm:inline">{settings.elderMode ? '适老化已开' : '适老化'}</span>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative p-2 rounded-xl text-sage-600 hover:bg-sage-50 transition"
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] h-[18px] px-1 rounded-full bg-coral-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-pop border border-sage-100 animate-slide-up overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-sage-100">
                  <span className="font-semibold text-sage-800">消息提醒</span>
                  <button onClick={markAllRead} className="text-xs text-sage-500 hover:text-sage-700 flex items-center gap-1">
                    <CheckCheck size={14} /> 全部已读
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b border-sage-50 hover:bg-sage-50/50 transition flex gap-3',
                        !n.read && 'bg-sage-50/30',
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', levelColor(n.level))} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-sage-800">{n.title}</p>
                        <p className="text-xs text-sage-500 mt-0.5 line-clamp-2">{n.detail}</p>
                        <p className="text-[11px] text-sage-400 mt-1">{n.time}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setUserOpen((v) => !v)}
              className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-xl hover:bg-sage-50 transition"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                style={{ backgroundColor: user?.avatarColor || '#4A8265' }}
              >
                {user?.name?.[0] || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-sage-800 leading-tight">{user?.name}</p>
                <p className="text-[11px] text-sage-500 leading-tight">{user?.role === 'family' ? '家属端' : '老人端'}</p>
              </div>
              <ChevronDown size={16} className="text-sage-400" />
            </button>
            {userOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-pop border border-sage-100 animate-slide-up overflow-hidden">
                <div className="px-4 py-3 border-b border-sage-100">
                  <p className="text-sm font-medium text-sage-800">{user?.name}</p>
                  <p className="text-xs text-sage-500">{user?.role === 'family' ? '家属账户' : '老人账户'}</p>
                </div>
                <button
                  onClick={() => { setUserOpen(false); navigate('/settings'); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-sage-700 hover:bg-sage-50"
                >
                  <User size={16} /> 个人信息
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-coral-600 hover:bg-coral-50"
                >
                  <LogOut size={16} /> 退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
