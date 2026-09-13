import { useCallback, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldPlus,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/Button';
import { Captcha, type CaptchaHandle } from '@/components/ui/Captcha';

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
  const [smsCountdown, setSmsCountdown] = useState(0);

  // 图形验证码
  const captchaRef = useRef<CaptchaHandle>(null);
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const handleCaptchaChange = useCallback((code: string) => setCaptchaCode(code), []);

  const refreshCaptcha = () => {
    captchaRef.current?.refresh();
    setCaptchaInput('');
  };

  const sendSms = () => {
    if (smsCountdown > 0) return;
    showToast('验证码已发送（演示环境，任意 6 位数字均可登录）', 'info');
    setSmsCountdown(60);
    const timer = window.setInterval(() => {
      setSmsCountdown((v) => {
        if (v <= 1) window.clearInterval(timer);
        return v - 1;
      });
    }, 1000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) { showToast('请输入账号', 'error'); return; }

    if (mode === 'password') {
      if (!password) { showToast('请输入密码', 'error'); return; }
      if (!captchaInput.trim()) { showToast('请输入图形验证码', 'error'); return; }
      // 直接从 ref 读取当前画布真正绘制的验证码（与画面同一次生成，避免 StrictMode 下 state 异步同步导致的不一致）
      const expected = (captchaRef.current?.getCode() ?? captchaCode).toUpperCase();
      const actual = captchaInput.trim().toUpperCase();
      // 验证码一次性使用：无论对错，校验后立即更换，避免被重复猜测
      if (actual !== expected) {
        showToast('图形验证码错误，已刷新，请重新输入', 'error');
        refreshCaptcha();
        return;
      }
    } else if (sms.trim().length < 4) {
      showToast('请输入短信验证码', 'error');
      return;
    }

    setLoading(true);
    try {
      await login(account, password, role);
      showToast('登录成功，欢迎回来');
      navigate(role === 'family' ? '/family' : '/');
    } catch (err: any) {
      const status = err?.response?.status as number | undefined;
      const detail = err?.response?.data?.detail as string | undefined;
      let msg: string;
      // 区分错误类型：网络/CORS/代理异常（502/503）→ 提示后端；HTTP 401 → 密码错；403 → 身份错；422 → 格式错；其余 → 后端具体消息
      if (!err?.response) {
        msg = '无法连接到后端服务。请确认 8000 端口已启动，或运行 npm run dev:all 同时拉起前后端';
      } else if (status === 401) {
        msg = '账号或密码错误，请重试';
      } else if (status === 403) {
        msg = detail || '账号身份与所选端不匹配，请切换后重试';
      } else if (status === 422) {
        msg = '请求格式有误，请刷新页面重试';
      } else if (status === 502 || status === 503) {
        msg = detail || '后端服务暂不可达，请确认已运行 npm run dev:all';
      } else {
        msg = detail || `登录失败（HTTP ${status ?? '未知'}）`;
      }
      showToast(msg, 'error');
      refreshCaptcha();
      setLoading(false);
    }
  };

  // 切换登录身份时同步填入对应的演示账号 / 密码，避免账号字段残留旧端默认值导致登错端
  const selectRole = (next: 'elder' | 'family') => {
    setRole(next);
    setAccount(next);
    setPassword('123456');
  };

  return (
    <div className="min-h-screen flex bg-cream-50">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden bg-gradient-to-br from-sage-900 via-sage-700 to-sage-600 flex-col gap-7 p-12 text-white">
        {/* Decorations */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-sage-200/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-sage-300/15 blur-3xl pointer-events-none" />
        <div className="absolute top-8 right-10 text-white/25 deco-dots"><DotsGrid /></div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sage-400 to-sage-700 flex items-center justify-center shadow-pop ring-1 ring-white/15">
            <ShieldPlus className="text-white" size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">智药护航</h1>
            <p className="text-xs text-sage-200">AI 智能用药管理平台</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative">
          <h2 className="text-4xl font-bold text-white leading-snug">
            AI 守护用药安全<br />让健康管理更简单
          </h2>
          <p className="mt-4 text-sage-200 leading-relaxed">
            智能用药提醒 · 多药风险分析 · 家属远程监护，让每一片药都安心。
          </p>
        </div>

        {/* Hero illustration：撑满剩余高度（设计稿 524×545.22） */}
        <img
          src="/login-hero.jpg"
          alt="长辈在家人陪伴下使用智能药盒"
          className="relative w-full flex-1 min-h-0 object-cover rounded-2xl border border-white/15 shadow-pop"
        />
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
            <p className="text-sm text-sage-400 mt-1">登录您的健康账户</p>

            {/* Role selector */}
            <div className="mt-5 grid grid-cols-2 gap-2 p-1 bg-cream-100 rounded-xl">
              <button
                onClick={() => selectRole('elder')}
                className={`py-2.5 rounded-lg text-sm font-medium transition ${role === 'elder' ? 'bg-white text-sage-800 shadow-soft' : 'text-sage-400'}`}
              >
                老人端
              </button>
              <button
                onClick={() => selectRole('family')}
                className={`py-2.5 rounded-lg text-sm font-medium transition ${role === 'family' ? 'bg-white text-sage-800 shadow-soft' : 'text-sage-400'}`}
              >
                家属端
              </button>
            </div>

            {/* Mode tabs */}
            <div className="mt-4 flex gap-4 text-sm">
              <button
                onClick={() => setMode('password')}
                className={`pb-1 border-b-2 ${mode === 'password' ? 'border-sage-600 text-sage-700 font-medium' : 'border-transparent text-sage-300'}`}
              >
                密码登录
              </button>
              <button
                onClick={() => setMode('sms')}
                className={`pb-1 border-b-2 ${mode === 'sms' ? 'border-sage-600 text-sage-700 font-medium' : 'border-transparent text-sage-300'}`}
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
                <>
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
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600"
                        aria-label={showPwd ? '隐藏密码' : '显示密码'}
                      >
                        {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* 图形验证码 */}
                  <div>
                    <label className="label">图形验证码</label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-300" size={18} />
                        <input
                          className="input pl-10"
                          placeholder="请输入右侧字符"
                          value={captchaInput}
                          maxLength={4}
                          autoComplete="off"
                          onChange={(e) => setCaptchaInput(e.target.value)}
                        />
                      </div>
                      <Captcha ref={captchaRef} onChange={handleCaptchaChange} />
                      <button
                        type="button"
                        onClick={refreshCaptcha}
                        title="换一张"
                        aria-label="换一张验证码"
                        className="w-[46px] h-[46px] shrink-0 rounded-xl border border-sage-200 bg-white text-sage-600 flex items-center justify-center hover:border-sage-300 hover:text-sage-700 transition"
                      >
                        <RefreshCw size={18} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="label">短信验证码</label>
                  <div className="flex gap-2">
                    <input
                      className="input"
                      placeholder="请输入验证码"
                      value={sms}
                      maxLength={6}
                      onChange={(e) => setSms(e.target.value)}
                    />
                    <Button type="button" variant="secondary" size="md" onClick={sendSms} disabled={smsCountdown > 0}>
                      {smsCountdown > 0 ? `${smsCountdown}s 后重发` : '获取验证码'}
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
                <Info size={14} className="text-sage-500 shrink-0" />
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

/** 面板右上角的点阵装饰 */
function DotsGrid() {
  return (
    <svg width="150" height="110" viewBox="0 0 150 110" fill="none" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, r) =>
        Array.from({ length: 5 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={6 + c * 30} cy={6 + r * 24} r="2" fill="currentColor" />
        )),
      )}
    </svg>
  );
}
