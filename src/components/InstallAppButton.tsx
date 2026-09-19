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
    if (deferredPrompt) {
      // 浏览器支持自动安装（Android Chrome 等），直接弹出安装对话框
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('用户接受安装');
      }
      setDeferredPrompt(null);
    } else {
      // 不支持自动安装的浏览器，显示引导
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const isQQ = /QQ\//.test(ua) || /QQBrowser/.test(ua);
      const isWeChat = /MicroMessenger/.test(ua);
      
      let guide = '';
      if (isWeChat) {
        guide = '当前在微信中打开，无法直接安装。\n\n请点击右上角「···」，选择「在浏览器中打开」，然后再安装。';
      } else if (isQQ) {
        guide = '当前在 QQ 中打开，无法直接安装。\n\n请点击右上角「···」，选择「用浏览器打开」，然后再安装。';
      } else if (isIOS) {
        guide = 'iOS 安装方法：\n\n1. 点击底部「分享」按钮（方框带向上箭头）\n2. 选择「添加到主屏幕」\n3. 点击「添加」即可安装';
      } else {
        guide = 'Android 安装方法：\n\n点击浏览器右上角菜单（三个点），选择「安装应用」或「添加到主屏幕」';
      }
      alert(guide);
    }
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
      title="安装到桌面"
    >
      <Download size={18} />
      <span>安装应用</span>
    </button>
  );
}
