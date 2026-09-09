import { useState, useMemo } from 'react';
import {
  CalendarClock, Sparkles, Check, Circle, AlertTriangle, Clock, Plus,
  Bell, Trash2, CheckCircle2, Loader,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SectionTitle } from '@/components/ui/Common';
import { MedicationCalendar } from '@/components/MedicationCalendar';
import type { ScheduleDose } from '@/types';
import { cn } from '@/lib/utils';

type PeriodColor = 'amber' | 'sky' | 'coral' | 'sage';

const periodMeta: Record<string, { label: string; emoji: string; time: string; color: PeriodColor }> = {
  morning: { label: '早晨', emoji: '🌅', time: '08:00', color: 'amber' },
  noon: { label: '午间', emoji: '☀️', time: '12:30', color: 'sky' },
  evening: { label: '晚间', emoji: '🌆', time: '20:00', color: 'coral' },
  night: { label: '睡前', emoji: '🌙', time: '22:00', color: 'sage' },
};

const colorMap: Record<PeriodColor, string> = {
  amber: 'border-amber-200 bg-amber-50/50 text-amber-700',
  sky: 'border-sky-200 bg-sky-50/50 text-sky-700',
  coral: 'border-coral-200 bg-coral-50/50 text-coral-700',
  sage: 'border-sage-200 bg-sage-50/50 text-sage-700',
};

const aiSteps = [
  { label: '正在读取健康档案', icon: '📋' },
  { label: '正在分析当前药品', icon: '💊' },
  { label: '正在检查服药时间', icon: '⏰' },
  { label: '正在生成个性化方案', icon: '✨' },
];

function periodFromTime(t: string): ScheduleDose['period'] {
  const h = parseInt(t.slice(0, 2), 10);
  if (h < 11) return 'morning';
  if (h < 14) return 'noon';
  if (h < 21) return 'evening';
  return 'night';
}

// AI 根据药品生成今日完整计划（保留已服/漏服状态，合并为去重的计划）
function buildDraft(medications: ReturnType<typeof useApp>['medications'], schedule: ScheduleDose[]): ScheduleDose[] {
  const result: ScheduleDose[] = [];
  const seen = new Set<string>();
  schedule.forEach((d) => { result.push(d); seen.add(`${d.medicationId}|${d.time}`); });
  let n = 0;
  medications
    .filter((m) => m.status === 'active')
    .forEach((m) => {
      m.times.forEach((t) => {
        if (seen.has(`${m.id}|${t}`)) return;
        result.push({
          id: `d_${Date.now()}_${n++}`,
          medicationId: m.id,
          medicationName: m.name,
          period: periodFromTime(t),
          time: t,
          dosage: m.dosage,
          usage: '口服',
          status: 'pending',
        });
      });
    });
  return result.sort((a, b) => a.time.localeCompare(b.time));
}

export function SchedulePage() {
  const { schedule, markDose, setSchedule, showToast, medications } = useApp();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiStep, setAiStep] = useState(-1);
  const [aiDone, setAiDone] = useState(false);
  const [draft, setDraft] = useState<ScheduleDose[] | null>(null);
  const [addMedId, setAddMedId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  const activeMeds = useMemo(() => medications.filter((m) => m.status === 'active'), [medications]);

  const stats = useMemo(() => {
    const taken = schedule.filter((d) => d.status === 'taken').length;
    const rate = schedule.length ? Math.round((taken / schedule.length) * 100) : 0;
    return { taken, rate, total: schedule.length };
  }, [schedule]);

  const periods = (['morning', 'noon', 'evening', 'night'] as const).map((p) => ({
    key: p, ...periodMeta[p], doses: schedule.filter((d) => d.period === p),
  }));

  const handleAi = () => {
    setAiOpen(true);
    setAiStep(-1);
    setAiDone(false);
    setDraft(null);
    let i = 0;
    const timer = setInterval(() => {
      if (i >= aiSteps.length) {
        clearInterval(timer);
        setAiDone(true);
        // AI 生成可编辑的计划草稿
        setDraft(buildDraft(medications, schedule));
        setAddMedId(activeMeds[0]?.id ?? '');
        return;
      }
      setAiStep(i);
      i++;
    }, 800);
  };

  const updateDraft = (id: string, patch: Partial<ScheduleDose>) => {
    setDraft((prev) => (prev ? prev.map((d) => {
      if (d.id !== id) return d;
      const next = { ...d, ...patch };
      if (patch.time) next.period = periodFromTime(patch.time);
      if (patch.medicationId) {
        const m = activeMeds.find((x) => x.id === patch.medicationId);
        if (m) { next.medicationName = m.name; next.dosage = m.dosage; }
      }
      return next;
    }) : prev));
  };

  const removeDraft = (id: string) => setDraft((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));

  const addDraftDose = () => {
    const med = activeMeds.find((m) => m.id === addMedId) || activeMeds[0];
    if (!med) { showToast('暂无可添加的药品', 'info'); return; }
    const time = '08:00';
    setDraft((prev) => (prev ? [...prev, {
      id: `d_${Date.now()}`,
      medicationId: med.id,
      medicationName: med.name,
      period: periodFromTime(time),
      time,
      dosage: med.dosage,
      usage: '口服',
      status: 'pending',
    }] : prev));
  };

  const handleAiConfirm = () => {
    if (!draft) return;
    setSchedule(draft);
    setAiOpen(false);
    setDraft(null);
    showToast('已采用修改后的用药计划');
  };

  const handleMark = (id: string) => { markDose(id, 'taken'); };
  const handleMissed = (id: string) => { markDose(id, 'missed'); };
  const handleRemove = (id: string) => { setSchedule((prev) => prev.filter((d) => d.id !== id)); showToast('已从计划中移除', 'info'); };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <SectionTitle
        title="我的智能用药计划"
        subtitle="AI 生成后可在弹窗内修改，确认后生效"
        icon={<CalendarClock size={22} />}
        right={<Button icon={<Sparkles size={16} />} onClick={handleAi}>AI 智能安排</Button>}
      />

      {/* 大日期表：服药打卡 + 用药周期 + 点击日期查看 */}
      <MedicationCalendar selected={selectedDate} onSelect={setSelectedDate} />

      {/* Top: completion + summary */}
      <Card className="p-5 flex flex-col sm:flex-row items-center gap-5">
        <ProgressRing value={stats.rate} label={`${stats.rate}%`} sublabel="今日完成率" size={110} />
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
          <SummaryBox label="计划药品" value={stats.total} color="text-sage-700 bg-sage-50" />
          <SummaryBox label="已服药" value={stats.taken} color="text-sage-700 bg-sage-50" />
          <SummaryBox label="待服药" value={schedule.filter((d) => d.status === 'pending').length} color="text-sky-700 bg-sky-50" />
          <SummaryBox label="漏服" value={schedule.filter((d) => d.status === 'missed').length} color="text-coral-700 bg-coral-50" />
        </div>
      </Card>

      {/* Timeline */}
      <div className="relative">
        {/* vertical line */}
        <div className="absolute left-[27px] top-2 bottom-2 w-0.5 bg-sage-100 hidden sm:block" />
        <div className="space-y-5">
          {periods.map((p) => (
            <div key={p.key} className="relative sm:pl-16">
              {/* timeline dot */}
              <div className={cn('absolute left-0 top-1 w-14 h-14 rounded-2xl border flex items-center justify-center hidden sm:flex', colorMap[p.color])}>
                <span className="text-2xl">{p.emoji}</span>
              </div>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:hidden">{p.emoji}</span>
                    <h3 className="font-semibold text-sage-800">{p.label}</h3>
                    <Badge level="neutral"><Clock size={12} /> {p.time}</Badge>
                    <span className="text-xs text-sage-400">· {p.doses.length} 种</span>
                  </div>
                  <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => showToast('请使用「AI 智能安排」添加药品', 'info')}>添加</Button>
                </div>
                <div className="space-y-2">
                  {p.doses.length === 0 && <p className="text-sm text-sage-400 py-2 text-center">暂无药品</p>}
                  {p.doses.map((d) => (
                    <ScheduleRow key={d.id} dose={d} onMark={handleMark} onMissed={handleMissed} onRemove={handleRemove} onRemind={() => showToast('已设置提醒', 'info')} />
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* AI 智能安排弹窗：生成 → 可编辑 → 确认 */}
      <Modal open={aiOpen} onClose={() => setAiOpen(false)} title="AI 智能用药方案生成" size="lg">
        {!aiDone ? (
          <div className="py-4">
            <div className="space-y-4">
              {aiSteps.map((s, i) => {
                const state = i < aiStep ? 'done' : i === aiStep ? 'active' : 'pending';
                return (
                  <div key={s.label} className={cn('flex items-center gap-3 transition', state === 'pending' && 'opacity-40')}>
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0',
                      state === 'done' && 'bg-sage-100 text-sage-600',
                      state === 'active' && 'bg-sage-50 text-sage-600',
                      state === 'pending' && 'bg-cream-100 text-sage-300',
                    )}>
                      {state === 'done' ? <CheckCircle2 size={20} /> : state === 'active' ? <Loader size={20} className="animate-spin-slow" /> : s.icon}
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', state === 'done' ? 'text-sage-700' : 'text-sage-600')}>{s.label}</p>
                      {state === 'active' && <p className="text-xs text-sage-400">分析中…</p>}
                      {state === 'done' && <p className="text-xs text-sage-400">已完成</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : draft ? (
          <div>
            <div className="flex items-center gap-2 p-3 bg-sage-50 rounded-xl mb-3">
              <Sparkles size={16} className="text-sage-600 shrink-0" />
              <span className="text-sm text-sage-700 font-medium">AI 已生成计划，可在下方修改后确认</span>
              <span className="ml-auto text-xs text-sage-400 shrink-0">共 {draft.length} 次服药</span>
            </div>

            <div className="max-h-[42vh] overflow-y-auto pr-1 space-y-3">
              {(['morning', 'noon', 'evening', 'night'] as const).map((p) => {
                const rows = draft.filter((d) => d.period === p);
                if (!rows.length) return null;
                return (
                  <div key={p}>
                    <p className="text-xs font-semibold text-sage-500 mb-1.5 flex items-center gap-1.5">
                      <span>{periodMeta[p].emoji}</span> {periodMeta[p].label}
                      <span className="text-sage-300 font-normal">· {periodMeta[p].time}</span>
                    </p>
                    <div className="space-y-1.5">
                      {rows.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 p-2 rounded-xl border border-sage-100 bg-cream-50/40">
                          <select
                            className="input !py-1.5 !px-2 text-sm min-w-0 flex-1"
                            value={d.medicationId}
                            onChange={(e) => updateDraft(d.id, { medicationId: e.target.value })}
                          >
                            {activeMeds.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                          <input
                            type="time"
                            className="input !py-1.5 !px-2 text-sm w-28"
                            value={d.time}
                            onChange={(e) => updateDraft(d.id, { time: e.target.value })}
                          />
                          <input
                            className="input !py-1.5 !px-2 text-sm w-20"
                            value={d.dosage}
                            onChange={(e) => updateDraft(d.id, { dosage: e.target.value })}
                          />
                          <button
                            onClick={() => removeDraft(d.id)}
                            className="p-1.5 rounded-lg text-coral-500 hover:bg-coral-50 transition shrink-0"
                            title="删除"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 添加一次服药 */}
            <div className="mt-3 flex items-center gap-2">
              <select className="input !py-2 text-sm flex-1" value={addMedId} onChange={(e) => setAddMedId(e.target.value)}>
                {activeMeds.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addDraftDose}>添加一次服药</Button>
            </div>

            <div className="mt-5 flex justify-between gap-2">
              <Button variant="secondary" onClick={() => setAiOpen(false)}>取消</Button>
              <Button icon={<Check size={16} />} onClick={handleAiConfirm}>确认采用</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn('rounded-xl p-3 text-center', color)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

function ScheduleRow({ dose, onMark, onMissed, onRemove, onRemind }: {
  dose: ScheduleDose; onMark: (id: string) => void; onMissed: (id: string) => void; onRemove: (id: string) => void; onRemind: () => void;
}) {
  const cfg = {
    taken: { icon: Check, cls: 'text-sage-600 bg-sage-100 border-sage-300', label: '已服' },
    pending: { icon: Circle, cls: 'text-sky-600 bg-sky-50 border-sky-200', label: '待服' },
    missed: { icon: AlertTriangle, cls: 'text-coral-600 bg-coral-50 border-coral-200', label: '漏服' },
  }[dose.status];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-cream-50/40 border border-sage-50 hover:border-sage-200 transition group">
      <span className={cn('inline-flex items-center justify-center w-8 h-8 rounded-full border shrink-0', cfg.cls)}>
        <Icon size={16} strokeWidth={2.5} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-sage-800">{dose.medicationName}</p>
        <p className="text-xs text-sage-500">{dose.time} · {dose.dosage} · {dose.usage}</p>
      </div>
      <span className={cn('badge border', cfg.cls)}>{cfg.label}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
        {dose.status === 'pending' && (
          <>
            <button onClick={() => onMark(dose.id)} title="确认已服" className="p-1.5 rounded-lg text-sage-600 hover:bg-sage-100"><Check size={15} /></button>
            <button onClick={() => onMissed(dose.id)} title="标记漏服" className="p-1.5 rounded-lg text-coral-600 hover:bg-coral-50"><AlertTriangle size={15} /></button>
            <button onClick={onRemind} title="设置提醒" className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"><Bell size={15} /></button>
          </>
        )}
        <button onClick={() => onRemove(dose.id)} title="移除" className="p-1.5 rounded-lg text-sage-400 hover:bg-sage-50"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}
