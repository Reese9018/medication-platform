import { useState, useMemo } from 'react';
import {
  Activity, Plus, HeartPulse, Droplet, Gauge, Sparkles, TrendingUp,
  TrendingDown, AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';
import {
  LineChart, Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SectionTitle, StatPill } from '@/components/ui/Common';
import { HealthCalendar } from '@/components/HealthCalendar';
import type { HealthRecord } from '@/types';
import { cn, getBloodPressureStatus, getBloodSugarStatus, getHeartRateStatus } from '@/lib/utils';

export function HealthDataPage() {
  const { healthRecords, addHealthRecord, showToast } = useApp();
  const [range, setRange] = useState<'7' | '30'>('7');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ systolic: 130, diastolic: 82, bloodSugar: 6.0, heartRate: 75 });
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  // 确保健康记录按时间正序排列（从早到晚）
  const sortedRecords = useMemo(() => {
    return [...healthRecords].sort((a, b) => {
      const ta = `${a.date}T${a.time}`;
      const tb = `${b.date}T${b.time}`;
      return ta.localeCompare(tb);
    });
  }, [healthRecords]);

  const data = useMemo(() => {
    // 取最近7条作为基础数据（已按时间正序）
    const base = sortedRecords.slice(-7);
    if (range === '7') {
      return base.map((r) => ({ date: r.date.slice(5), systolic: r.systolic, diastolic: r.diastolic, bloodSugar: r.bloodSugar, heartRate: r.heartRate }));
    }
    // 30天模式：从29天前到今天正序生成
    const extended: { date: string; systolic: number; diastolic: number; bloodSugar: number; heartRate: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const r = base[i % base.length];
      const d = new Date(); d.setDate(d.getDate() - i);
      extended.push({
        date: d.toISOString().slice(5, 10),
        systolic: r.systolic + Math.round((Math.random() - 0.5) * 6),
        diastolic: r.diastolic + Math.round((Math.random() - 0.5) * 4),
        bloodSugar: +(r.bloodSugar + (Math.random() - 0.5) * 0.6).toFixed(1),
        heartRate: r.heartRate + Math.round((Math.random() - 0.5) * 6),
      });
    }
    return extended;
  }, [sortedRecords, range]);

  // 最新一条记录（sortedRecords 已正序，最后一条即最新）
  const latest = sortedRecords[sortedRecords.length - 1];
  const avg = (key: keyof typeof data[0]) => Math.round(data.reduce((s, d) => s + (d[key] as number), 0) / data.length);

  const handleAdd = () => {
    const now = new Date();
    const rec: HealthRecord = {
      id: `h_${Date.now()}`,
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      systolic: form.systolic, diastolic: form.diastolic,
      bloodSugar: form.bloodSugar, heartRate: form.heartRate,
    };
    addHealthRecord(rec);
    setAddOpen(false);
    showToast('健康数据已记录');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <SectionTitle
        title="健康数据"
        subtitle="记录与追踪您的血压、血糖与心率"
        icon={<Activity size={22} />}
        right={
          <div className="flex gap-2">
            <div className="flex p-1 bg-cream-100 rounded-xl">
              {(['7', '30'] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)}
                  className={cn('px-3.5 py-1.5 rounded-lg text-sm transition', range === r ? 'bg-white text-sage-800 shadow-soft font-medium' : 'text-sage-500')}>
                  {r} 天
                </button>
              ))}
            </div>
            <Button icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>录入数据</Button>
          </div>
        }
      />

      {/* Latest metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          icon={<HeartPulse size={20} />}
          label="最近血压"
          value={`${latest.systolic}/${latest.diastolic}`}
          unit="mmHg"
          statusResult={getBloodPressureStatus(latest.systolic, latest.diastolic)}
        />
        <MetricCard
          icon={<Droplet size={20} />}
          label="最近血糖"
          value={latest.bloodSugar}
          unit="mmol/L"
          statusResult={getBloodSugarStatus(latest.bloodSugar)}
        />
        <MetricCard
          icon={<Gauge size={20} />}
          label="最近心率"
          value={latest.heartRate}
          unit="次/分"
          statusResult={getHeartRateStatus(latest.heartRate)}
        />
      </div>

      {/* 上传记录日历：查看哪天有数据 */}
      <HealthCalendar records={healthRecords} selected={selectedDate} onSelect={setSelectedDate} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="血压趋势" subtitle={`近 ${range} 天 · 平均 ${avg('systolic')}/${avg('diastolic')} mmHg`} icon={<HeartPulse size={18} />} />
          <div className="px-5 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sysGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4A8265" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#4A8265" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCEBE3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8FBCA4' }} axisLine={false} tickLine={false} interval={range === '30' ? 4 : 0} />
                <YAxis tick={{ fontSize: 11, fill: '#8FBCA4' }} axisLine={false} tickLine={false} domain={[50, 160]} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #DCEBE3', fontSize: 12 }} />
                <ReferenceLine y={140} stroke="#D2624A" strokeDasharray="4 4" label="高血压线" />
                <Area type="monotone" dataKey="systolic" stroke="#4A8265" strokeWidth={2} fill="url(#sysGrad)" name="收缩压" />
                <Line type="monotone" dataKey="diastolic" stroke="#82BDD8" strokeWidth={2} dot={false} name="舒张压" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mx-5 mb-5 mt-2 flex items-center gap-2 text-xs text-sage-500 bg-sage-50/60 rounded-lg px-3 py-2 border border-sage-100">
            <Info size={13} className="text-sage-500 shrink-0" />
            <span>正常范围：收缩压 <b className="text-sage-700">90~139</b> / 舒张压 <b className="text-sage-700">60~89</b> mmHg，超过 140/90 为偏高</span>
          </div>
        </Card>

        <Card>
          <CardHeader title="血糖趋势" subtitle={`近 ${range} 天 · 平均 ${(data.reduce((s, d) => s + d.bloodSugar, 0) / data.length).toFixed(1)} mmol/L`} icon={<Droplet size={18} />} />
          <div className="px-5 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCEBE3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8FBCA4' }} axisLine={false} tickLine={false} interval={range === '30' ? 4 : 0} />
                <YAxis tick={{ fontSize: 11, fill: '#8FBCA4' }} axisLine={false} tickLine={false} domain={[3, 10]} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #DCEBE3', fontSize: 12 }} />
                <ReferenceLine y={7} stroke="#D49A1E" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="bloodSugar" stroke="#3A85A8" strokeWidth={2} dot={{ r: 3, fill: '#3A85A8' }} name="血糖" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mx-5 mb-5 mt-2 flex items-center gap-2 text-xs text-sage-500 bg-sky-50/60 rounded-lg px-3 py-2 border border-sky-100">
            <Info size={13} className="text-sky-500 shrink-0" />
            <span>正常范围：空腹血糖 <b className="text-sky-700">3.9~6.9</b> mmol/L，达到 7.0 及以上为偏高</span>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="心率趋势" subtitle={`近 ${range} 天 · 平均 ${avg('heartRate')} 次/分`} icon={<Gauge size={18} />} />
          <div className="px-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D2624A" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#D2624A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCEBE3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8FBCA4' }} axisLine={false} tickLine={false} interval={range === '30' ? 4 : 0} />
                <YAxis tick={{ fontSize: 11, fill: '#8FBCA4' }} axisLine={false} tickLine={false} domain={[50, 100]} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #DCEBE3', fontSize: 12 }} />
                <Area type="monotone" dataKey="heartRate" stroke="#D2624A" strokeWidth={2} fill="url(#hrGrad)" name="心率" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mx-5 mb-5 mt-2 flex items-center gap-2 text-xs text-sage-500 bg-coral-50/40 rounded-lg px-3 py-2 border border-coral-100">
            <Info size={13} className="text-coral-500 shrink-0" />
            <span>正常范围：心率 <b className="text-coral-700">60~100</b> 次/分，超过 100 为偏快，低于 60 为偏慢</span>
          </div>
        </Card>
      </div>

      {/* AI trend analysis */}
      <Card className="p-5 bg-gradient-to-br from-sky-50/40 to-cream-50 border-sky-100">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-sky-600" />
          <h3 className="font-semibold text-sage-800">AI 健康趋势分析</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnalysisItem icon={<CheckCircle2 size={16} />} color="text-sage-600" title="当前趋势" text="近 7 天血压整体较稳定，收缩压在 128-142 mmHg 区间波动，控制基本达标。" />
          <AnalysisItem icon={<AlertTriangle size={16} />} color="text-amber-600" title="异常波动" text="最近 3 次晚间血压出现升高趋势（最高 142/88），建议持续关注睡前血压。" />
          <AnalysisItem icon={<Info size={16} />} color="text-sky-600" title="可能原因" text="晚间血压升高可能与饮食盐分摄入、情绪波动或降压药服药时间有关。" />
          <AnalysisItem icon={<TrendingUp size={16} />} color="text-sage-600" title="健康建议" text="建议保持低盐饮食，固定早8点晚8点服药时间，睡前测量血压并记录。" />
        </div>
      </Card>

      {/* Add record modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="录入健康数据" size="md"
        footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>取消</Button><Button onClick={handleAdd}>保存</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">收缩压 (mmHg)</label><input type="number" className="input" value={form.systolic} onChange={(e) => setForm({ ...form, systolic: +e.target.value })} /></div>
          <div><label className="label">舒张压 (mmHg)</label><input type="number" className="input" value={form.diastolic} onChange={(e) => setForm({ ...form, diastolic: +e.target.value })} /></div>
          <div><label className="label">血糖 (mmol/L)</label><input type="number" step="0.1" className="input" value={form.bloodSugar} onChange={(e) => setForm({ ...form, bloodSugar: +e.target.value })} /></div>
          <div><label className="label">心率 (次/分)</label><input type="number" className="input" value={form.heartRate} onChange={(e) => setForm({ ...form, heartRate: +e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}

function MetricCard({ icon, label, value, unit, statusResult }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit: string;
  statusResult: import('@/lib/utils').HealthStatusResult;
}) {
  const StatusIcon = statusResult.status === 'normal' ? CheckCircle2 : statusResult.status === 'high' ? AlertTriangle : Info;
  return (
    <Card className={cn('p-5 border-l-4', statusResult.border)}>
      <div className="flex items-center justify-between">
        <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center', statusResult.bg, statusResult.color)}>
          {icon}
        </div>
        <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border', statusResult.bg, statusResult.color, statusResult.border)}>
          <StatusIcon size={12} /> {statusResult.label}
        </span>
      </div>
      <p className="text-sm text-sage-500 mt-3">{label}</p>
      <p className={cn('text-2xl font-bold mt-1', statusResult.color)}>
        {value} <span className="text-sm font-normal text-sage-400">{unit}</span>
      </p>
      <p className="text-xs text-sage-500 mt-2 leading-relaxed">{statusResult.tip}</p>
    </Card>
  );
}

function AnalysisItem({ icon, color, title, text }: { icon: React.ReactNode; color: string; title: string; text: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/60 border border-sage-100">
      <p className={cn('text-sm font-semibold mb-1 flex items-center gap-1.5', color)}>{icon} {title}</p>
      <p className="text-xs text-sage-600 leading-relaxed">{text}</p>
    </div>
  );
}
