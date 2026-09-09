import { useState, useMemo } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, RotateCcw, Check, X, Circle, AlertTriangle,
  Clock, Info, Settings2, Bell,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import type { Medication } from '@/types';

const WEEK_LABEL = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEK_SHORT = ['一', '二', '三', '四', '五', '六', '日'];

const pad = (n: number) => String(n).padStart(2, '0');
const fmtYMD = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const toDateStr = (d: Date) => fmtYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

type CellStatus = 'taken' | 'missed' | 'pending' | 'future' | 'inactive';

// 过去日期的打卡用确定性伪随机生成（演示数据，刷新不变）
function simTaken(medId: string, dateStr: string): boolean {
  let h = 2166136261;
  const s = `${medId}:${dateStr}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 100 < 88;
}

function describeDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_LABEL[(d.getDay() + 6) % 7]}`;
}

export function MedicationCalendar({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const { medications, schedule, markDose, updateMedication, showToast } = useApp();
  const todayStr = toDateStr(new Date());
  const [offset, setOffset] = useState(0);
  const [cycleMed, setCycleMed] = useState<Medication | null>(null);

  const view = useMemo(() => {
    const base = new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1);
    const y = base.getFullYear();
    const m = base.getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstWeekday = (base.getDay() + 6) % 7; // 周一=0
    const days: { date: string; day: number; weekday: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: fmtYMD(y, m, d), day: d, weekday: (firstWeekday + d - 1) % 7 });
    }
    return { y, m, days };
  }, [offset]);

  // 排序：服用中 > 已暂停 > 已服完
  const meds = useMemo(() => {
    const order = { active: 0, paused: 1, finished: 2 } as const;
    return [...medications].sort((a, b) => order[a.status] - order[b.status] || a.startDate.localeCompare(b.startDate));
  }, [medications]);

  const statusFor = (med: Medication, dateStr: string): CellStatus => {
    if (cmp(dateStr, med.startDate) < 0) return 'inactive';
    if (med.endDate && cmp(dateStr, med.endDate) > 0) return 'inactive';
    if (cmp(dateStr, todayStr) > 0) return 'future';
    if (dateStr === todayStr) {
      const doses = schedule.filter((d) => d.medicationId === med.id);
      if (!doses.length) return med.status === 'active' ? 'pending' : 'inactive';
      if (doses.every((d) => d.status === 'taken')) return 'taken';
      if (doses.some((d) => d.status === 'missed')) return 'missed';
      return 'pending';
    }
    return simTaken(med.id, dateStr) ? 'taken' : 'missed';
  };

  const rangeLabel = (med: Medication) => {
    const start = med.startDate ? med.startDate.slice(5) : '—';
    return med.endDate ? `${start} ~ ${med.endDate.slice(5)}` : `${start} 起 · 长期`;
  };

  const remindLabel = (med: Medication) => {
    const mins = med.remindBeforeMinutes ?? 30;
    return mins > 0 ? `提前 ${mins} 分钟提醒` : '不提醒';
  };

  // 所选日期当天应服用的药品（服用中且在用药周期内）
  const dayMeds = medications.filter(
    (m) => m.status === 'active' && cmp(selected, m.startDate) >= 0 && (!m.endDate || cmp(selected, m.endDate) <= 0),
  );

  const todayDoses = selected === todayStr ? schedule : [];

  const handleMark = (id: string, status: 'taken' | 'missed') => {
    markDose(id, status);
    showToast(status === 'taken' ? '已记录服药' : '已标记为漏服', status === 'taken' ? 'success' : 'info');
  };

  const handleCycleSave = (id: string, patch: Partial<Medication>) => {
    updateMedication(id, patch);
    showToast('用药周期已更新');
    setCycleMed(null);
  };

  return (
    <Card className="overflow-hidden">
      {/* 头部：标题 + 月份切换 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-sage-100">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-sage-600" />
          <h3 className="font-semibold text-sage-800">服药打卡日历</h3>
          <span className="text-xs text-sage-400">点击日期查看当日用药</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="p-1.5 rounded-lg text-sage-500 hover:bg-sage-100 hover:text-sage-700 transition"
            aria-label="上个月"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-sage-700 w-24 text-center select-none">{view.y}年{view.m}月</span>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="p-1.5 rounded-lg text-sage-500 hover:bg-sage-100 hover:text-sage-700 transition"
            aria-label="下个月"
          >
            <ChevronRight size={16} />
          </button>
          {offset !== 0 && (
            <button
              onClick={() => setOffset(0)}
              className="ml-1 inline-flex items-center gap-1 text-xs text-sage-600 hover:bg-sage-100 px-2 py-1 rounded-lg transition"
            >
              <RotateCcw size={13} /> 回到今天
            </button>
          )}
        </div>
      </div>

      {/* 大日期表：行=药品，列=日期 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-cream-50 text-left px-3 py-2 border-b border-r border-sage-100 min-w-[12.5rem]">
                <span className="text-xs font-semibold text-sage-600">药品（点击 ⚙ 调整周期/提醒）</span>
              </th>
              {view.days.map((d) => {
                const isToday = d.date === todayStr;
                const isSel = d.date === selected;
                return (
                  <th
                    key={d.date}
                    onClick={() => onSelect(d.date)}
                    className={cn(
                      'px-0 py-1.5 text-center border-b border-sage-100 w-9 cursor-pointer transition select-none',
                      d.weekday >= 5 && 'bg-cream-50',
                      isToday && 'bg-sage-600 text-white',
                      !isToday && isSel && 'bg-sage-100 text-sage-800',
                    )}
                  >
                    <div className="text-[10px] leading-tight opacity-70">{WEEK_SHORT[d.weekday]}</div>
                    <div className="text-xs font-semibold leading-tight">{d.day}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {meds.map((med) => (
              <tr key={med.id}>
                <td className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-r border-sage-100 min-w-[12.5rem]">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-sage-800 truncate">{med.name}</p>
                      <p className="text-[11px] text-sage-400 mt-0.5 truncate">
                        {rangeLabel(med)} · <Bell size={9} className="inline" /> {remindLabel(med)}
                      </p>
                    </div>
                    <button
                      onClick={() => setCycleMed(med)}
                      className="p-1.5 rounded-lg text-sage-400 hover:text-sage-700 hover:bg-sage-50 transition shrink-0"
                      title="调整停药日期与提醒"
                    >
                      <Settings2 size={14} />
                    </button>
                  </div>
                </td>
                {view.days.map((d) => {
                  const status = statusFor(med, d.date);
                  const isToday = d.date === todayStr;
                  const isSel = d.date === selected;
                  return (
                    <td
                      key={d.date}
                      onClick={() => onSelect(d.date)}
                      className={cn(
                        'text-center border-b border-sage-50 cursor-pointer transition h-9',
                        isToday && 'bg-sage-50/70',
                        !isToday && isSel && 'bg-sage-50',
                      )}
                      title={`${d.date} · ${med.name}`}
                    >
                      <CellIcon status={status} today={isToday} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2.5 text-[11px] text-sage-500 border-t border-sage-100 bg-cream-50/40">
        <LegendDot className="bg-sage-500" label="已服" />
        <LegendDot className="bg-coral-500" label="漏服" />
        <LegendDot className="border border-sky-300 bg-sky-50" label="待服" />
        <LegendDot className="border border-dashed border-sage-300 bg-transparent" label="未来计划" />
        <span className="text-sage-300">–</span><span>未开始 / 已结束</span>
        <span className="ml-auto inline-flex items-center gap-1 text-sage-300">
          <Info size={12} /> 历史打卡为演示记录，今天以实际记录为准
        </span>
      </div>

      {/* 所选日期：当天应服药品 */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-sage-800 flex items-center gap-2">
            {describeDate(selected)}
            {selected === todayStr && <Badge level="neutral">今天</Badge>}
            {cmp(selected, todayStr) > 0 && <Badge level="info">未来计划</Badge>}
          </h4>
          <span className="text-xs text-sage-400">
            {selected === todayStr ? `${todayDoses.length} 条服药安排` : `预期 ${dayMeds.length} 种药品`}
          </span>
        </div>

        {selected === todayStr ? (
          todayDoses.length === 0 ? (
            <p className="text-sm text-sage-400 py-4 text-center">今日暂无服药安排</p>
          ) : (
            <div className="space-y-2">
              {todayDoses.map((dose) => {
                const med = medications.find((m) => m.id === dose.medicationId);
                const cfg = {
                  taken: { label: '已服', cls: 'text-sage-600 bg-sage-100 border-sage-300', icon: Check },
                  pending: { label: '待服', cls: 'text-sky-600 bg-sky-50 border-sky-200', icon: Circle },
                  missed: { label: '漏服', cls: 'text-coral-600 bg-coral-50 border-coral-200', icon: AlertTriangle },
                }[dose.status];
                const Icon = cfg.icon;
                return (
                  <div key={dose.id} className="flex items-center gap-3 p-3 rounded-xl bg-cream-50/40 border border-sage-50 hover:border-sage-200 transition">
                    <span className={cn('inline-flex items-center justify-center w-8 h-8 rounded-full border shrink-0', cfg.cls)}>
                      <Icon size={15} strokeWidth={2.5} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-sage-800">{dose.medicationName}</p>
                      <p className="text-xs text-sage-500 flex items-center gap-1">
                        <Clock size={11} /> {dose.time} · {dose.dosage} · {dose.usage}
                      </p>
                      {med && med.remindBeforeMinutes ? (
                        <p className="text-[11px] text-sky-600 flex items-center gap-1 mt-0.5">
                          <Bell size={10} /> {dose.time} 前 {med.remindBeforeMinutes} 分钟发送提醒消息
                        </p>
                      ) : null}
                    </div>
                    <span className={cn('badge border', cfg.cls)}>{cfg.label}</span>
                    {dose.status === 'pending' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMark(dose.id, 'taken')}
                          className="p-1.5 rounded-lg text-sage-600 hover:bg-sage-100 transition"
                          title="确认已服"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          onClick={() => handleMark(dose.id, 'missed')}
                          className="p-1.5 rounded-lg text-coral-600 hover:bg-coral-50 transition"
                          title="标记漏服"
                        >
                          <AlertTriangle size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : dayMeds.length === 0 ? (
          <p className="text-sm text-sage-400 py-4 text-center">当日无在服药品</p>
        ) : (
          <div className="space-y-2">
            {dayMeds.map((med) => {
              const past = cmp(selected, todayStr) < 0;
              const taken = past && simTaken(med.id, selected);
              return (
                <div key={med.id} className="flex items-center gap-3 p-3 rounded-xl bg-cream-50/40 border border-sage-50">
                  <span className={cn(
                    'inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0',
                    past ? (taken ? 'bg-sage-100 text-sage-600' : 'bg-coral-50 text-coral-600') : 'bg-sky-50 text-sky-600',
                  )}>
                    {past ? (taken ? <Check size={15} strokeWidth={2.5} /> : <X size={15} strokeWidth={2.5} />) : <Circle size={13} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sage-800">{med.name}</p>
                    <p className="text-xs text-sage-500">
                      {med.times.join('、')} · {med.dosage} · 每日 {med.frequencyPerDay} 次
                    </p>
                    {past ? null : (
                      <p className="text-[11px] text-sky-600 flex items-center gap-1 mt-0.5">
                        <Bell size={10} /> 提前 {med.remindBeforeMinutes ?? 30} 分钟发提醒消息
                      </p>
                    )}
                  </div>
                  {past ? (
                    <span className={cn('badge border shrink-0', taken ? 'text-sage-600 bg-sage-100 border-sage-300' : 'text-coral-600 bg-coral-50 border-coral-200')}>
                      {taken ? '已服' : '漏服'}
                    </span>
                  ) : (
                    <span className="badge border text-sky-600 bg-sky-50 border-sky-200 shrink-0">计划</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 用药周期/提醒调整弹窗 */}
      <MedicationCycleModal
        med={cycleMed}
        open={!!cycleMed}
        onClose={() => setCycleMed(null)}
        onSave={handleCycleSave}
      />
    </Card>
  );
}

// ============ 用药周期与提醒调整 ============
function MedicationCycleModal({ med, open, onClose, onSave }: {
  med: Medication | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, patch: Partial<Medication>) => void;
}) {
  const [form, setForm] = useState({ startDate: '', endDate: '', remindBeforeMinutes: 30, status: 'active' as Medication['status'] });

  useMemo(() => {
    if (med) setForm({
      startDate: med.startDate,
      endDate: med.endDate || '',
      remindBeforeMinutes: med.remindBeforeMinutes ?? 30,
      status: med.status,
    });
  }, [med, open]);

  if (!med) return null;

  return (
    <Modal open={open} onClose={onClose} title={`调整「${med.name}」用药`} subtitle="设置停药日期与提醒，改动立即生效" size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={() => onSave(med.id, {
            startDate: form.startDate,
            endDate: form.endDate || undefined,
            remindBeforeMinutes: form.remindBeforeMinutes,
            status: form.status,
          })}>保存</Button>
        </>
      }>
      <div className="space-y-4">
        <div>
          <label className="label">开始日期</label>
          <input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </div>
        <div>
          <label className="label">停药日期（到几号为止，留空=长期服用）</label>
          <input type="date" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <p className="text-xs text-sage-400 mt-1">超过该日期后，日历中将不再安排此药品。</p>
        </div>
        <div>
          <label className="label">服药提醒（提前多少分钟发消息）</label>
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={120} className="input" value={form.remindBeforeMinutes} onChange={(e) => setForm({ ...form, remindBeforeMinutes: Math.max(0, Math.min(120, Number(e.target.value))) })} />
            <span className="text-sm text-sage-500 whitespace-nowrap">分钟</span>
          </div>
          <p className="text-xs text-sage-400 mt-1">设为 0 表示不提醒。</p>
        </div>
        <div>
          <label className="label">状态</label>
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Medication['status'] })}>
            <option value="active">服用中</option>
            <option value="paused">已暂停</option>
            <option value="finished">已服完</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block w-2.5 h-2.5 rounded-full', className)} />
      {label}
    </span>
  );
}

function CellIcon({ status, today }: { status: CellStatus; today?: boolean }) {
  if (status === 'taken') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sage-500 text-white">
        <Check size={13} strokeWidth={3} />
      </span>
    );
  }
  if (status === 'missed') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-coral-500 text-white">
        <X size={13} strokeWidth={3} />
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className={cn(
        'inline-flex items-center justify-center w-6 h-6 rounded-full border',
        today ? 'border-sky-300 bg-sky-50 text-sky-600' : 'border-sage-200 text-sage-400',
      )}>
        <Circle size={11} />
      </span>
    );
  }
  if (status === 'future') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-sage-300 text-sage-400">
        <Circle size={10} />
      </span>
    );
  }
  return <span className="text-sage-200">–</span>;
}
