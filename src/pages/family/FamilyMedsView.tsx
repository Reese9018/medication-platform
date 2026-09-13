import { useState } from 'react';
import {
  Pill, Plus, Check, AlertTriangle, Clock, Package, Pencil, ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useApp } from '@/context/AppContext';
import { medicationApi } from '@/lib/api';
import { useElderOverviews } from './useElderOverviews';
import type { ElderOverview } from '@/lib/api';
import { cn } from '@/lib/utils';

type SubTab = 'plan' | 'logs' | 'missed' | 'drugs';

const SUB_TABS: { key: SubTab; label: string; icon: typeof Pill }[] = [
  { key: 'plan', label: '用药计划', icon: Clock },
  { key: 'logs', label: '服药记录', icon: Check },
  { key: 'missed', label: '漏服记录', icon: AlertTriangle },
  { key: 'drugs', label: '药品管理', icon: Package },
];

function initial(name: string) { return name?.[0] || '老'; }

export function FamilyMedsView() {
  const { elders, loading, error, reload } = useElderOverviews();
  const { showToast } = useApp();
  const [elderId, setElderId] = useState<number | null>(null);
  const [tab, setTab] = useState<SubTab>('plan');
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', spec: '', dosage: '1片', frequency: '2', times: '08:00,20:00', category: '其他' });

  if (loading) return <div className="py-20 text-center text-sage-500">正在加载用药数据…</div>;
  if (error) return <div className="py-20 text-center text-coral-600">{error}</div>;
  if (elders.length === 0) return <Card className="p-8 text-center text-sm text-sage-500">还没有绑定老人。</Card>;

  const selectedId = elderId ?? elders[0].id;
  const elder = elders.find((e) => e.id === selectedId)!;

  const resetForm = () => setForm({ name: '', spec: '', dosage: '1片', frequency: '2', times: '08:00,20:00', category: '其他' });

  const handleAdd = async () => {
    if (!form.name.trim()) { showToast('请填写药品名称', 'error'); return; }
    const times = form.times.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean);
    if (times.length === 0) { showToast('请填写服用时间', 'error'); return; }
    setSaving(true);
    try {
      await medicationApi.create({
        name: form.name.trim(),
        genericName: '',
        spec: form.spec,
        dosage: form.dosage,
        purpose: '',
        frequencyPerDay: Number(form.frequency) || 1,
        times,
        status: 'active',
        riskLevel: 'low',
        category: form.category,
        notes: null,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: null,
        remindBeforeMinutes: 30,
        contraindications: [],
        precautions: null,
      });
      showToast('已为老人添加用药计划');
      setAddOpen(false);
      resetForm();
      reload();
    } catch (e: any) {
      showToast(e?.response?.data?.detail || '添加失败，请重试', 'error');
    } finally {
      setSaving(false);
    }
  };

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
        <Badge level="low"><ShieldCheck size={12} /> 可帮老人规划用药</Badge>
      </div>

      <div className="flex gap-2 border-b border-sage-100">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
                tab === t.key ? 'border-sage-600 text-sage-700' : 'border-transparent text-sage-400 hover:text-sage-600')}>
              <span className="inline-flex items-center gap-1.5"><Icon size={15} /> {t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'plan' && <PlanTab elder={elder} onAdd={() => setAddOpen(true)} />}
      {tab === 'logs' && <LogsTab elder={elder} />}
      {tab === 'missed' && <MissedTab elder={elder} />}
      {tab === 'drugs' && <DrugsTab elder={elder} onAdd={() => setAddOpen(true)} />}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={`为${elder.name}添加用药`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>取消</Button><Button loading={saving} onClick={handleAdd}>保存并同步到老人端</Button></>}>
        <div className="space-y-3">
          <div>
            <label className="label">药品名称 *</label>
            <input className="input" placeholder="如：氨氯地平片" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">规格</label>
            <input className="input" placeholder="如：5mg×14片" value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">每次剂量</label>
              <input className="input" placeholder="1片" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} />
            </div>
            <div>
              <label className="label">每日次数</label>
              <input type="number" min={1} max={6} className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">服用时间（用逗号分隔）</label>
            <input className="input" placeholder="如：08:00,20:00" value={form.times} onChange={(e) => setForm({ ...form, times: e.target.value })} />
          </div>
          <div>
            <label className="label">药品分类</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {['降压药','降糖药','心血管药','其他'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PlanTab({ elder, onAdd }: { elder: ElderOverview; onAdd: () => void }) {
  return (
    <Card>
      <CardHeader title={`${elder.name} · 今日用药计划`} subtitle="数据来自老人端今日安排" icon={<Clock size={18} />}
        action={<Button size="sm" icon={<Plus size={14} />} onClick={onAdd}>+添加用药计划</Button>} />
      <div className="px-5 pb-5 space-y-2.5">
        {elder.today_doses.length === 0 && <p className="text-sm text-sage-400 py-4 text-center">今日暂无用药安排</p>}
        {elder.today_doses.map((dose, i) => {
          const done = dose.status === 'taken';
          const pending = dose.status === 'pending';
          return (
            <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-cream-50/40 border border-sage-50">
              <span className="text-sm font-semibold text-sage-500 w-14 shrink-0">{dose.time}</span>
              <span className={cn('inline-flex items-center justify-center w-8 h-8 rounded-full border shrink-0',
                done ? 'bg-sage-100 border-sage-300 text-sage-600'
                  : pending ? 'bg-amber-50 border-amber-300 text-amber-600'
                  : 'bg-coral-50 border-coral-300 text-coral-600')}>
                {done ? <Check size={15} strokeWidth={2.5} /> : pending ? <Clock size={14} /> : <AlertTriangle size={14} />}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-sage-800">{dose.name}</p>
                <p className="text-xs text-sage-400">{dose.dosage}</p>
              </div>
              <button className="p-1.5 rounded-lg text-sage-400 hover:text-sage-700 hover:bg-sage-50" title="编辑"><Pencil size={14} /></button>
              <Badge level={done ? 'low' : pending ? 'mid' : 'danger'}>{done ? '已服用' : pending ? '尚未确认' : '漏服'}</Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function LogsTab({ elder }: { elder: ElderOverview }) {
  const taken = elder.today_doses.filter((d) => d.status === 'taken');
  return (
    <Card>
      <CardHeader title={`${elder.name} · 服药记录`} subtitle="今日已确认的服药记录" icon={<Check size={16} />} />
      <div className="px-5 pb-5 divide-y divide-sage-50">
        {taken.length === 0 ? <p className="text-sm text-sage-400 py-4 text-center">今天还没有已服用记录</p> :
          taken.map((d, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <span className="text-sm font-semibold text-sage-500 w-14">{d.time}</span>
              <Pill size={16} className="text-sage-400" />
              <span className="flex-1 text-sm text-sage-800">{d.name}</span>
              <Badge level="low">已服用</Badge>
            </div>
          ))}
      </div>
    </Card>
  );
}

function MissedTab({ elder }: { elder: ElderOverview }) {
  const missed = elder.today_doses.filter((d) => d.status === 'missed');
  const pending = elder.today_doses.filter((d) => d.status === 'pending');
  return (
    <div className="space-y-4">
      {missed.length === 0 && pending.length === 0 ? (
        <Card className="p-8 text-center text-sm text-sage-500">{elder.name}今天没有漏服记录，继续保持</Card>
      ) : (
        <>
          {pending.map((d, i) => (
            <Card key={i} className="p-4 border-amber-200 bg-amber-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><AlertTriangle size={18} /></div>
                <div className="flex-1">
                  <p className="font-medium text-sage-800">{d.time} · {d.name}</p>
                  <p className="text-xs text-amber-700 mt-0.5">尚未确认服用</p>
                </div>
              </div>
            </Card>
          ))}
          {missed.map((d, i) => (
            <Card key={i} className="p-4 border-coral-200 bg-coral-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-coral-100 text-coral-600 flex items-center justify-center shrink-0"><AlertTriangle size={18} /></div>
                <div className="flex-1">
                  <p className="font-medium text-sage-800">{d.time} · {d.name}</p>
                  <p className="text-xs text-coral-700 mt-0.5">未按时服用，最终状态：漏服</p>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

function DrugsTab({ elder, onAdd }: { elder: ElderOverview; onAdd: () => void }) {
  return (
    <Card>
      <CardHeader title={`${elder.name}的药箱`} subtitle="来自老人端的在服药品" icon={<Package size={18} />}
        action={<Button size="sm" icon={<Plus size={14} />} onClick={onAdd}>+添加药品</Button>} />
      <div className="px-5 pb-5 space-y-2.5">
        {elder.medications.length === 0 && <p className="text-sm text-sage-400 py-4 text-center">暂无药品</p>}
        {elder.medications.map((med) => (
          <div key={med.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-cream-50/40 border border-sage-50 hover:border-sage-200">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0"><Pill size={18} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sage-800">{med.name}</p>
              <p className="text-xs text-sage-500 mt-0.5">{med.freq} · {med.times} · {med.spec}</p>
            </div>
            <button className="p-1.5 rounded-lg text-sage-400 hover:text-sage-700 hover:bg-sage-50 shrink-0" title="编辑药品"><Pencil size={14} /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}
