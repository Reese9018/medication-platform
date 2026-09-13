import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ChevronRight, Pill, AlertTriangle, HeartPulse,
  CheckCircle2, AlertCircle, User,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useElderOverviews } from './useElderOverviews';
import type { ElderOverview } from '@/lib/api';
import { cn } from '@/lib/utils';

function rateColor(rate: number) {
  if (rate >= 95) return { text: 'text-sage-600', bar: '#4A8265' };
  if (rate >= 80) return { text: 'text-amber-600', bar: '#D49A1E' };
  return { text: 'text-coral-600', bar: '#D2624A' };
}

function initial(name: string) {
  return name?.[0] || '老';
}

export function FamilyHomeView() {
  const { user } = useApp();
  const navigate = useNavigate();
  const { elders, loading, error } = useElderOverviews();

  const todaySummary = useMemo(() => {
    let taken = 0, total = 0, pending = 0;
    elders.forEach((e) => {
      taken += e.today_taken; total += e.today_total;
      pending += e.today_doses.filter((d) => d.status === 'pending').length;
    });
    return { taken, total, pending, rate: total ? Math.round((taken / total) * 100) : 0 };
  }, [elders]);

  // 异常：待确认服药 + 最近血压偏高
  const alerts = useMemo(() => {
    const list: { level: 'danger' | 'warn' | 'info'; category: '用药' | '健康'; title: string; detail: string; time: string }[] = [];
    elders.forEach((e) => {
      e.today_doses.filter((d) => d.status === 'pending').forEach((d) => {
        list.push({ level: 'danger', category: '用药', title: '用药异常', detail: `${e.name} ${d.time} ${d.name} 尚未确认服用`, time: '今天' });
      });
      const latest = e.health_records[0];
      if (latest && latest.systolic >= 140) {
        list.push({ level: 'warn', category: '健康', title: '健康异常', detail: `${e.name} 最新血压 ${latest.systolic}/${latest.diastolic} 偏高`, time: '今天' });
      }
    });
    return list;
  }, [elders]);

  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  if (loading) return <div className="py-20 text-center text-sage-500">正在加载家人数据…</div>;
  if (error) return <div className="py-20 text-center text-coral-600">{error}</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 顶部欢迎区 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sage-800 via-sage-700 to-sage-600 text-white p-7">
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-sage-100/80 text-sm flex items-center gap-1.5"><User size={14} /> {today}</p>
            <h1 className="font-display text-2xl md:text-3xl font-bold mt-2">您好，{user?.name || ''}</h1>
            <p className="text-sage-100/90 mt-1.5 text-sm">正在关注 {elders.length} 位家庭成员</p>
            {alerts.length > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-coral-500/90 text-white text-xs font-medium">
                <AlertCircle size={13} /> {alerts.length} 条需要关注的异常
              </div>
            )}
          </div>
          <button onClick={() => navigate('/family')} className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition" title="消息通知">
            <Bell size={20} />
            {alerts.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-coral-500 text-[10px] font-bold flex items-center justify-center">{alerts.length}</span>}
          </button>
        </div>
      </div>

      {/* 家庭成员健康概览 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-sage-800">家庭成员健康概览</h2>
          <span className="text-xs text-sage-400">数据来自老人端实时同步</span>
        </div>
        {elders.length === 0 ? (
          <Card className="p-8 text-center text-sm text-sage-500">还没有绑定老人，点「我的 → 添加家人」发起绑定。</Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {elders.map((elder) => (
              <ElderOverviewCard key={elder.id} elder={elder} onDetail={() => navigate('/medications')} />
            ))}
          </div>
        )}
      </section>

      {/* 今日用药概览 */}
      <Card>
        <CardHeader title="今日用药概览" subtitle="所有绑定老人的今日完成情况" icon={<Pill size={18} />}
          action={<span className="text-sm text-sage-500">今日总完成率 <b className="text-sage-700">{todaySummary.rate}%</b></span>} />
        <div className="px-5 pb-5 space-y-4">
          {elders.map((elder) => {
            const rc = rateColor(elder.today_rate);
            return (
              <div key={elder.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: elder.avatar_color }}>
                  {initial(elder.name)}
                </div>
                <span className="text-sm font-medium text-sage-700 w-14">{elder.name}</span>
                <div className="flex-1 h-2.5 rounded-full bg-sage-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${elder.today_rate}%`, backgroundColor: rc.bar }} />
                </div>
                <span className={cn('text-sm font-bold w-16 text-right', rc.text)}>{elder.today_taken}/{elder.today_total} 次</span>
              </div>
            );
          })}
          {todaySummary.pending > 0 && (
            <div className="mt-2 pt-3 border-t border-sage-100 space-y-2">
              <p className="text-sm font-medium text-coral-600 flex items-center gap-1.5"><AlertTriangle size={15} /> 待关注</p>
              {elders.flatMap((e) => e.today_doses.filter((d) => d.status === 'pending').map((d) => (
                <div key={`${e.id}-${d.time}`} className="flex items-center justify-between p-3 rounded-xl bg-coral-50/60 border border-coral-100">
                  <span className="text-sm text-sage-700">{e.name} {d.time} {d.name} <span className="text-coral-600">尚未确认服用</span></span>
                  <Button size="sm" variant="secondary" onClick={() => navigate('/medications')}>查看用药详情</Button>
                </div>
              )))}
            </div>
          )}
        </div>
      </Card>

      {/* 异常提醒 */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader title="异常提醒" subtitle="只展示最重要的待处理事项" icon={<Bell size={18} />} />
          <div className="px-5 pb-5 space-y-2.5">
            {alerts.map((n, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-sage-100 bg-cream-50/40">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  n.level === 'danger' ? 'bg-coral-100 text-coral-600' : 'bg-amber-100 text-amber-600')}>
                  {n.category === '健康' ? <HeartPulse size={16} /> : <AlertTriangle size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sage-800">{n.title} <span className="text-xs text-sage-400 font-normal">· {n.time}</span></p>
                  <p className="text-xs text-sage-500 mt-0.5">{n.detail}</p>
                </div>
                <button onClick={() => navigate(n.category === '健康' ? '/health' : '/medications')}
                  className="text-xs text-sage-600 hover:text-sage-800 font-medium shrink-0 mt-1">查看</button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ElderOverviewCard({ elder, onDetail }: { elder: ElderOverview; onDetail: () => void }) {
  const rc = rateColor(elder.today_rate);
  const hasPending = elder.today_doses.some((d) => d.status === 'pending');
  return (
    <button onClick={onDetail} className="text-left group">
      <Card className="p-5 h-full transition group-hover:shadow-card group-hover:-translate-y-0.5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0" style={{ backgroundColor: elder.avatar_color }}>
            {initial(elder.name)}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sage-800">{elder.name}</h3>
            <p className="text-xs text-sage-500">{elder.age} 岁 · {elder.gender}</p>
          </div>
          {hasPending
            ? <Badge level="mid"><AlertTriangle size={12} /> 待服药</Badge>
            : <Badge level="low"><CheckCircle2 size={12} /> 今日用药正常</Badge>}
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-sage-500">今日服药率</span>
            <span className={cn('font-bold', rc.text)}>{elder.today_rate}%</span>
          </div>
          <div className="h-2 rounded-full bg-sage-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${elder.today_rate}%`, backgroundColor: rc.bar }} />
          </div>
          <div className="flex items-center justify-between text-sm pt-1">
            <span className="text-sage-500 flex items-center gap-1"><HeartPulse size={14} className="text-sage-400" /> 血压 {elder.latest_bp}</span>
            <span className="text-sage-400 text-xs flex items-center gap-0.5 group-hover:text-sage-600">查看详情 <ChevronRight size={14} /></span>
          </div>
        </div>
      </Card>
    </button>
  );
}
