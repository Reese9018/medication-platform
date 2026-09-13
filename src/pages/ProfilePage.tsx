import { useState } from 'react';
import {
  FolderHeart, User, Ruler, Weight, Heart, AlertTriangle, Pill,
  Edit2, Sparkles, Save, Activity, ShieldPlus, Calendar,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import type { UserProfile } from '@/types';
import { getRoleAvatarUrl } from '@/lib/utils';

export function ProfilePage() {
  const { user, medications, updateUser, showToast } = useApp();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<UserProfile | null>(null);

  if (!user) return null;
  const activeMeds = medications.filter((m) => m.status === 'active');

  const openEdit = () => { setForm({ ...user }); setEditOpen(true); };
  const handleSave = async () => {
    if (!form) return;
    await updateUser(form);
    setEditOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* ===== 顶部标题横幅 ===== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sage-50 via-cream-50 to-sky-50 border border-sage-100 p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sage-100 text-sage-600">
            <FolderHeart size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sage-800">个人健康档案</h1>
            <p className="text-sm text-sage-500">AI 将根据您的健康档案提供个性化健康建议</p>
          </div>
        </div>
        <Button 
          variant="secondary" 
          icon={<Edit2 size={16} />} 
          onClick={openEdit} 
          className="absolute right-4 top-4"
        >
          编辑档案
        </Button>
      </div>

      {/* ===== 用户信息卡片 ===== */}
      <Card className="p-6 shadow-card border-sage-100">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="w-24 h-24 rounded-full overflow-hidden shadow-card shrink-0 bg-sage-50 ring-2 ring-white">
            <img
              src={getRoleAvatarUrl(user.role, user.gender)}
              alt={`${user.role === 'family' ? '家属' : '老人'}头像`}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-sage-800">{user.name}</h2>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
              <span className="text-sm text-sage-600">{user.age}岁 · {user.gender}</span>
              <Badge level="info" className="text-xs">{user.role === 'family' ? '家属端' : '老人端'}</Badge>
            </div>
            <p className="text-sm text-sage-400 mt-2 flex items-center justify-center sm:justify-start gap-1">
              <Calendar size={14} /> 建档日期：{user.createdAt}
            </p>
          </div>
        </div>
      </Card>

      {/* ===== 健康指标网格 ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={<Ruler size={20} />} label="身高" value={`${user.height} cm`} color="sage" />
        <MetricCard icon={<Weight size={20} />} label="体重" value={`${user.weight} kg`} color="sky" />
        <MetricCard icon={<Activity size={20} />} label="血型" value={user.bloodType} color="coral" />
        <MetricCard icon={<User size={20} />} label="建档日期" value={user.createdAt} color="amber" />
      </div>

      {/* ===== 慢性疾病 + 过敏史 ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-sage-700 flex items-center gap-2 mb-3">
            <Heart size={18} className="text-coral-500" /> 慢性疾病
          </h3>
          <div className="flex flex-wrap gap-2">
            {user.chronicConditions.length > 0 ? (
              user.chronicConditions.map((c) => <Badge key={c} level="mid">{c}</Badge>)
            ) : (
              <span className="text-sm text-sage-400">暂无慢病记录</span>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-sage-700 flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-500" /> 过敏史
          </h3>
          <div className="flex flex-wrap gap-2">
            {user.allergies.length > 0 ? (
              user.allergies.map((a) => <Badge key={a} level="high">{a}</Badge>)
            ) : (
              <span className="text-sm text-sage-400">无已知过敏</span>
            )}
          </div>
        </Card>
      </div>

      {/* ===== 当前用药 ===== */}
      <Card>
        <CardHeader 
          title="当前用药" 
          subtitle={`${activeMeds.length} 种药品服用中`} 
          icon={<Pill size={18} />} 
        />
        <div className="px-5 pb-5 space-y-3">
          {activeMeds.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-4 rounded-xl bg-cream-50/60 border border-sage-100 hover:shadow-soft transition">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sage-800">{m.name}</p>
                <p className="text-xs text-sage-500 truncate">{m.dosage} · 每日{m.frequencyPerDay}次 · {m.purpose}</p>
              </div>
              <Badge level={m.riskLevel === 'high' ? 'high' : m.riskLevel === 'mid' ? 'mid' : 'low'} className="shrink-0 ml-3">
                {m.riskLevel === 'high' ? '高风险' : m.riskLevel === 'mid' ? '中风险' : '低风险'}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* ===== AI 建议 ===== */}
      <Card className="p-5 bg-gradient-to-br from-sage-50/80 to-sky-50/60 border-sage-100 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-sage-100 text-sage-600 shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-sage-800">AI 个性化健康建议</h3>
            <p className="text-sm text-sage-600 mt-1.5 leading-relaxed">
              根据您的健康档案（高血压、2型糖尿病），AI 建议您：保持低盐低糖饮食，每日监测血压血糖；
              规律作息，避免情绪波动；定期复查肾功能与糖化血红蛋白。当前用药方案需关注降糖药联用的低血糖风险。
            </p>
            <p className="text-xs text-sage-400 mt-3">本建议仅供参考，不能替代医生诊断。</p>
          </div>
        </div>
      </Card>

      {/* ===== 紧急联系人 ===== */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <ShieldPlus size={18} className="text-sage-600" />
          <h3 className="font-semibold text-sage-800">紧急联系人</h3>
        </div>
        <p className="text-sm text-sage-600">{user.emergencyContact || '未设置'}</p>
      </Card>

      {/* ===== 编辑弹窗 ===== */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="编辑健康档案" size="lg"
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>取消</Button><Button icon={<Save size={16} />} onClick={handleSave}>保存</Button></>}>
        {form && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">姓名</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">年龄</label><input type="number" className="input" value={form.age} onChange={(e) => setForm({ ...form, age: +e.target.value })} /></div>
            <div><label className="label">性别</label><select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as '男' | '女' })}><option>男</option><option>女</option></select></div>
            <div><label className="label">血型</label><input className="input" value={form.bloodType} onChange={(e) => setForm({ ...form, bloodType: e.target.value })} /></div>
            <div><label className="label">身高 (cm)</label><input type="number" className="input" value={form.height} onChange={(e) => setForm({ ...form, height: +e.target.value })} /></div>
            <div><label className="label">体重 (kg)</label><input type="number" className="input" value={form.weight} onChange={(e) => setForm({ ...form, weight: +e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label">慢性疾病（逗号分隔）</label><input className="input" value={form.chronicConditions.join('，')} onChange={(e) => setForm({ ...form, chronicConditions: e.target.value.split(/[，,]/).map((s) => s.trim()).filter(Boolean) })} /></div>
            <div className="sm:col-span-2"><label className="label">过敏史（逗号分隔）</label><input className="input" value={form.allergies.join('，')} onChange={(e) => setForm({ ...form, allergies: e.target.value.split(/[，,]/).map((s) => s.trim()).filter(Boolean) })} /></div>
            <div className="sm:col-span-2"><label className="label">紧急联系人</label><input className="input" value={form.emergencyContact || ''} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ===== 指标卡片组件 =====
function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: 'sage' | 'sky' | 'coral' | 'amber' }) {
  const colorMap = {
    sage: 'bg-sage-50 text-sage-600',
    sky: 'bg-sky-50 text-sky-600',
    coral: 'bg-coral-50 text-coral-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <Card className="p-4 text-center hover:shadow-card transition">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-sage-800 mt-2">{value}</p>
      <p className="text-sm text-sage-500">{label}</p>
    </Card>
  );
}
