import { useState, useMemo, useRef } from 'react';
import {
  Pill, Search, Plus, Camera, Edit2, Trash2, Filter, Clock, AlertCircle,
  CheckCircle2, PauseCircle, Upload, ScanLine, FileText, Sparkles, ArrowRight,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, RiskBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { SectionTitle, EmptyState } from '@/components/ui/Common';
import { PillIcon } from '@/components/ui/Decorations';
import type { Medication } from '@/types';
import { medicationApi, type OCRResult } from '@/lib/api';
import { cn } from '@/lib/utils';

const categories = ['全部', '降压药', '降糖药', '心血管药', '精神类药', '其他'];

const statusMap = {
  active: { label: '服用中', icon: CheckCircle2, color: 'text-sage-600 bg-sage-50 border-sage-200' },
  paused: { label: '已暂停', icon: PauseCircle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  finished: { label: '已服完', icon: CheckCircle2, color: 'text-sage-400 bg-cream-100 border-sage-200' },
};

export function MedicationsPage() {
  const { medications, addMedication, updateMedication, removeMedication, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('全部');
  const [ocrOpen, setOcrOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);

  const filtered = useMemo(() => {
    return medications.filter((m) => {
      const matchSearch = !search || m.name.includes(search) || m.purpose.includes(search);
      const matchCat = category === '全部' || m.category === category;
      return matchSearch && matchCat;
    });
  }, [medications, search, category]);

  const handleDelete = (id: string, name: string) => {
    removeMedication(id);
    showToast(`已删除「${name}」`, 'info');
  };

  const handleSave = (med: Medication) => {
    if (editing) {
      updateMedication(editing.id, med);
      showToast('药品信息已更新');
    } else {
      addMedication(med);
      showToast('已添加新药品');
    }
    setAddOpen(false);
    setEditing(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <SectionTitle
        title="我的药品"
        subtitle={`共 ${medications.length} 种药品在管理`}
        icon={<Pill size={22} />}
        right={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Camera size={16} />} onClick={() => setOcrOpen(true)}>AI 拍照识别</Button>
            <Button icon={<Plus size={16} />} onClick={() => { setEditing(null); setAddOpen(true); }}>手动添加</Button>
          </div>
        }
      />

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-300" size={18} />
          <input className="input pl-10" placeholder="搜索药品名称或用途…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'px-3.5 py-2 rounded-xl text-sm transition border',
                category === c ? 'bg-sage-600 text-white border-sage-600' : 'bg-white text-sage-600 border-sage-200 hover:bg-sage-50',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Medication cards */}
      {filtered.length === 0 ? (
        <Card><EmptyState icon={<Pill size={40} />} title="未找到匹配的药品" hint="试试调整搜索或筛选条件" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const st = statusMap[m.status];
            const StIcon = st.icon;
            return (
              <Card key={m.id} className="p-5 hover:shadow-pop transition-shadow group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-sage-50 flex items-center justify-center text-sage-600">
                      <PillIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sage-800">{m.name}</h3>
                      <p className="text-xs text-sage-400">{m.spec}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => { setEditing(m); setAddOpen(true); }} className="p-1.5 rounded-lg text-sage-500 hover:bg-sage-50 hover:text-sage-700">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => handleDelete(m.id, m.name)} className="p-1.5 rounded-lg text-coral-500 hover:bg-coral-50">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-sm">
                  <p className="text-sage-600"><span className="text-sage-400">用途：</span>{m.purpose}</p>
                  <p className="text-sage-600"><span className="text-sage-400">剂量：</span>{m.dosage} · 每日 {m.frequencyPerDay} 次</p>
                  <p className="text-sage-600 flex items-center gap-1.5">
                    <Clock size={13} className="text-sage-400" /> {m.times.join('、')}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className={cn('badge border', st.color)}>
                    <StIcon size={13} /> {st.label}
                  </span>
                  <RiskBadge level={m.riskLevel} />
                </div>
                {m.precautions && (
                  <p className="mt-3 text-xs text-amber-700 bg-amber-50/60 rounded-lg p-2 flex gap-1.5 border border-amber-100">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" /> {m.precautions}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* OCR modal */}
      <OCRModal open={ocrOpen} onClose={() => setOcrOpen(false)} onConfirm={(med) => { addMedication(med); showToast('已通过 AI 识别添加药品'); }} />

      {/* Add/Edit modal */}
      <MedicationFormModal open={addOpen} editing={editing} onClose={() => { setAddOpen(false); setEditing(null); }} onSave={handleSave} />
    </div>
  );
}

// ============ OCR Modal ============
function OCRModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (m: Medication) => void }) {
  const [step, setStep] = useState<'upload' | 'scanning' | 'result' | 'error'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 把 File 转成纯 base64（不含 data: 前缀）
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('请选择图片文件（JPG / PNG）');
      setStep('error');
      return;
    }

    // 显示预览
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStep('scanning');

    try {
      const base64 = await fileToBase64(file);
      const ocrResult = await medicationApi.recognize(base64);
      setResult(ocrResult);
      setStep('result');
    } catch (err) {
      console.error('OCR 识别失败:', err);
      setErrorMsg(err instanceof Error ? err.message : 'AI 识别失败，请检查网络或稍后重试');
      setStep('error');
    }
  };

  const reset = () => {
    setStep('upload');
    setPreviewUrl(null);
    setResult(null);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 300);
  };

  const handleConfirm = () => {
    if (!result) return;
    const med: Medication = {
      id: `m_${Date.now()}`,
      name: result.name,
      spec: result.spec,
      dosage: result.dosage || '1片',
      purpose: result.purpose,
      frequencyPerDay: result.frequency_per_day || 1,
      times: result.times && result.times.length > 0 ? result.times : ['08:00'],
      status: 'active',
      riskLevel: 'mid',
      category: '其他',
      startDate: new Date().toISOString().slice(0, 10),
      remindBeforeMinutes: 30,
      contraindications: result.contraindications || [],
      precautions: result.precautions || '',
    };
    onConfirm(med);
    handleClose();
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  return (
    <Modal open={open} onClose={handleClose} title="AI 拍照识别药品" subtitle="拍摄或上传药品包装/说明书，AI 自动识别" size="lg">
      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* 上传阶段 */}
      {step === 'upload' && (
        <div className="text-center py-6">
          <div
            onClick={triggerFileInput}
            className="mx-auto w-full max-w-sm h-48 rounded-2xl border-2 border-dashed border-sage-200 hover:border-sage-400 hover:bg-sage-50/50 transition cursor-pointer flex flex-col items-center justify-center gap-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-sage-50 flex items-center justify-center text-sage-600">
              <Upload size={28} />
            </div>
            <p className="text-sage-600 font-medium">点击上传药品图片</p>
            <p className="text-xs text-sage-400">支持 JPG / PNG · 拍摄药品包装或说明书</p>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-sage-400">
            <Sparkles size={13} /> AI 将自动识别药品名称、规格、用法等信息
          </div>
        </div>
      )}

      {/* 识别中阶段 */}
      {step === 'scanning' && (
        <div className="py-8 text-center">
          {previewUrl && (
            <div className="mx-auto w-40 h-40 rounded-2xl overflow-hidden border border-sage-200 mb-5">
              <img src={previewUrl} alt="药品预览" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-2xl bg-sage-50 flex items-center justify-center">
              <ScanLine size={36} className="text-sage-600 animate-pulse-soft" />
            </div>
            <svg className="absolute inset-0 w-full h-full -rotate-90 animate-spin-slow" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#DCEBE3" strokeWidth="4" />
              <circle cx="50" cy="50" r="46" fill="none" stroke="#4A8265" strokeWidth="4" strokeLinecap="round"
                strokeDasharray="72 217" />
            </svg>
          </div>
          <p className="mt-5 text-lg font-semibold text-sage-700">AI 正在识别…</p>
          <p className="mt-2 text-sm text-sage-400">正在调用智谱 GLM 视觉模型分析药品图片</p>
        </div>
      )}

      {/* 识别结果阶段 */}
      {step === 'result' && result && (
        <div>
          <div className="flex items-center gap-2 p-3 bg-sage-50 rounded-xl mb-4">
            <CheckCircle2 className="text-sage-600" size={18} />
            <span className="text-sm text-sage-700 font-medium">AI 识别成功，请确认以下信息</span>
          </div>
          {previewUrl && (
            <div className="mb-4 flex justify-center">
              <img src={previewUrl} alt="药品" className="w-32 h-32 object-cover rounded-xl border border-sage-200" />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ResultField label="药品名称" value={result.name} />
            <ResultField label="规格" value={result.spec || '未识别'} />
            <ResultField label="剂量" value={result.dosage || '未识别'} />
            <ResultField label="每日次数" value={result.frequency_per_day ? `${result.frequency_per_day} 次` : '未识别'} />
            <ResultField label="服用时间" value={result.times && result.times.length > 0 ? result.times.join('、') : '未识别'} />
            <ResultField label="用途/适应症" value={result.purpose || '未识别'} full />
            <ResultField label="禁忌症" value={result.contraindications && result.contraindications.length > 0 ? result.contraindications.join('；') : '未识别'} full />
            <ResultField label="注意事项" value={result.precautions || '未识别'} full />
          </div>
          <div className="mt-5 flex justify-between gap-2">
            <Button variant="secondary" icon={<X size={16} />} onClick={reset}>重新上传</Button>
            <Button icon={<ArrowRight size={16} />} onClick={handleConfirm}>确认并加入我的药品</Button>
          </div>
        </div>
      )}

      {/* 错误阶段 */}
      {step === 'error' && (
        <div className="py-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-coral-50 flex items-center justify-center text-coral-600 mb-4">
            <AlertCircle size={32} />
          </div>
          <p className="text-lg font-semibold text-sage-700">识别失败</p>
          <p className="mt-2 text-sm text-sage-500 max-w-sm mx-auto">{errorMsg}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" onClick={reset}>重新上传</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ResultField({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={cn('p-3 rounded-xl bg-cream-50/60 border border-sage-100', full && 'sm:col-span-2')}>
      <p className="text-xs text-sage-400 mb-1">{label}</p>
      <p className="text-sm text-sage-800">{value}</p>
    </div>
  );
}

// ============ Medication Form Modal ============
function MedicationFormModal({ open, editing, onClose, onSave }: {
  open: boolean; editing: Medication | null; onClose: () => void; onSave: (m: Medication) => void;
}) {
  const [form, setForm] = useState<Medication>(editing || {
    id: '', name: '', spec: '', dosage: '1片', purpose: '', frequencyPerDay: 1, times: ['08:00'],
    status: 'active', riskLevel: 'low', category: '其他', startDate: new Date().toISOString().slice(0, 10),
  });

  // re-sync when editing changes
  useMemo(() => {
    if (editing) setForm(editing);
    else setForm({ id: '', name: '', spec: '', dosage: '1片', purpose: '', frequencyPerDay: 1, times: ['08:00'], status: 'active', riskLevel: 'low', category: '其他', startDate: new Date().toISOString().slice(0, 10) });
  }, [editing, open]);

  const set = (k: keyof Medication, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title={editing ? '编辑药品' : '添加药品'} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>取消</Button><Button onClick={() => onSave({ ...form, id: form.id || `m_${Date.now()}` })}>保存</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">药品名称</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="如：硝苯地平缓释片" />
        </div>
        <div><label className="label">规格</label><input className="input" value={form.spec} onChange={(e) => set('spec', e.target.value)} placeholder="如：20mg×14片" /></div>
        <div><label className="label">剂量</label><input className="input" value={form.dosage} onChange={(e) => set('dosage', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label">用途/适应症</label><input className="input" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} /></div>
        <div>
          <label className="label">分类</label>
          <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {categories.filter((c) => c !== '全部').map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">每日次数</label>
          <input type="number" min={1} max={6} className="input" value={form.frequencyPerDay} onChange={(e) => set('frequencyPerDay', Number(e.target.value))} />
        </div>
        <div className="sm:col-span-2"><label className="label">服用时间（用逗号分隔）</label><input className="input" value={form.times.join('，')} onChange={(e) => set('times', e.target.value.split(/[，,]/).map((t) => t.trim()).filter(Boolean))} placeholder="如：08:00，20:00" /></div>
        <div>
          <label className="label">风险等级</label>
          <select className="input" value={form.riskLevel} onChange={(e) => set('riskLevel', e.target.value)}>
            <option value="low">低风险</option><option value="mid">中风险</option><option value="high">高风险</option>
          </select>
        </div>
        <div>
          <label className="label">状态</label>
          <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="active">服用中</option><option value="paused">已暂停</option><option value="finished">已服完</option>
          </select>
        </div>
        <div>
          <label className="label">开始日期</label>
          <input type="date" className="input" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </div>
        <div>
          <label className="label">结束日期（留空=长期服用）</label>
          <input type="date" className="input" value={form.endDate || ''} onChange={(e) => set('endDate', e.target.value || undefined)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">服药提醒（提前多少分钟发消息提醒）</label>
          <input type="number" min={0} max={120} className="input" value={form.remindBeforeMinutes ?? 30} onChange={(e) => set('remindBeforeMinutes', Math.max(0, Math.min(120, Number(e.target.value))))} />
          <p className="text-xs text-sage-400 mt-1">每次服药时间到达前，提前这些分钟向您发送提醒消息</p>
        </div>
        <div className="sm:col-span-2"><label className="label">注意事项</label><textarea className="input" rows={2} value={form.precautions || ''} onChange={(e) => set('precautions', e.target.value)} /></div>
      </div>
    </Modal>
  );
}
