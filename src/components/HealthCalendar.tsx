import { useState, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, Clock, HeartPulse, Droplet, Gauge } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, getBloodPressureStatus, getBloodSugarStatus, getHeartRateStatus } from '@/lib/utils';
import type { HealthRecord } from '@/types';

// 把单元格背景/边框按当天记录的「最严重状态」染色
const STATUS_STYLE = {
  normal: { bg: 'bg-sage-100', border: 'border-sage-300', ring: 'bg-sage-500' },
  high:   { bg: 'bg-coral-100', border: 'border-coral-300', ring: 'bg-coral-500' },
  low:    { bg: 'bg-sky-100',   border: 'border-sky-300',   ring: 'bg-sky-500'   },
} as const;

const STATUS_LABEL = { normal: '正常', high: '偏高', low: '偏低' } as const;
type Status = keyof typeof STATUS_STYLE;

function worstStatusOf(records: HealthRecord[]): Status {
  // 严重度：high > low > normal；任何一条记录偏高就算偏高
  const hasHigh = records.some((r) =>
    getBloodPressureStatus(r.systolic, r.diastolic).status === 'high' ||
    getBloodSugarStatus(r.bloodSugar).status === 'high' ||
    getHeartRateStatus(r.heartRate).status === 'high',
  );
  if (hasHigh) return 'high';
  const hasLow = records.some((r) =>
    getBloodPressureStatus(r.systolic, r.diastolic).status === 'low' ||
    getBloodSugarStatus(r.bloodSugar).status === 'low' ||
    getHeartRateStatus(r.heartRate).status === 'low',
  );
  if (hasLow) return 'low';
  return 'normal';
}

const WEEK_LABEL = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEK_SHORT = ['一', '二', '三', '四', '五', '六', '日'];

const pad = (n: number) => String(n).padStart(2, '0');
const fmtYMD = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const toDateStr = (d: Date) => fmtYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());

function describeDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK_LABEL[(d.getDay() + 6) % 7]}`;
}

export function HealthCalendar({ records, selected, onSelect }: {
  records: HealthRecord[];
  selected: string;
  onSelect: (d: string) => void;
}) {
  const todayStr = toDateStr(new Date());
  const [offset, setOffset] = useState(0);

  const view = useMemo(() => {
    const base = new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1);
    const y = base.getFullYear();
    const m = base.getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstWeekday = (base.getDay() + 6) % 7; // 周一=0
    const days: { date: string; day: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: fmtYMD(y, m, d), day: d });
    }
    return { y, m, days, firstWeekday };
  }, [offset]);

  // 按日期分组
  const byDate = useMemo(() => {
    const map = new Map<string, HealthRecord[]>();
    records.forEach((r) => {
      const arr = map.get(r.date) ?? [];
      arr.push(r);
      map.set(r.date, arr);
    });
    return map;
  }, [records]);

  const monthStats = useMemo(() => {
    const prefix = `${view.y}-${pad(view.m)}`;
    const inMonth = records.filter((r) => r.date.slice(0, 7) === prefix);
    return { days: new Set(inMonth.map((r) => r.date)).size, count: inMonth.length };
  }, [records, view]);

  // 所选日期的记录，按时间正序排列（从早到晚）
  const selectedRecords = useMemo(() => {
    const recs = byDate.get(selected) ?? [];
    return [...recs].sort((a, b) => a.time.localeCompare(b.time));
  }, [byDate, selected]);

  return (
    <Card className="overflow-hidden">
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-sage-100">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-sage-600" />
          <h3 className="font-semibold text-sage-800">上传记录日历</h3>
          <Badge level="neutral">{monthStats.days} 天有数据</Badge>
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

      {/* 日历网格 */}
      <div className="px-5 pt-3">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEK_SHORT.map((w) => (
            <div key={w} className="text-center text-xs text-sage-400 py-1">{w}</div>
          ))}
          {Array.from({ length: view.firstWeekday }).map((_, i) => <div key={`blank-${i}`} />)}
          {view.days.map((d) => {
            const recs = byDate.get(d.date);
            const has = !!recs?.length;
            const latest = recs?.[recs.length - 1];
            const isToday = d.date === todayStr;
            const isSel = d.date === selected;
            const status: Status = has ? worstStatusOf(recs!) : 'normal';
            const style = STATUS_STYLE[status];
            const extra = has ? recs!.length - 1 : 0;
            return (
              <button
                key={d.date}
                onClick={() => onSelect(d.date)}
                className={cn(
                  'relative aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition border text-xs',
                  // 选中态优先
                  isSel
                    ? 'bg-sage-600 text-white border-sage-600 shadow-soft ring-2 ring-sage-300'
                    // 有数据：按状态染色
                    : has
                      ? cn(style.bg, style.border, 'border-2 text-sage-800 hover:shadow-soft')
                      // 无数据：虚线占位，悬停提示可点击
                      : 'border border-dashed border-sage-200 text-sage-300 hover:bg-sage-50/60 hover:text-sage-500',
                  // 今天：有数据时再加一圈强调，无数据时显示蓝色环
                  isToday && !isSel && has && 'ring-2 ring-amber-300 ring-offset-1',
                  isToday && !isSel && !has && 'ring-1 ring-sky-300',
                )}
              >
                <span className={cn(
                  'text-sm font-semibold leading-none',
                  isSel ? 'text-white' : has ? 'text-sage-800' : 'text-sage-300',
                )}>{d.day}</span>
                {has && latest ? (
                  <span className={cn(
                    'text-[10px] leading-none mt-0.5 font-medium',
                    isSel ? 'text-white/90' : 'text-sage-700',
                  )}>
                    {latest.systolic}/{latest.diastolic}
                  </span>
                ) : (
                  <span className="mt-0.5 block w-1.5 h-1.5 rounded-full bg-transparent" />
                )}
                {has && (
                  <>
                    {/* 状态色点：有数据格子的右上角，按状态着色 */}
                    <span className={cn(
                      'absolute top-1 right-1 w-2 h-2 rounded-full ring-2 ring-white',
                      isSel ? 'bg-white' : style.ring,
                    )} />
                    {/* 多条记录 +N 徽标 */}
                    {extra > 0 && (
                      <span className={cn(
                        'absolute bottom-0.5 right-1 text-[9px] leading-none px-1 rounded-full font-semibold',
                        isSel ? 'bg-white/90 text-sage-700' : 'bg-white/90 text-sage-600 shadow-sm',
                      )}>
                        +{extra}
                      </span>
                    )}
                  </>
                )}
                {/* 今天的小标签 */}
                {isToday && (
                  <span className={cn(
                    'absolute -top-1 left-1 text-[8px] leading-none px-1 rounded-full font-bold',
                    isSel ? 'bg-white text-sage-700' : 'bg-amber-400 text-white',
                  )}>今</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 pb-1 text-[11px] text-sage-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-sage-100 border-2 border-sage-300" /> 全部正常
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-coral-100 border-2 border-coral-300" /> 数据偏高
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-sky-100 border-2 border-sky-300" /> 数据偏低
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full border border-dashed border-sage-300 bg-white" /> 未上传
          </span>
        </div>
      </div>

      {/* 所选日期明细 */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-sage-800 flex items-center gap-2">
            {describeDate(selected)}
            {selected === todayStr && <Badge level="neutral">今天</Badge>}
          </h4>
          <span className="text-xs text-sage-400">
            {selectedRecords.length > 0 ? `${selectedRecords.length} 条记录` : '无记录'}
          </span>
        </div>

        {selectedRecords.length === 0 ? (
          <p className="text-sm text-sage-400 py-6 text-center border border-dashed border-sage-100 rounded-xl">
            该日未上传健康数据
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {selectedRecords.map((r) => (
              <div key={r.id} className="p-3 rounded-xl bg-cream-50/60 border border-sage-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-sage-500 flex items-center gap-1">
                    <Clock size={12} /> {r.time}
                  </span>
                  {r.note && (
                    <span className="text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">{r.note}</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat icon={<HeartPulse size={12} />} label="血压" value={`${r.systolic}/${r.diastolic}`} unit="mmHg" statusResult={getBloodPressureStatus(r.systolic, r.diastolic)} />
                  <MiniStat icon={<Droplet size={12} />} label="血糖" value={String(r.bloodSugar)} unit="mmol/L" statusResult={getBloodSugarStatus(r.bloodSugar)} />
                  <MiniStat icon={<Gauge size={12} />} label="心率" value={String(r.heartRate)} unit="次/分" statusResult={getHeartRateStatus(r.heartRate)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function MiniStat({ icon, label, value, unit, statusResult }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  statusResult?: import('@/lib/utils').HealthStatusResult;
}) {
  const borderCls = statusResult ? statusResult.border : 'border-sage-50';
  const bgCls = statusResult ? statusResult.bg : 'bg-white/70';
  const textCls = statusResult ? statusResult.color : 'text-sage-800';
  return (
    <div className={cn('rounded-lg border py-1.5 text-center', bgCls, borderCls)}>
      <p className="text-[10px] text-sage-400 flex items-center justify-center gap-0.5">{icon}{label}</p>
      <p className={cn('text-[13px] font-semibold mt-0.5', textCls)}>
        {value} <span className="text-[9px] font-normal text-sage-400">{unit}</span>
      </p>
      {statusResult && (
        <p className={cn('text-[9px] mt-0.5 font-medium', statusResult.color)}>{statusResult.label}</p>
      )}
    </div>
  );
}
