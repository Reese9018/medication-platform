import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';

// 类型声明：beforeinstallprompt 事件
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallAppButtonProps {
  className?: string;
  variant?: 'default' | 'outline';
}

export function InstallAppButton({ className, variant = 'outline' }: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 检查是否已经以 standalone 模式运行（已安装）
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsInstalled(isStandalone);
    };
    checkInstalled();

    // 监听 beforeinstallprompt 事件
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 监听 appinstalled 事件
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('用户接受安装');
    }
    setDeferredPrompt(null);
  };

  // 已经安装了就不显示按钮
  if (isInstalled) return null;

  // 浏览器不支持 PWA 安装（比如 Safari 桌面版）
  if (!deferredPrompt) {
    return (
      <button
        onClick={() => {
          // 提示用户如何手动安装
          alert('您可以通过浏览器菜单中的"安装应用"或"添加到主屏幕"来安装本应用');
        }}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition',
          variant === 'default' 
            ? 'bg-sage-600 text-white hover:bg-sage-700' 
            : 'text-sage-600 hover:bg-sage-50 border border-sage-200',
          className
        )}
        title="安装应用"
      >
        <Download size={18} />
        <span className="hidden sm:inline">安装应用</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleInstallClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition',
        variant === 'default' 
          ? 'bg-sage-600 text-white hover:bg-sage-700' 
          : 'text-sage-600 hover:bg-sage-50 border border-sage-200',
        className
      )}
      title="安装到桌面"
    >
      <Download size={18} />
      <span className="hidden sm:inline">安装应用</span>
    </button>
  );
}
