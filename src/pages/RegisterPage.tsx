import { useCallback, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldPlus, ShieldCheck, Phone, Lock, User, Users, ArrowLeft,
  CheckCircle2, Eye, EyeOff, RefreshCw, AlertCircle, LogIn, UserPlus, Info,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/Button';
import { Captcha, type CaptchaHandle } from '@/components/ui/Captcha';
import { cn } from '@/lib/utils';

type Role = 'elder' | 'family';

/** 身份选项：老人端 / 家属端各自说清「谁在用、能做什么」，长辈和子女都不会选错 */
const ROLE_OPTIONS: { key: Role; label: string; desc: string; icon: typeof User }[] = [
  { key: 'elder', label: '老人端', desc: '长辈本人使用，字更大、操作更简单', icon: User },
  { key: 'family', label: '家属端', desc: '子女 / 亲属使用，远程查看并管理用药', icon: Users },
];

/** 左侧品牌栏的卖点，注册页只讲「注册后能得到什么」 */
const HIGHLIGHTS = [
  '按时提醒吃药，漏服自动记录',
  '多种药物联用风险自动预警',
  '家属可远程查看用药与健康数据',
];

export function RegisterPage() {
  const { register, showToast } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    phone: '', name: '', password: '', confirm: '',
    role: 'elder' as Role, agree: false,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // 表单级错误：与「字段错误」分开，用于展示后端返回的失败原因（如账号已存在）
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  // 图形验证码（与登录页共用一套 Canvas 验证码组件）
  const captchaRef = useRef<CaptchaHandle>(null);
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const handleCaptchaChange = useCallback((code: string) => setCaptchaCode(code), []);

  const refreshCaptcha = () => {
    captchaRef.current?.refresh();
    setCaptchaInput('');
  };

  const set = (k: string, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
    setFormError('');
  };

  /** 验证码输入框独立一份 state：不能复用上面的 set()（那样会写进 form 对象，输入框读不到值） */
  const setCaptchaValue = (value: string) => {
    setCaptchaInput(value);
    setErrors((e) => ({ ...e, captcha: '' }));
    setFormError('');
  };

  /** 返回错误集合（同时写入 state），便于提交处同步判断，避免读到未更新的 state */
  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^1\d{10}$/.test(form.phone)) e.phone = '请输入有效的11位手机号';
    if (!form.name.trim()) e.name = '请输入姓名或称呼';
    if (form.password.length < 6) e.password = '密码至少 6 位';
    if (form.password.length > 64) e.password = '密码最多 64 位';
    if (!form.confirm) e.confirm = '请再次输入密码';
    else if (form.confirm !== form.password) e.confirm = '两次输入的密码不一致';
    if (!captchaInput.trim()) e.captcha = '请输入图中验证码';
    if (!form.agree) e.agree = '请阅读并同意《用户协议》和《隐私政策》';

    // 图形验证码一次性校验：无论对错都换一张，避免被重复猜测
    if (!e.captcha) {
      const expected = (captchaRef.current?.getCode() ?? captchaCode).toUpperCase();
      if (captchaInput.trim().toUpperCase() !== expected) {
        e.captcha = '验证码不正确，已刷新，请重新输入';
        refreshCaptcha();
      }
    }

    setErrors(e);
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError('');
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      showToast('请完善表单信息', 'error');
      return;
    }

    setLoading(true);
    try {
      await register(form.name.trim(), form.role, form.phone, form.password, form.phone);
      showToast(`注册成功，已自动登录${form.role === 'family' ? '，正在进入家属端' : ''}`);
      navigate(form.role === 'family' ? '/family' : '/');
    } catch (err: any) {
      const status = err?.response?.status as number | undefined;
      const rawDetail = err?.response?.data?.detail;
      const detail = typeof rawDetail === 'string' ? rawDetail : undefined;
      let msg: string;
      // 与登录页同样的错误分层：网络不可达 / 账号冲突 / 格式错 / 其他后端消息
      if (!err?.response) {
        msg = '无法连接到后端服务。请确认 8000 端口已启动，或运行 npm run dev:all 同时拉起前后端';
      } else if (status === 409) {
        msg = detail || '该手机号已注册过，请直接登录或更换手机号';
      } else if (status === 422) {
        msg = '手机号或密码格式不符合要求，请检查后重试';
      } else if (status === 502 || status === 503) {
        msg = detail || '后端服务暂不可达，请确认已运行 npm run dev:all';
      } else {
        msg = detail || `注册失败（HTTP ${status ?? '未知'}）`;
      }
      setFormError(msg);
      showToast(msg, 'error');
      refreshCaptcha();
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-cream-50">
      {/* ===== 左侧品牌栏（参考稿：账号中心 / 注册账号 / 返回上一页） ===== */}
      <aside className="hidden lg:flex lg:w-[42%] shrink-0 lg:h-screen lg:sticky lg:top-0 flex-col justify-between bg-gradient-to-br from-cream-100 via-sage-50 to-cream-50 border-r border-sage-100 p-12">
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-soft ring-1 ring-sage-100 flex items-center justify-center text-sage-600">
              <ShieldPlus size={26} />
            </div>
            <div>
              <p className="text-sm font-medium text-sage-600 tracking-wide">账号中心</p>
              <p className="text-xs text-sage-400">智药护航 · AI 智能用药管理平台</p>
            </div>
          </div>

          <h1 className="font-display text-5xl xl:text-6xl font-bold text-sage-800 mt-12 leading-tight">
            注册账号
          </h1>
          <p className="text-sm text-sage-500 mt-4 leading-relaxed">
            老人端与家属端共用同一个账号体系，
            注册后请选择您的身份，我们据此提供不同的界面与权限。
          </p>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-8 inline-flex items-center gap-2 text-sage-600 hover:text-sage-800 font-medium transition"
          >
            <ArrowLeft size={18} /> 返回上一页
          </button>
        </div>

        <ul className="relative space-y-3">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-sage-600">
              <CheckCircle2 size={18} className="text-sage-500 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* ===== 右侧注册表单 ===== */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-xl">
          {/* 移动端顶部品牌（桌面端由左侧栏承担） */}
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <div className="w-11 h-11 rounded-2xl bg-sage-600 flex items-center justify-center">
              <ShieldPlus className="text-white" size={24} />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-sage-800">智药护航</h1>
              <p className="text-xs text-sage-500">账号中心 · 注册账号</p>
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            {/* 登录 / 注册 切换（参考第二张图：右侧顶部并排按钮） */}
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-sage-200 bg-white px-4 py-2.5 text-sm font-medium text-sage-600 hover:border-sage-300 hover:text-sage-800 transition"
              >
                <LogIn size={16} /> 登录
              </Link>
              <span className="inline-flex items-center gap-2 rounded-xl bg-coral-600 px-4 py-2.5 text-sm font-medium text-white shadow-soft">
                <UserPlus size={16} /> 注册
              </span>
            </div>

            <h2 className="text-xl font-bold text-sage-800 mt-6">创建账户</h2>
            <p className="text-sm text-sage-500 mt-1">填写以下信息，即可开通您的用药管理档案</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {/* 身份选择 */}
              <div>
                <label className="label">身份选择</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ROLE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = form.role === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => set('role', opt.key)}
                        aria-pressed={active}
                        className={cn(
                          'relative text-left rounded-2xl border p-4 transition',
                          active
                            ? 'border-sage-500 bg-sage-50/80 shadow-soft'
                            : 'border-sage-200 bg-white hover:border-sage-300',
                        )}
                      >
                        {active && (
                          <CheckCircle2 size={18} className="absolute right-3 top-3 text-sage-600" />
                        )}
                        <div className="flex items-center gap-2">
                          <span className={cn('p-2 rounded-xl', active ? 'bg-sage-100 text-sage-700' : 'bg-cream-50 text-sage-500')}>
                            <Icon size={18} />
                          </span>
                          <span className={cn('font-medium', active ? 'text-sage-800' : 'text-sage-600')}>
                            {opt.label}
                          </span>
                        </div>
                        <p className="text-xs text-sage-500 mt-2 leading-relaxed">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 用户名（手机号） */}
              <div>
                <label className="label">手机号</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-300" size={18} />
                  <input
                    className="input pl-10"
                    placeholder="请输入 11 位手机号"
                    inputMode="numeric"
                    maxLength={11}
                    autoComplete="username"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                {errors.phone ? (
                  <p className="text-xs text-coral-600 mt-1.5">{errors.phone}</p>
                ) : (
                  <p className="text-xs text-sage-500 mt-1.5">手机号同时作为登录账号，用于接收用药提醒。</p>
                )}
              </div>

              {/* 姓名 */}
              <div>
                <label className="label">姓名 / 称呼</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-300" size={18} />
                  <input
                    className="input pl-10"
                    placeholder="请输入姓名或希望我们称呼您的方式"
                    maxLength={20}
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                  />
                </div>
                {errors.name ? (
                  <p className="text-xs text-coral-600 mt-1.5">{errors.name}</p>
                ) : (
                  <p className="text-xs text-sage-500 mt-1.5">用于首页问候，家属端也会显示该称呼。</p>
                )}
              </div>

              {/* 密码 */}
              <div>
                <label className="label">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-300" size={18} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="input pl-10 pr-20"
                    placeholder="请输入 6-64 位密码"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs font-medium text-sage-600 hover:text-sage-800"
                    aria-label={showPwd ? '隐藏密码' : '显示密码'}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showPwd ? '隐藏' : '显示'}
                  </button>
                </div>
                {errors.password ? (
                  <p className="text-xs text-coral-600 mt-1.5">{errors.password}</p>
                ) : (
                  <p className="text-xs text-sage-500 mt-1.5">密码需为 6-64 位，建议同时包含字母与数字，方便记忆也更安全。</p>
                )}
              </div>

              {/* 确认密码 */}
              <div>
                <label className="label">确认密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-300" size={18} />
                  <input
                    type={showConfirmPwd ? 'text' : 'password'}
                    className="input pl-10 pr-20"
                    placeholder="请再次输入相同密码"
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={(e) => set('confirm', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs font-medium text-sage-600 hover:text-sage-800"
                    aria-label={showConfirmPwd ? '隐藏密码' : '显示密码'}
                  >
                    {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showConfirmPwd ? '隐藏' : '显示'}
                  </button>
                </div>
                {errors.confirm ? (
                  <p className="text-xs text-coral-600 mt-1.5">{errors.confirm}</p>
                ) : (
                  <p className="text-xs text-sage-500 mt-1.5">请再输入一次相同密码，提交前会自动校验。</p>
                )}
              </div>

              {/* 图形验证码 */}
              <div className="rounded-2xl border border-sage-200 bg-sage-50/40 p-4">
                <label className="label">验证码</label>
                <input
                  className="input"
                  placeholder="输入图中字符"
                  maxLength={4}
                  autoComplete="off"
                  value={captchaInput}
                  onChange={(e) => setCaptchaValue(e.target.value)}
                />
                <div className="flex items-center gap-3 mt-3">
                  <Captcha ref={captchaRef} onChange={handleCaptchaChange} />
                  <button
                    type="button"
                    onClick={refreshCaptcha}
                    className="inline-flex items-center gap-2 h-[46px] px-4 rounded-xl border border-sage-200 bg-white text-sm font-medium text-sage-600 hover:border-sage-300 hover:text-sage-800 transition"
                  >
                    <RefreshCw size={16} /> 换一张
                  </button>
                </div>
                {errors.captcha ? (
                  <p className="text-xs text-coral-600 mt-2">{errors.captcha}</p>
                ) : (
                  <p className="text-xs text-sage-500 mt-2 flex items-start gap-1.5">
                    <Info size={14} className="shrink-0 mt-0.5" />
                    验证码用于防止批量注册，看不清可点击图片或「换一张」。不区分大小写。
                  </p>
                )}
              </div>

              {/* 协议 */}
              <div>
                <label className="flex items-start gap-2 cursor-pointer text-sm text-sage-600">
                  <input
                    type="checkbox"
                    checked={form.agree}
                    onChange={(e) => set('agree', e.target.checked)}
                    className="mt-0.5 rounded text-sage-600 focus:ring-sage-400"
                  />
                  <span>
                    我已阅读并同意
                    <button type="button" onClick={(e) => e.preventDefault()} className="text-sage-700 underline mx-1">《用户协议》</button>
                    和
                    <button type="button" onClick={(e) => e.preventDefault()} className="text-sage-700 underline mx-1">《隐私政策》</button>
                  </span>
                </label>
                {errors.agree && <p className="text-xs text-coral-600 mt-1.5">{errors.agree}</p>}
              </div>

              {/* 提交失败提示条（对应参考稿的红色提示条） */}
              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700"
                >
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <Button
                  type="submit"
                  size="lg"
                  loading={loading}
                  icon={<ShieldCheck size={18} />}
                  className="sm:flex-1 bg-coral-600 hover:bg-coral-700 border-coral-600"
                >
                  注册并开始使用
                </Button>
                <Button type="button" variant="secondary" size="lg" onClick={() => navigate('/login')}>
                  先返回
                </Button>
              </div>
            </form>

            <p className="mt-6 text-center text-sm text-sage-500">
              已有账号？{' '}
              <Link to="/login" className="text-sage-700 font-medium hover:underline">返回登录</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
