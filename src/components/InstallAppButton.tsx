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
    // 直接下载 APK 安装包
    const link = document.createElement('a');
    link.href = '/zhiyao-huhang.apk';
    link.download = '智药护航.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 已经安装了就不显示按钮
  if (isInstalled) return null;

  return (
    <button
      onClick={handleInstallClick}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition',
        variant === 'default' 
          ? 'bg-sage-600 text-white hover:bg-sage-700' 
          : 'bg-slate-600/80 text-white hover:bg-slate-600 shadow-sm',
        className
      )}
      title="安装应用"
    >
      <Download size={18} />
      <span>安装应用</span>
    </button>
  );
}
