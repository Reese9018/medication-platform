import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldPlus, Phone, Lock, Eye, EyeOff, User as UserIcon, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/Button';
import { Blob, Dots, WaveLine, PillIcon, HeartPulseIcon, LeafIcon } from '@/components/ui/Decorations';

export function LoginPage() {
  const { login, showToast } = useApp();
  const navigate = useNavigate();
  const [account, setAccount] = useState('elder');
  const [password, setPassword] = useState('123456');
  const [showPwd, setShowPwd] = useState(false);
  const [role, setRole] = useState<'elder' | 'family'>('elder');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'password' | 'sms'>('password');
  const [sms, setSms] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !password) { showToast('请输入账号和密码', 'error'); return; }
    setLoading(true);
    const ok = await login(account, password);
    if (ok) {
      showToast('登录成功，欢迎回来');
      navigate('/');
    } else {
      showToast('账号或密码错误，或后端服务未启动', 'error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-cream-50">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-sage-50 via-cream-50 to-sky-50 flex-col justify-between p-12">
        {/* Decorations */}
        <div className="absolute top-0 right-0 text-sage-200 deco-blob"><Blob className="w-72 h-72" /></div>
        <div className="absolute bottom-10 left-10 text-sage-200 deco-dots"><Dots className="w-24 h-24" /></div>
        <div className="absolute top-1/2 left-1/3 text-sky-200 deco-line"><WaveLine className="w-64 h-12" /></div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sage-600 flex items-center justify-center shadow-soft">
            <ShieldPlus className="text-white" size={26} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-sage-800">智药护航</h1>
            <p className="text-xs text-sage-500">AI 智能用药管理平台</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative">
          <h2 className="font-display text-4xl font-bold text-sage-800 leading-snug">
            AI 守护用药安全<br />让健康管理更简单
          </h2>
          <p className="mt-4 text-sage-600 leading-relaxed max-w-md">
            为长辈提供智能用药提醒、多药风险分析、健康数据追踪与家属远程监护，让每一片药都安心。
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { icon: <PillIcon className="w-4 h-4" />, label: '智能用药计划' },
              { icon: <HeartPulseIcon className="w-4 h-4" />, label: '健康数据追踪' },
              { icon: <LeafIcon className="w-4 h-4" />, label: 'AI 风险预警' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 px-3.5 py-2 bg-white/70 rounded-full border border-sage-100 shadow-soft">
                <span className="text-sage-600">{f.icon}</span>
                <span className="text-sm text-sage-700">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-sm text-sage-400">
          © 2026 智药护航 · 大学生 AI 应用创新作品
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-11 h-11 rounded-2xl bg-sage-600 flex items-center justify-center">
              <ShieldPlus className="text-white" size={24} />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-sage-800">智药护航</h1>
              <p className="text-xs text-sage-500">AI 智能用药管理平台</p>
            </div>
          </div>

          <div className="card p-7">
            <h2 className="text-2xl font-bold text-sage-800">欢迎回来</h2>
            <p className="text-sm text-sage-500 mt-1">登录您的健康账户</p>

            {/* Role selector */}
            <div className="mt-5 grid grid-cols-2 gap-2 p-1 bg-cream-100 rounded-xl">
              <button
                onClick={() => setRole('elder')}
                className={`py-2.5 rounded-lg text-sm font-medium transition ${role === 'elder' ? 'bg-white text-sage-800 shadow-soft' : 'text-sage-500'}`}
              >
                老人端
              </button>
              <button
                onClick={() => setRole('family')}
                className={`py-2.5 rounded-lg text-sm font-medium transition ${role === 'family' ? 'bg-white text-sage-800 shadow-soft' : 'text-sage-500'}`}
              >
                家属端
              </button>
            </div>

            {/* Mode tabs */}
            <div className="mt-4 flex gap-4 text-sm">
              <button
                onClick={() => setMode('password')}
                className={`pb-1 border-b-2 ${mode === 'password' ? 'border-sage-600 text-sage-700 font-medium' : 'border-transparent text-sage-400'}`}
              >
                密码登录
              </button>
              <button
                onClick={() => setMode('sms')}
                className={`pb-1 border-b-2 ${mode === 'sms' ? 'border-sage-600 text-sage-700 font-medium' : 'border-transparent text-sage-400'}`}
              >
                验证码登录
              </button>
            </div>

            <form onSubmit={handleLogin} className="mt-4 space-y-4">
              <div>
                <label className="label">账号 / 手机号</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-300" size={18} />
                  <input
                    className="input pl-10"
                    placeholder={role === 'elder' ? '老人账号：elder' : '家属账号：family'}
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                  />
                </div>
              </div>

              {mode === 'password' ? (
                <div>
                  <label className="label">密码</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-300" size={18} />
                    <input
                      type={showPwd ? 'text' : 'password'}
                      className="input pl-10 pr-10"
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600">
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="label">验证码</label>
                  <div className="flex gap-2">
                    <input
                      className="input"
                      placeholder="请输入验证码"
                      value={sms}
                      onChange={(e) => setSms(e.target.value)}
                    />
                    <Button type="button" variant="secondary" size="md" onClick={() => showToast('验证码已发送（模拟）', 'info')}>
                      获取验证码
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer text-sage-600">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded text-sage-600 focus:ring-sage-400" />
                  记住我
                </label>
                <button type="button" onClick={() => showToast('请联系管理员重置密码（模拟）', 'info')} className="text-sage-500 hover:text-sage-700">
                  忘记密码？
                </button>
              </div>

              <Button type="submit" size="lg" loading={loading} className="w-full">
                登录 <ArrowRight size={18} />
              </Button>
            </form>

            {/* Demo accounts hint */}
            <div className="mt-4 p-3 bg-sage-50/60 rounded-xl border border-sage-100">
              <p className="text-xs text-sage-500 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-sage-500" />
                演示账号：老人 <span className="font-mono font-medium text-sage-700">elder / 123456</span>　家属 <span className="font-mono font-medium text-sage-700">family / 123456</span>
              </p>
            </div>

            <p className="mt-5 text-center text-sm text-sage-500">
              还没有账号？{' '}
              <Link to="/register" className="text-sage-700 font-medium hover:underline">注册账号</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
