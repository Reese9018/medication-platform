import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, CheckCircle2, Clock, AlertTriangle, ShieldAlert,
  Activity, Sparkles, Heart, Pill, Stethoscope, ArrowRight, TrendingUp,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Badge, RiskBadge } from '@/components/ui/Badge';
import { DoseItem } from '@/components/DoseItem';
import { weeklyTrend } from '@/data/mockData';
import { generateRisks } from '@/lib/riskEngine';
import { Blob, HeartPulseIcon, PillIcon, LeafIcon, WaveLine, Dots } from '@/components/ui/Decorations';

const periodMeta = {
  morning: { label: '早晨', emoji: '🌅', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  noon: { label: '午间', emoji: '☀️', color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  evening: { label: '晚间', emoji: '🌆', color: 'text-coral-600', bg: 'bg-coral-50', border: 'border-coral-200' },
  night: { label: '睡前', emoji: '🌙', color: 'text-sage-600', bg: 'bg-sage-50', border: 'border-sage-200' },
};

export function HomePage() {
  const { user, schedule, markDose, healthRecords, showToast, medications } = useApp();
  const navigate = useNavigate();
  const [aiLoading, setAiLoading] = useState(false);

  const stats = useMemo(() => {
    const taken = schedule.filter((d) => d.status === 'taken').length;
    const pending = schedule.filter((d) => d.status === 'pending').length;
    const missed = schedule.filter((d) => d.status === 'missed').length;
    const rate = schedule.length ? Math.round((taken / schedule.length) * 100) : 0;
    return { taken, pending, missed, rate };
  }, [schedule]);

  // 动态生成用药风险（结合用户健康档案 + 用药列表）
  const riskAlerts = useMemo(() => generateRisks(user, medications).alerts, [user, medications]);

  const latest = healthRecords[healthRecords.length - 1];
  const highRisks = riskAlerts.filter((r) => r.level === 'high');
  const midRisks = riskAlerts.filter((r) => r.level === 'mid');

  const handleAiSchedule = () => {
    setAiLoading(true);
    showToast('AI 正在为您生成个性化用药方案…', 'info');
    setTimeout(() => {
      setAiLoading(false);
      showToast('AI 已为您生成新的用药计划');
      navigate('/schedule');
    }, 1800);
  };

  const handleMark = (id: string) => {
    markDose(id, 'taken');
  };

  const periods = (['morning', 'noon', 'evening', 'night'] as const).map((p) => ({
    key: p, ...periodMeta[p], doses: schedule.filter((d) => d.period === p),
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sage-100 via-cream-50 to-sky-50 border border-sage-100 p-7">
        <div className="absolute top-0 right-0 text-sage-200 deco-blob"><Blob className="w-56 h-56" /></div>
        <div className="absolute bottom-2 right-12 text-sky-200 deco-line"><WaveLine className="w-48 h-10" /></div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <p className="text-sage-500 text-sm flex items-center gap-1.5">
              <CalendarDays size={15} /> {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
            <h1 className="font-display text-3xl font-bold text-sage-800 mt-2">您好，{user?.name}</h1>
            <p className="text-sage-600 mt-1.5">今天也要记得按时服药哦</p>
            <div className="mt-3 flex items-center gap-2">
              <Badge level="low"><CheckCircle2 size={14} /> 今日健康状态：良好</Badge>
              {stats.missed > 0 && <Badge level="mid"><AlertTriangle size={14} /> {stats.missed}次漏服</Badge>}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 text-sage-300">
            <HeartPulseIcon className="w-16 h-16" />
            <PillIcon className="w-12 h-12" />
            <LeafIcon className="w-12 h-12" />
          </div>
        </div>
      </div>

      {/* Top stats row — varied visual hierarchy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Completion ring — hero stat */}
        <Card className="lg:row-span-2 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-sage-50/60 to-white">
          <p className="text-sm text-sage-500 mb-3">今日服药完成率</p>
          <ProgressRing value={stats.rate} label={`${stats.rate}%`} sublabel="完成率" size={140} />
          <div className="mt-4 grid grid-cols-3 gap-2 w-full text-center">
            <div className="p-2 rounded-xl bg-sage-50">
              <p className="text-xl font-bold text-sage-700">{stats.taken}</p>
              <p className="text-xs text-sage-500">已服</p>
            </div>
            <div className="p-2 rounded-xl bg-sky-50">
              <p className="text-xl font-bold text-sky-700">{stats.pending}</p>
              <p className="text-xs text-sky-500">待服</p>
            </div>
            <div className="p-2 rounded-xl bg-coral-50">
              <p className="text-xl font-bold text-coral-700">{stats.missed}</p>
              <p className="text-xs text-coral-500">漏服</p>
            </div>
          </div>
        </Card>

        {/* Risk level */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={20} className="text-coral-600" />
              <span className="text-sm font-medium text-sage-700">当前健康风险等级</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-coral-600">中等</span>
            <span className="text-sage-400">风险</span>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-coral-600">高风险 {highRisks.length}</span>
              <div className="flex-1 mx-2 h-1.5 rounded-full bg-cream-100"><div className="h-full rounded-full bg-coral-500" style={{ width: '60%' }} /></div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-amber-600">中风险 {midRisks.length}</span>
              <div className="flex-1 mx-2 h-1.5 rounded-full bg-cream-100"><div className="h-full rounded-full bg-amber-400" style={{ width: '40%' }} /></div>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => navigate('/risk')}>
            查看风险详情 <ArrowRight size={14} />
          </Button>
        </Card>

        {/* Health metrics mini */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={20} className="text-sage-600" />
            <span className="text-sm font-medium text-sage-700">健康指标</span>
          </div>
          <div className="space-y-2.5">
            <MetricRow label="血压" value={`${latest.systolic}/${latest.diastolic}`} unit="mmHg" color="sage" />
            <MetricRow label="血糖" value={latest.bloodSugar} unit="mmol/L" color="sky" />
            <MetricRow label="心率" value={latest.heartRate} unit="次/分" color="coral" />
          </div>
        </Card>
      </div>

      {/* Main grid: schedule + right column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today schedule */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader
              title="今日智能用药计划"
              subtitle="按时间段为您安排，请按时服用"
              icon={<Pill size={18} />}
              action={
                <Button size="sm" onClick={handleAiSchedule} loading={aiLoading}>
                  <Sparkles size={15} /> AI 智能安排
                </Button>
              }
            />
            <div className="px-5 pb-5 space-y-4">
              {periods.map((p) => (
                <div key={p.key} className={`rounded-2xl border ${p.border} ${p.bg} p-3.5`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{p.emoji}</span>
                    <span className={`font-semibold ${p.color}`}>{p.label}</span>
                    <span className="text-xs text-sage-400">· {p.doses.length} 种药品</span>
                  </div>
                  <div className="divide-y divide-sage-50">
                    {p.doses.map((d) => (
                      <DoseItem key={d.id} dose={d} onMark={handleMark} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Risk warning */}
          <Card>
            <CardHeader title="AI 用药风险预警" subtitle="基于您的用药组合实时分析" icon={<ShieldAlert size={18} />} />
            <div className="px-5 pb-5 space-y-2.5">
              {riskAlerts.slice(0, 3).map((r) => (
                <div key={r.id} className="p-3 rounded-xl border border-sage-100 bg-cream-50/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-sage-800">{r.type}</span>
                    <RiskBadge level={r.level} />
                  </div>
                  <p className="text-xs text-sage-500 line-clamp-2">{r.reason}</p>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('/risk')}>
                查看全部风险 <ArrowRight size={14} />
              </Button>
            </div>
          </Card>

          {/* 7-day trend */}
          <Card>
            <CardHeader title="最近 7 天健康趋势" icon={<TrendingUp size={18} />} />
            <div className="px-5 pb-5">
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4A8265" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#4A8265" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DCEBE3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8FBCA4' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#8FBCA4' }} axisLine={false} tickLine={false} domain={[60, 150]} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #DCEBE3', fontSize: 12 }} />
                    <Area type="monotone" dataKey="systolic" stroke="#4A8265" strokeWidth={2} fill="url(#bpGrad)" name="收缩压" />
                    <Line type="monotone" dataKey="diastolic" stroke="#82BDD8" strokeWidth={2} dot={false} name="舒张压" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-sage-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sage-500" /> 收缩压</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-300" /> 舒张压</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, unit, color }: { label: string; value: string | number; unit: string; color: 'sage' | 'sky' | 'coral' }) {
  const colorMap = { sage: 'text-sage-700', sky: 'text-sky-700', coral: 'text-coral-700' };
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-sage-500">{label}</span>
      <span className={`text-lg font-semibold ${colorMap[color]}`}>
        {value} <span className="text-xs text-sage-400 font-normal">{unit}</span>
      </span>
    </div>
  );
}
