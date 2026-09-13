import { useState } from 'react';
import {
  Activity, HeartPulse, Droplet, Gauge, TrendingUp, FolderHeart, CheckCircle2, Info,
} from 'lucide-react';
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Card, CardHeader } from '@/components/ui/Card';
import { useElderOverviews } from './useElderOverviews';
import type { ElderOverview } from '@/lib/api';
import { cn } from '@/lib/utils';

type SubTab = 'bp' | 'sugar' | 'hr' | 'trend' | 'profile';

const SUB_TABS: { key: SubTab; label: string; icon: typeof Activity }[] = [
  { key: 'bp', label: '血压', icon: HeartPulse },
  { key: 'sugar', label: '血糖', icon: Droplet },
  { key: 'hr', label: '心率', icon: Gauge },
  { key: 'trend', label: '健康趋势', icon: TrendingUp },
  { key: 'profile', label: '健康档案', icon: FolderHeart },
];

function initial(name: string) { return name?.[0] || '老'; }

export function FamilyHealthView() {
  const { elders, loading, error } = useElderOverviews();
  const [elderId, setElderId] = useState<number | null>(null);
  const [tab, setTab] = useState<SubTab>('bp');

  if (loading) return <div className="py-20 text-center text-sage-500">正在加载健康数据…</div>;
  if (error) return <div className="py-20 text-center text-coral-600">{error}</div>;
  if (elders.length === 0) return <Card className="p-8 text-center text-sm text-sage-500">还没有绑定老人。</Card>;

  const selectedId = elderId ?? elders[0].id;
  const elder = elders.find((e) => e.id === selectedId)!;
  const records = elder.health_records; // 后端已按日期倒序
  const chartData = [...records].reverse(); // 正序画曲线

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-sage-500">正在查看：</span>
        <div className="flex gap-2">
          {elders.map((e) => (
            <button key={e.id} onClick={() => setElderId(e.id)}
              className={cn('px-4 py-2 rounded-xl text-sm font-medium transition border',
                e.id === selectedId ? 'bg-sage-600 text-white border-sage-600 shadow-soft' : 'bg-white text-sage-600 border-sage-200 hover:border-sage-400')}>
              <span className="inline-block w-5 h-5 rounded-md text-white text-xs font-bold text-center mr-1 align-middle" style={{ backgroundColor: e.avatar_color }}>{initial(e.name)}</span>{e.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 border-b border-sage-100 overflow-x-auto">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition',
                tab === t.key ? 'border-sage-600 text-sage-700' : 'border-transparent text-sage-400 hover:text-sage-600')}>
              <span className="inline-flex items-center gap-1.5"><Icon size={15} /> {t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'bp' && <BpTab elder={elder} chartData={chartData} />}
      {tab === 'sugar' && <SugarTab elder={elder} chartData={chartData} />}
      {tab === 'hr' && <HrTab elder={elder} chartData={chartData} />}
      {tab === 'trend' && <TrendTab elder={elder} />}
      {tab === 'profile' && <ProfileTab elder={elder} />}
    </div>
  );
}

type Rec = ElderOverview['health_records'][number];

function BpTab({ elder, chartData }: { elder: ElderOverview; chartData: Rec[] }) {
  const data = chartData.map((r) => ({ date: r.date.slice(5), sys: r.systolic, dia: r.diastolic }));
  const latest = elder.health_records[0];
  return (
    <Card>
      <CardHeader title={`${elder.name} · 血压`} subtitle="来自老人端最近测量记录" icon={<HeartPulse size={18} />} />
      <div className="px-5 pb-5">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold text-sage-800">{elder.latest_bp}</span>
          <span className="text-sage-400">mmHg</span>
          {latest && <span className="text-xs text-sage-400 ml-2">记录时间：{latest.date} {latest.time}</span>}
        </div>
        {data.length === 0 ? <p className="text-sm text-sage-400 py-8 text-center">暂无血压记录</p> : (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id={`famBp_${elder.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4A8265" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#4A8265" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCEBE3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8FBCA4' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8FBCA4' }} axisLine={false} tickLine={false} domain={[50, 160]} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #DCEBE3', fontSize: 12 }} />
                <ReferenceLine y={140} stroke="#D2624A" strokeDasharray="4 4" label={{ value: '高血压线', fontSize: 10, fill: '#D2624A' }} />
                <Area type="monotone" dataKey="sys" stroke="#4A8265" strokeWidth={2} fill={`url(#famBp_${elder.id})`} name="收缩压" />
                <Line type="monotone" dataKey="dia" stroke="#82BDD8" strokeWidth={2} dot={false} name="舒张压" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs text-sage-500 bg-sage-50/60 rounded-lg px-3 py-2 border border-sage-100">
          <Info size={13} className="text-sage-500 shrink-0" />
          <span>正常范围：收缩压 <b className="text-sage-700">90~139</b> / 舒张压 <b className="text-sage-700">60~89</b> mmHg，超过 140/90 为偏高</span>
        </div>
      </div>
    </Card>
  );
}

function SugarTab({ elder, chartData }: { elder: ElderOverview; chartData: Rec[] }) {
  const data = chartData.map((r) => ({ date: r.date.slice(5), value: r.blood_sugar }));
  return (
    <Card>
      <CardHeader title={`${elder.name} · 血糖`} subtitle="最近测量记录" icon={<Droplet size={18} />} />
      <div className="px-5 pb-5">
        <div className="flex items-baseline gap-2 mb-4 p-4 rounded-xl bg-sky-50/60 border border-sky-100">
          <span className="text-3xl font-bold text-sky-700">{elder.latest_sugar ?? '--'}</span>
          <span className="text-sage-400">mmol/L</span>
        </div>
        {data.length === 0 ? <p className="text-sm text-sage-400 py-8 text-center">暂无血糖记录</p> : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCEBE3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8FBCA4' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8FBCA4' }} axisLine={false} tickLine={false} domain={[3, 12]} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #DCEBE3', fontSize: 12 }} />
                <ReferenceLine y={7.0} stroke="#D2624A" strokeDasharray="4 4" label={{ value: '偏高线', fontSize: 10, fill: '#D2624A' }} />
                <Area type="monotone" dataKey="value" stroke="#5B9BD5" strokeWidth={2} fill="#5B9BD522" name="血糖" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs text-sage-500 bg-sky-50/60 rounded-lg px-3 py-2 border border-sky-100">
          <Info size={13} className="text-sky-500 shrink-0" />
          <span>正常范围：空腹血糖 <b className="text-sky-700">3.9~6.9</b> mmol/L，达到 7.0 及以上为偏高</span>
        </div>
      </div>
    </Card>
  );
}

function HrTab({ elder, chartData }: { elder: ElderOverview; chartData: Rec[] }) {
  const data = chartData.map((r) => ({ date: r.date.slice(5), value: r.heart_rate }));
  return (
    <Card>
      <CardHeader title={`${elder.name} · 心率`} subtitle="最近测量记录" icon={<Gauge size={18} />} />
      <div className="px-5 pb-5">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold text-sage-800">{elder.latest_hr ?? '--'}</span>
          <span className="text-sage-400">次/分钟</span>
        </div>
        {data.length === 0 ? <p className="text-sm text-sage-400 py-8 text-center">暂无心率记录</p> : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCEBE3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8FBCA4' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8FBCA4' }} axisLine={false} tickLine={false} domain={[40, 120]} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #DCEBE3', fontSize: 12 }} />
                <ReferenceLine y={100} stroke="#D2624A" strokeDasharray="4 4" label={{ value: '偏快', fontSize: 10, fill: '#D2624A' }} />
                <ReferenceLine y={60} stroke="#E0A95E" strokeDasharray="4 4" label={{ value: '偏慢', fontSize: 10, fill: '#E0A95E' }} />
                <Area type="monotone" dataKey="value" stroke="#D2624A" strokeWidth={2} fill="#D2624A22" name="心率" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs text-sage-500 bg-coral-50/40 rounded-lg px-3 py-2 border border-coral-100">
          <Info size={13} className="text-coral-500 shrink-0" />
          <span>正常范围：心率 <b className="text-coral-700">60~100</b> 次/分，超过 100 为偏快，低于 60 为偏慢</span>
        </div>
      </div>
    </Card>
  );
}

function TrendTab({ elder }: { elder: ElderOverview }) {
  const recs = elder.health_records;
  const high = recs.filter((r) => r.systolic >= 140).length;
  const avgSugar = recs.length ? +(recs.reduce((s, r) => s + r.blood_sugar, 0) / recs.length).toFixed(1) : 0;
  const avgHR = recs.length ? Math.round(recs.reduce((s, r) => s + r.heart_rate, 0) / recs.length) : 0;
  const pendingDoses = elder.today_doses.filter((d) => d.status === 'pending').length;
  return (
    <Card>
      <CardHeader title="健康趋势" subtitle="基于老人端近期数据汇总" icon={<TrendingUp size={18} />} />
      <div className="px-5 pb-5 space-y-2.5">
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-cream-50/40 border border-sage-50">
          <span className="text-sm text-sage-700">血压</span>
          <span className={cn('text-sm font-medium', high > 0 ? 'text-amber-600' : 'text-sage-600')}>
            {high > 0 ? `${high} 次收缩压偏高` : '基本稳定'}
          </span>
        </div>
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-cream-50/40 border border-sage-50">
          <span className="text-sm text-sage-700">血糖（均值）</span>
          <span className="text-sm font-medium text-sage-600">{avgSugar} mmol/L</span>
        </div>
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-cream-50/40 border border-sage-50">
          <span className="text-sm text-sage-700">心率（均值）</span>
          <span className="text-sm font-medium text-sage-600">{avgHR} 次/分</span>
        </div>
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-cream-50/40 border border-sage-50">
          <span className="text-sm text-sage-700">今日用药</span>
          <span className={cn('text-sm font-medium', pendingDoses > 0 ? 'text-amber-600' : 'text-sage-600')}>
            {pendingDoses > 0 ? `${pendingDoses} 次待确认` : '全部完成'}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-sage-50/60 border border-sage-100 mt-3">
          <p className="text-sm text-sage-700 leading-relaxed">
            近 {recs.length} 条健康记录整体较稳定；今日还有 {pendingDoses} 次用药待确认，建议多提醒老人按时服药。
          </p>
          <p className="text-xs text-sage-400 mt-2">* 以上为数据总结与趋势提示，不作为诊断结论。</p>
        </div>
      </div>
    </Card>
  );
}

function ProfileTab({ elder }: { elder: ElderOverview }) {
  return (
    <Card>
      <CardHeader title={`${elder.name} · 健康档案`} subtitle="来自老人端授权共享的资料" icon={<FolderHeart size={18} />} />
      <div className="px-5 pb-5 space-y-1">
        <Row label="姓名" value={elder.name} />
        <Row label="年龄" value={`${elder.age} 岁`} />
        <Row label="性别" value={elder.gender} />
        <Row label="血型" value={elder.blood_type || '未填写'} />
        <Row label="慢病情况" value={elder.chronic_conditions.length ? elder.chronic_conditions.join('、') : '无'} />
        <Row label="过敏信息" value={elder.allergies.length ? elder.allergies.join('、') : '无'} />
        <Row label="紧急联系人" value={elder.emergency_contact || '未填写'} />
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-sage-50 last:border-0">
      <span className="text-sm text-sage-500">{label}</span>
      <span className="text-sm text-sage-800 font-medium flex items-center gap-1.5">
        <CheckCircle2 size={13} className="text-sage-400" /> {value}
      </span>
    </div>
  );
}
