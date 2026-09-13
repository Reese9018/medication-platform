import { useState } from 'react';
import {
  Settings, Contrast, EyeOff, Volume2, Bell, Shield, Smartphone, Globe, Moon, Info,
  Check, Wand2, KeyRound,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { authApi } from '@/lib/api';
import { SectionTitle } from '@/components/ui/Common';
import { cn } from '@/lib/utils';

type FeatureKey = 'highContrast' | 'reducedDeco' | 'voiceRead';

// 三个「个性化外观」开关的专属配色
const FEATURES: {
  key: FeatureKey;
  title: string;
  desc: string;
  accent: 'amber' | 'sky' | 'coral';
  icon: React.ReactNode;
}[] = [
  {
    key: 'highContrast',
    title: '高对比度',
    desc: '提高文字与背景的对比度，看得更清楚',
    accent: 'amber',
    icon: <Contrast size={20} />,
  },
  {
    key: 'reducedDeco',
    title: '减少装饰',
    desc: '隐藏背景装饰与动画，界面更简洁',
    accent: 'sky',
    icon: <EyeOff size={20} />,
  },
  {
    key: 'voiceRead',
    title: '语音朗读',
    desc: '重要信息支持语音播报，点开即可试听',
    accent: 'coral',
    icon: <Volume2 size={20} />,
  },
];

const ACCENT = {
  amber: {
    card: 'border-amber-200 bg-amber-50/60',
    on: 'text-amber-600 bg-amber-100',
    chip: 'bg-amber-500',
    ring: 'ring-amber-300',
    label: 'Ambient · 高对比',
  },
  sky: {
    card: 'border-sky-200 bg-sky-50/60',
    on: 'text-sky-600 bg-sky-100',
    chip: 'bg-sky-500',
    ring: 'ring-sky-300',
    label: 'Minimal · 无装饰',
  },
  coral: {
    card: 'border-coral-200 bg-coral-50/60',
    on: 'text-coral-600 bg-coral-100',
    chip: 'bg-coral-500',
    ring: 'ring-coral-300',
    label: 'Voice · 语音播报',
  },
};

export function SettingsPage() {
  const { settings, updateSettings, speak, showToast, logout } = useApp();
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPwd || !newPwd || !confirmPwd) { showToast('请完整填写三项密码', 'error'); return; }
    if (newPwd.length < 6) { showToast('新密码至少 6 位', 'error'); return; }
    if (newPwd !== confirmPwd) { showToast('两次输入的新密码不一致', 'error'); return; }
    setSavingPwd(true);
    try {
      await authApi.changePassword(oldPwd, newPwd);
      showToast('密码已修改，请重新登录');
      setTimeout(() => { logout(); }, 1200);
    } catch (e: any) {
      showToast(e?.response?.data?.detail || '修改密码失败，请检查原密码', 'error');
    } finally {
      setSavingPwd(false);
    }
  };

  const toggle = (key: FeatureKey) => {
    const next = !settings[key];
    updateSettings({ [key]: next });
    // 开启语音朗读时立即试听一句，直观反馈
    if (key === 'voiceRead' && next) {
      speakVoice('语音朗读已开启，接下来重要信息将自动为您播报。');
    }
    showToast(next ? '已开启' : '已关闭', 'info');
  };

  // 全局 speak() 依赖最新 voiceRead 状态，这里用本地方法确保开启瞬间就能播报
  const speakVoice = (text: string) => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch { /* 静默 */ }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ===== 顶部横幅 ===== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sage-50 via-cream-50 to-sky-50 border border-sage-100 p-6 shadow-soft">
        <div className="absolute -right-6 -top-8 text-sage-100 deco-blob"><Wand2 className="w-40 h-40" /></div>
        <div className="flex items-center gap-3 relative">
          <div className="p-2.5 rounded-xl bg-sage-100 text-sage-600"><Settings size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold text-sage-800">系统设置</h1>
            <p className="text-sm text-sage-500">个性化您的使用体验，每个开关都会立即生效</p>
          </div>
        </div>
      </div>

      {/* ===== 个性化外观（核心特色区） ===== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sage-600"><Wand2 size={18} /></span>
          <h2 className="font-semibold text-sage-800">个性化外观</h2>
          <span className="text-xs text-sage-400">逐一开启，体验实时变化</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const on = settings[f.key];
            const style = ACCENT[f.accent];
            return (
              <button
                key={f.key}
                onClick={() => toggle(f.key)}
                className={cn(
                  'text-left p-5 rounded-2xl border transition-all duration-200 group relative overflow-hidden',
                  on
                    ? cn(style.card, 'ring-2', style.ring, 'shadow-card')
                    : 'bg-white border-sage-100 hover:border-sage-200 hover:shadow-soft',
                )}
              >
                {/* 右下角装饰圆 */}
                <div className={cn('absolute -right-8 -bottom-8 w-24 h-24 rounded-full transition-opacity', on ? style.chip : 'bg-cream-100')} style={{ opacity: on ? 0.12 : 0.5 }} />

                <div className="flex items-center justify-between mb-4">
                  <span className={cn('w-11 h-11 rounded-xl flex items-center justify-center transition-colors', on ? style.on : 'bg-sage-50 text-sage-400')}>
                    {f.icon}
                  </span>
                  {/* 开关 */}
                  <span className={cn(
                    'relative w-12 rounded-full transition-colors shrink-0',
                    on ? style.chip : 'bg-cream-200',
                  )} style={{ height: '26px' }}>
                    <span className={cn(
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-soft transition-transform',
                      on ? 'translate-x-6' : 'translate-x-0.5',
                    )}>
                      {on && <Check size={14} className={cn('absolute inset-0 m-auto', 'text-white')} />}
                    </span>
                  </span>
                </div>

                <h3 className={cn('font-semibold transition-colors', on ? 'text-sage-800' : 'text-sage-700')}>{f.title}</h3>
                <p className="text-xs text-sage-400 mt-1 leading-relaxed">{f.desc}</p>

                {/* 状态徽标 */}
                <span className={cn(
                  'inline-flex items-center gap-1 mt-3 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors',
                  on ? cn(style.on) : 'bg-sage-50 text-sage-400',
                )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', on ? 'bg-current' : 'bg-sage-300')} />
                  {on ? '已开启' : '已关闭'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== 实时体验预览 ===== */}
      <Card className="p-5 border-sage-100">
        <CardHeader title="实时体验预览" subtitle="下面的卡片会随上方开关实时变化" icon={<Settings size={18} />} />
        <div className="mt-2">
          <LivePreview
            contrast={settings.highContrast}
            deco={settings.reducedDeco}
            voice={settings.voiceRead}
            onSpeak={speak}
          />
        </div>
      </Card>

      {/* ===== 通知提醒 ===== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sage-600"><Bell size={18} /></span>
          <h2 className="font-semibold text-sage-800">通知提醒</h2>
        </div>
        <Card>
          <div className="px-5 py-2 space-y-1">
            <StaticRow icon={<Bell size={18} />} title="用药提醒" desc="按时提醒服药" />
            <StaticRow icon={<Shield size={18} />} title="风险预警" desc="AI 风险分析结果推送" />
            <StaticRow icon={<Smartphone size={18} />} title="家属同步" desc="健康数据同步给绑定家属" />
          </div>
        </Card>
      </div>

      {/* ===== 账号安全 / 修改密码 ===== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sage-600"><KeyRound size={18} /></span>
          <h2 className="font-semibold text-sage-800">账号安全</h2>
        </div>
        <Card>
          <CardHeader title="修改登录密码" subtitle="为保障账号安全，建议定期更换密码" icon={<KeyRound size={18} />} />
          <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">原密码</label>
              <input type="password" className="input" placeholder="请输入当前密码" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
            </div>
            <div>
              <label className="label">新密码</label>
              <input type="password" className="input" placeholder="至少 6 位" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            </div>
            <div>
              <label className="label">确认新密码</label>
              <input type="password" className="input" placeholder="再次输入新密码" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
            </div>
          </div>
          <div className="px-5 pb-5">
            <Button onClick={handleChangePassword} loading={savingPwd}>保存新密码</Button>
          </div>
        </Card>
      </div>

      {/* ===== 通用设置 ===== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sage-600"><Globe size={18} /></span>
          <h2 className="font-semibold text-sage-800">通用设置</h2>
        </div>
        <Card>
          <div className="px-5 py-2 space-y-1">
            <StaticRow icon={<Globe size={18} />} title="语言" desc="简体中文" value="简体中文" />
            <StaticRow icon={<Moon size={18} />} title="深色模式" desc="跟随系统" value="跟随系统" />
            <StaticRow icon={<Info size={18} />} title="关于智药护航" desc="版本信息" value="v1.0.0 · 大学生AI创新作品" />
          </div>
        </Card>
      </div>

      {/* ===== 医学免责声明 ===== */}
      <Card className="p-5 bg-amber-50/30 border-amber-100">
        <p className="text-xs text-amber-700 leading-relaxed flex gap-2">
          <Info size={14} className="shrink-0 mt-0.5" />
          本平台提供健康管理辅助信息，不能替代医生诊断和处方。如出现严重不适或用药疑问，请及时咨询医生或药师。
        </p>
      </Card>
    </div>
  );
}

// ===== 实时预览卡片：随三开关联动 =====
function LivePreview({ contrast, deco, voice, onSpeak }: {
  contrast: boolean; deco: boolean; voice: boolean; onSpeak: (t: string) => void;
}) {
  return (
    <div className={cn(
      'rounded-2xl border p-5 transition-colors duration-300 relative overflow-hidden',
      contrast ? 'bg-white border-sage-300' : 'bg-cream-50/60 border-sage-100',
    )}>
      {/* 装饰（减少装饰时隐藏） */}
      {!deco && <div className="absolute top-2 right-4 text-sage-200 deco-blob"><Wand2 className="w-28 h-28" /></div>}

      <div className="relative">
        <div className="flex items-center justify-between">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            contrast ? 'bg-sage-800 text-white' : 'bg-sage-100 text-sage-600',
          )}>
            <Volume2 size={13} /> 今日用药提醒
          </span>
          {/* 语音朗读波形 */}
          {voice && (
            <span className="flex items-center gap-0.5 h-4">
              <span className="w-0.5 h-2 bg-coral-500 rounded animate-pulse-soft" />
              <span className="w-0.5 h-3.5 bg-coral-500 rounded animate-pulse-soft" style={{ animationDelay: '0.15s' }} />
              <span className="w-0.5 h-2 bg-coral-500 rounded animate-pulse-soft" style={{ animationDelay: '0.3s' }} />
              <span className="w-0.5 h-3 bg-coral-500 rounded animate-pulse-soft" style={{ animationDelay: '0.45s' }} />
            </span>
          )}
        </div>

        <h4 className={cn('mt-3 font-semibold transition-colors', contrast ? 'text-sage-900' : 'text-sage-800')}>阿姨，记得按时服药哦</h4>
        <p className={cn('text-sm mt-1 transition-colors', contrast ? 'text-sage-700' : 'text-sage-500')}>
          07:30 前服用格列美脲片 1 片 · 早餐前口服
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => onSpeak('阿姨，记得按时服药哦，早上七点半服用格列美脲片一片。')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
              contrast ? 'bg-sage-800 text-white hover:bg-sage-900' : 'bg-sage-600 text-white hover:bg-sage-700',
            )}
            disabled={!voice}
          >
            <Volume2 size={14} /> 试听播报
          </button>
          <span className={cn('text-xs transition-colors', contrast ? 'text-sage-600' : 'text-sage-400')}>
            {voice ? '语音朗读已开启' : '开启上方「语音朗读」后可试听'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ===== 静态设置行 =====
function StaticRow({ icon, title, desc, value }: { icon: React.ReactNode; title: string; desc: string; value?: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-cream-50/50 transition cursor-pointer">
      <div className="flex items-center gap-3">
        <span className="text-sage-500">{icon}</span>
        <div>
          <p className="text-sm font-medium text-sage-800">{title}</p>
          <p className="text-xs text-sage-400">{desc}</p>
        </div>
      </div>
      {value && <span className="text-sm text-sage-400">{value}</span>}
    </div>
  );
}
