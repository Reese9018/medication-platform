import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldPlus, Phone, Lock, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/Button';

export function RegisterPage() {
  const { register, showToast } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    phone: '', sms: '', password: '', confirm: '', role: 'elder' as 'elder' | 'family',
    agree: false,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^1\d{10}$/.test(form.phone)) e.phone = '请输入有效的11位手机号';
    if (!form.sms) e.sms = '请输入验证码';
    if (form.password.length < 6) e.password = '密码至少6位';
    if (form.confirm !== form.password) e.confirm = '两次密码不一致';
    if (!form.agree) e.agree = '请阅读并同意协议';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) { showToast('请完善表单信息', 'error'); return; }
    setLoading(true);
    try {
      await register('', form.role, form.phone, form.password, form.phone);
      showToast('注册成功，已自动登录');
      navigate('/');
    } catch {
      showToast('注册失败，账号可能已存在或后端服务未启动', 'error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-sage-50 via-cream-50 to-sky-50">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-11 h-11 rounded-2xl bg-sage-600 flex items-center justify-center">
            <ShieldPlus className="text-white" size={24} />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-sage-800">智药护航</h1>
            <p className="text-xs text-sage-500">AI 智能用药管理平台</p>
          </div>
        </div>

        <div className="card p-7">
          <h2 className="text-2xl font-bold text-sage-800">创建账户</h2>
          <p className="text-sm text-sage-500 mt-1">开启您的智能用药管理之旅</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="label">手机号</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-300" size={18} />
                <input
                  className="input pl-10"
                  placeholder="请输入11位手机号"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </div>
              {errors.phone && <p className="text-xs text-coral-600 mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label className="label">验证码</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="请输入验证码"
                  value={form.sms}
                  onChange={(e) => set('sms', e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={() => showToast('验证码已发送（模拟）', 'info')}>
                  获取验证码
                </Button>
              </div>
              {errors.sms && <p className="text-xs text-coral-600 mt-1">{errors.sms}</p>}
            </div>

            <div>
              <label className="label">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-300" size={18} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pl-10 pr-10"
                  placeholder="至少6位密码"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600">
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-coral-600 mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="label">确认密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-300" size={18} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pl-10"
                  placeholder="请再次输入密码"
                  value={form.confirm}
                  onChange={(e) => set('confirm', e.target.value)}
                />
              </div>
              {errors.confirm && <p className="text-xs text-coral-600 mt-1">{errors.confirm}</p>}
            </div>

            <div>
              <label className="label">身份选择</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-cream-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => set('role', 'elder')}
                  className={`py-2.5 rounded-lg text-sm font-medium transition ${form.role === 'elder' ? 'bg-white text-sage-800 shadow-soft' : 'text-sage-500'}`}
                >
                  老人端
                </button>
                <button
                  type="button"
                  onClick={() => set('role', 'family')}
                  className={`py-2.5 rounded-lg text-sm font-medium transition ${form.role === 'family' ? 'bg-white text-sage-800 shadow-soft' : 'text-sage-500'}`}
                >
                  家属端
                </button>
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer text-sm text-sage-600">
              <input type="checkbox" checked={form.agree} onChange={(e) => set('agree', e.target.checked)} className="mt-0.5 rounded text-sage-600 focus:ring-sage-400" />
              <span>
                我已阅读并同意
                <button type="button" onClick={(e) => e.preventDefault()} className="text-sage-700 underline mx-1">《用户协议》</button>
                和
                <button type="button" onClick={(e) => e.preventDefault()} className="text-sage-700 underline mx-1">《隐私政策》</button>
              </span>
            </label>
            {errors.agree && <p className="text-xs text-coral-600 -mt-2">{errors.agree}</p>}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              注册并登录 <ArrowRight size={18} />
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-sage-500">
            已有账号？{' '}
            <Link to="/login" className="text-sage-700 font-medium hover:underline">返回登录</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
