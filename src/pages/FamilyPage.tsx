import { useState } from 'react';
import {
  Users, UserPlus, Link2, Unlink, CheckCircle2, Phone, ShieldPlus,
  Heart, Activity, Pill, Bell, AlertTriangle, ArrowRight, Info,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { SectionTitle } from '@/components/ui/Common';
import { FamilyIcon, Dots } from '@/components/ui/Decorations';
import { elderProfile, todaySchedule, healthRecords, riskAlerts } from '@/data/mockData';
import { cn } from '@/lib/utils';

export function FamilyPage() {
  const { user, familyMembers, bindFamily, unbindFamily, showToast } = useApp();
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  // If family role → show family monitoring view
  if (user?.role === 'family') {
    return <FamilyMonitorView />;
  }

  // Elder view: manage family bindings
  const bound = familyMembers.filter((f) => f.bound);

  const handleInvite = async () => {
    if (!inviteCode.trim()) { showToast('请输入家属账号', 'error'); return; }
    await bindFamily(inviteCode.trim(), '家属');
    setInviteOpen(false);
    setInviteCode('');
    showToast('家属绑定成功');
  };

  const handleUnbind = async (id: string) => {
    await unbindFamily(id);
    showToast('已解除绑定', 'info');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <SectionTitle
        title="家属监护"
        subtitle="邀请家属绑定，让他们远程了解您的健康状态"
        icon={<Users size={22} />}
        right={<Button icon={<UserPlus size={16} />} onClick={() => setInviteOpen(true)}>邀请家属</Button>}
      />

      {/* Banner */}
      <Card className="p-5 bg-gradient-to-r from-sage-50/60 to-sky-50/40 border-sage-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-600 shrink-0">
            <FamilyIcon className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-semibold text-sage-800">即使不在身边，家人也能安心</h3>
            <p className="text-sm text-sage-600 mt-1">绑定家属后，家属可远程查看您的服药情况、健康数据与 AI 风险提醒。</p>
          </div>
        </div>
      </Card>

      {/* Bound family list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {familyMembers.map((f) => (
          <Card key={f.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-semibold" style={{ backgroundColor: f.avatarColor }}>
                  {f.name[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-sage-800">{f.name}</h3>
                  <p className="text-xs text-sage-500">{f.relationship} · {f.phone || '未填写电话'}</p>
                </div>
              </div>
              {f.bound ? <Badge level="low"><CheckCircle2 size={13} /> 已绑定</Badge> : <Badge level="neutral">未绑定</Badge>}
            </div>
            {f.bound ? (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-sage-500 flex items-center gap-1"><Link2 size={13} /> 实时同步健康数据</span>
                <Button size="sm" variant="danger" icon={<Unlink size={14} />} onClick={() => handleUnbind(f.id)}>解除绑定</Button>
              </div>
            ) : (
              <div className="mt-4">
                <Button size="sm" variant="secondary" icon={<UserPlus size={14} />} onClick={() => setInviteOpen(true)}>邀请绑定</Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="邀请家属绑定" size="sm"
        footer={<><Button variant="secondary" onClick={() => setInviteOpen(false)}>取消</Button><Button icon={<Link2 size={16} />} onClick={handleInvite}>发送邀请</Button></>}>
        <div className="space-y-4">
          <p className="text-sm text-sage-600">输入家属的手机号或邀请码，系统将向对方发送绑定邀请。</p>
          <div>
            <label className="label">手机号 / 邀请码</label>
            <input className="input" placeholder="如：138****6789" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
          </div>
          <div className="p-3 bg-sage-50 rounded-xl text-xs text-sage-500 flex gap-2">
            <Info size={14} className="shrink-0 mt-0.5" />
            您的邀请码：<span className="font-mono font-semibold text-sage-700">ZH-2026-WXL</span>（可将此码告知家属）
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============ Family monitoring view ============
function FamilyMonitorView() {
  const navigate = useNavigate();
  const taken = todaySchedule.filter((d) => d.status === 'taken').length;
  const missed = todaySchedule.filter((d) => d.status === 'missed').length;
  const rate = Math.round((taken / todaySchedule.length) * 100);
  const latest = healthRecords[healthRecords.length - 1];
  const highRisks = riskAlerts.filter((r) => r.level === 'high');

  const attentionItems = [
    { level: 'warn', text: `今日 ${missed} 次漏服（氯氮平片）`, icon: AlertTriangle },
    { level: 'warn', text: '前天晚间血压 142/88 mmHg，略有升高', icon: Activity },
    { level: 'danger', text: '格列美脲与阿司匹林联用存在低血糖风险', icon: AlertTriangle },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <SectionTitle
        title="家庭健康中心"
        subtitle="远程了解家人的健康状态"
        icon={<Users size={22} />}
      />

      {/* Elder status banner */}
      <Card className="overflow-hidden">
        <div className="relative p-6 bg-gradient-to-br from-sage-50/60 via-cream-50 to-sky-50/40">
          <div className="absolute top-3 right-6 text-sage-200 deco-dots"><Dots className="w-16 h-16" /></div>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-card" style={{ backgroundColor: elderProfile.avatarColor }}>
              {elderProfile.name[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-sage-800">{elderProfile.name}的健康状态</h2>
                <Badge level="low"><CheckCircle2 size={13} /> 总体良好</Badge>
              </div>
              <p className="text-sm text-sage-500 mt-1">{elderProfile.age}岁 · 高血压 · 2型糖尿病 · 最后更新：今日 08:08</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => navigate('/health')}>查看健康数据</Button>
              <Button size="sm" variant="secondary" onClick={() => navigate('/schedule')}>查看用药记录</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Attention area */}
      <Card className="p-5 border-amber-100 bg-amber-50/30">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={18} className="text-amber-600" />
          <h3 className="font-semibold text-sage-800">需要关注</h3>
        </div>
        <div className="space-y-2">
          {attentionItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className={cn('flex items-center gap-3 p-3 rounded-xl border',
                item.level === 'danger' ? 'bg-coral-50/60 border-coral-200' : 'bg-amber-50/60 border-amber-200')}>
                <Icon size={16} className={item.level === 'danger' ? 'text-coral-600' : 'text-amber-600'} />
                <span className="text-sm text-sage-700">{item.text}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Heart size={18} />} label="服药完成率" value={`${rate}%`} subtext={`已服 ${taken}/${todaySchedule.length}`} color="sage" />
        <StatCard icon={<Pill size={18} />} label="当前药品" value={`${todaySchedule.length}`} subtext="种药品在服" color="sky" onClick={() => navigate('/medications')} />
        <StatCard icon={<Activity size={18} />} label="最近血压" value={`${latest.systolic}/${latest.diastolic}`} subtext="mmHg" color="coral" onClick={() => navigate('/health')} />
        <StatCard icon={<AlertTriangle size={18} />} label="风险提醒" value={`${highRisks.length}`} subtext="项高风险" color="amber" onClick={() => navigate('/risk')} />
      </div>

      {/* Latest health metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="血压" value={`${latest.systolic}/${latest.diastolic}`} unit="mmHg" normal={latest.systolic < 140} />
        <MetricCard label="血糖" value={latest.bloodSugar} unit="mmol/L" normal={latest.bloodSugar < 7} />
        <MetricCard label="心率" value={latest.heartRate} unit="次/分" normal={latest.heartRate < 100} />
      </div>

      {/* AI risk reminders */}
      <Card>
        <CardHeader title="AI 风险提醒" subtitle="基于老人当前用药的智能分析" icon={<ShieldPlus size={18} />}
          action={<Button size="sm" variant="ghost" onClick={() => navigate('/risk')}>查看全部 <ArrowRight size={14} /></Button>} />
        <div className="px-5 pb-5 space-y-2">
          {riskAlerts.filter((r) => r.level !== 'low').slice(0, 3).map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-cream-50/50 border border-sage-50">
              <AlertTriangle size={16} className={r.level === 'high' ? 'text-coral-600' : 'text-amber-600'} />
              <div className="flex-1">
                <p className="text-sm font-medium text-sage-800">{r.type}</p>
                <p className="text-xs text-sage-500">{r.reason}</p>
              </div>
              <Badge level={r.level}>{r.level === 'high' ? '高风险' : '中风险'}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 bg-sage-50/40 border-sage-100">
        <p className="text-xs text-sage-500 flex gap-1.5">
          <Info size={14} className="shrink-0 mt-0.5" />
          本平台提供健康管理辅助信息，不能替代医生诊断和处方。如发现家人健康异常，请及时联系医生。
        </p>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, subtext, color, onClick }: {
  icon: React.ReactNode; label: string; value: string; subtext: string;
  color: 'sage' | 'sky' | 'coral' | 'amber'; onClick?: () => void;
}) {
  const colorMap = {
    sage: 'text-sage-600 bg-sage-50', sky: 'text-sky-600 bg-sky-50',
    coral: 'text-coral-600 bg-coral-50', amber: 'text-amber-600 bg-amber-50',
  };
  return (
    <Card className={cn('p-4', onClick && 'cursor-pointer hover:shadow-card transition')} >
      <button onClick={onClick} className="w-full text-left">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', colorMap[color])}>{icon}</div>
        <p className="text-xs text-sage-500">{label}</p>
        <p className="text-2xl font-bold text-sage-800 mt-1">{value}</p>
        <p className="text-xs text-sage-400 mt-0.5">{subtext}</p>
      </button>
    </Card>
  );
}

function MetricCard({ label, value, unit, normal }: { label: string; value: string | number; unit: string; normal: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-sage-500">{label}</p>
      <p className="text-xl font-bold text-sage-800 mt-1">{value} <span className="text-xs font-normal text-sage-400">{unit}</span></p>
      <p className={cn('text-xs mt-1', normal ? 'text-sage-500' : 'text-coral-600')}>{normal ? '正常范围' : '需关注'}</p>
    </Card>
  );
}
