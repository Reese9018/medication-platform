import { useEffect, useMemo, useState } from 'react';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, AlertCircle, Info,
  Sparkles, ArrowRight, Pill, Stethoscope, Lightbulb, X,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, RiskBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SectionTitle } from '@/components/ui/Common';
import { riskApi } from '@/lib/api';
import { generateRisks } from '@/lib/riskEngine';
import { useApp } from '@/context/AppContext';
import type { RiskAlert, RiskLevel } from '@/types';
import { cn } from '@/lib/utils';

const levelMeta: Record<RiskLevel, { label: string; color: string; bg: string; border: string; text: string }> = {
  high: { label: '高风险', color: '#D2624A', bg: 'bg-coral-50', border: 'border-coral-200', text: 'text-coral-700' },
  mid: { label: '中风险', color: '#D49A1E', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  low: { label: '低风险', color: '#4A8265', bg: 'bg-sage-50', border: 'border-sage-200', text: 'text-sage-700' },
};

const typeIcons: Record<string, React.ReactNode> = {
  '药物相互作用': <AlertTriangle size={18} />,
  '低血糖风险': <ShieldAlert size={18} />,
  '重复用药': <AlertCircle size={18} />,
  '慢病禁忌': <Stethoscope size={18} />,
  '剂量风险': <Pill size={18} />,
  '服药时间冲突': <Info size={18} />,
};

export function RiskPage() {
  const { user, medications } = useApp();
  const [filter, setFilter] = useState<'all' | RiskLevel>('all');
  const [deepAnalysis, setDeepAnalysis] = useState<RiskAlert | null>(null);
  const [safetyAdvice, setSafetyAdvice] = useState<RiskAlert | null>(null);
  const [serverRisks, setServerRisks] = useState<RiskAlert[] | null>(null);

  // 从后端获取风险数据（如可用），失败则静默使用本地动态生成
  useEffect(() => {
    riskApi.list().then(setServerRisks).catch(() => undefined);
  }, [user?.id, medications.length]);

  // 本地动态生成风险（核心逻辑：结合用户健康档案 + 用药列表）
  const localResult = useMemo(() => generateRisks(user, medications), [user, medications]);

  // 优先使用后端数据，后端不可用时使用本地动态生成
  const result = serverRisks && serverRisks.length > 0
    ? {
        alerts: serverRisks,
        score: localResult.score,
        summary: localResult.summary,
        highCount: serverRisks.filter((r) => r.level === 'high').length,
        midCount: serverRisks.filter((r) => r.level === 'mid').length,
        lowCount: serverRisks.filter((r) => r.level === 'low').length,
      }
    : localResult;

  const riskAlerts = result.alerts;
  const filtered = filter === 'all' ? riskAlerts : riskAlerts.filter((r) => r.level === filter);
  const counts = {
    high: result.highCount,
    mid: result.midCount,
    low: result.lowCount,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <SectionTitle title="AI 用药安全中心" subtitle="基于多药冲突、慢病禁忌与剂量风险的智能分析" icon={<ShieldAlert size={22} />} />

      {/* Score banner */}
      <Card className="p-5 bg-gradient-to-br from-coral-50/40 via-cream-50 to-amber-50/30 border-amber-100">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="text-center shrink-0">
            <ProgressRing
              value={result.score}
              size={110}
              stroke={10}
              color={result.score >= 80 ? '#4A8265' : result.score >= 60 ? '#D49A1E' : '#D2624A'}
              label={String(result.score)}
              sublabel="安全评分"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sage-500 text-sm">AI 用药安全评分</span>
              <Badge level={result.score >= 80 ? 'low' : result.score >= 60 ? 'mid' : 'high'}>
                当前：{result.score >= 80 ? '低风险' : result.score >= 60 ? '中等风险' : '高风险'}
              </Badge>
            </div>
            <p className="text-sage-600 text-sm leading-relaxed">
              {result.summary}
            </p>
          </div>
        </div>
      </Card>

      {/* Risk level summary */}
      <div className="grid grid-cols-3 gap-4">
        {(['high', 'mid', 'low'] as RiskLevel[]).map((lvl) => {
          const m = levelMeta[lvl];
          return (
            <button
              key={lvl}
              onClick={() => setFilter(filter === lvl ? 'all' : lvl)}
              className={cn('text-left p-4 rounded-2xl border transition hover:shadow-soft', m.bg, m.border, filter === lvl && 'ring-2 ring-offset-2 ring-current')}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-2xl font-bold', m.text)}>{counts[lvl]}</span>
                <RiskBadge level={lvl} />
              </div>
              <p className="text-xs text-sage-500 mt-1">{m.label}因素</p>
            </button>
          );
        })}
      </div>

      {/* Risk cards */}
      <div className="space-y-4">
        {filtered.map((r) => {
          const m = levelMeta[r.level];
          return (
            <Card key={r.id} className="p-5 hover:shadow-card transition">
              <div className="flex items-start gap-4">
                <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0', m.bg, m.text)}>
                  {typeIcons[r.type] || <AlertCircle size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-semibold text-sage-800">{r.type}</h3>
                    <RiskBadge level={r.level} />
                  </div>
                  {/* medications relation */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {r.medications.map((med, i) => (
                      <span key={med} className="inline-flex items-center gap-1">
                        {i > 0 && <span className="text-coral-400 text-xs">⇄</span>}
                        <span className="px-2.5 py-1 rounded-lg bg-cream-100 text-sage-700 text-xs font-medium">{med}</span>
                      </span>
                    ))}
                  </div>
                  {/* risk bar */}
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-cream-100 overflow-hidden">
                      <div className={cn('h-full rounded-full', r.level === 'high' ? 'bg-coral-500' : r.level === 'mid' ? 'bg-amber-400' : 'bg-sage-400')} style={{ width: r.level === 'high' ? '85%' : r.level === 'mid' ? '55%' : '25%' }} />
                    </div>
                    <span className={cn('text-xs font-medium', m.text)}>{m.label}</span>
                  </div>
                  <p className="mt-2 text-sm text-sage-600">{r.reason}</p>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="secondary" icon={<Sparkles size={13} />} onClick={() => setDeepAnalysis(r)}>AI 深度分析</Button>
                    <Button size="sm" variant="secondary" icon={<ShieldCheck size={13} />} onClick={() => setSafetyAdvice(r)}>查看安全建议</Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Deep analysis modal */}
      <Modal open={!!deepAnalysis} onClose={() => setDeepAnalysis(null)} title="AI 深度分析" subtitle={deepAnalysis?.type} size="lg">
        {deepAnalysis && (
          <div className="space-y-4">
            {/* Risk level header */}
            <div className={cn('flex items-center justify-between p-4 rounded-2xl border', levelMeta[deepAnalysis.level].bg, levelMeta[deepAnalysis.level].border)}>
              <div className="flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', levelMeta[deepAnalysis.level].text)}>
                  {typeIcons[deepAnalysis.type]}
                </div>
                <div>
                  <p className="font-semibold text-sage-800">{deepAnalysis.type}</p>
                  <p className="text-xs text-sage-500">风险类型</p>
                </div>
              </div>
              <RiskBadge level={deepAnalysis.level} />
            </div>

            {/* Medications involved */}
            <div className="p-4 rounded-2xl bg-cream-50/60 border border-sage-100">
              <p className="text-xs text-sage-400 mb-2 flex items-center gap-1"><Pill size={13} /> 涉及药品</p>
              <div className="flex items-center gap-2 flex-wrap">
                {deepAnalysis.medications.map((med, i) => (
                  <span key={med} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span className="text-coral-400">⇄</span>}
                    <span className="px-3 py-1.5 rounded-xl bg-white border border-sage-200 text-sage-700 text-sm font-medium">{med}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Reason */}
            <AnalysisBlock icon={<AlertCircle size={16} />} title="风险原因" color="text-coral-600">
              {deepAnalysis.reason}
            </AnalysisBlock>

            {/* AI analysis */}
            <AnalysisBlock icon={<Sparkles size={16} />} title="AI 分析" color="text-sky-600">
              {deepAnalysis.aiAnalysis}
            </AnalysisBlock>

            {/* Suggestion */}
            <AnalysisBlock icon={<Lightbulb size={16} />} title="AI 建议" color="text-sage-600">
              {deepAnalysis.suggestion}
            </AnalysisBlock>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700 flex gap-2">
              <Info size={14} className="shrink-0 mt-0.5" />
              本分析由 AI 模拟生成，仅供参考，不能替代医生或药师的专业判断。
            </div>
          </div>
        )}
      </Modal>

      {/* Safety advice modal —— 老人能听懂的通俗建议 */}
      <Modal open={!!safetyAdvice} onClose={() => setSafetyAdvice(null)} title="安全建议" subtitle={safetyAdvice?.type} size="md">
        {safetyAdvice && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-sage-50 border border-sage-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-sage-100 flex items-center justify-center text-sage-600">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="font-semibold text-sage-800 text-sm">{safetyAdvice.type}</p>
                  <p className="text-xs text-sage-500">涉及：{safetyAdvice.medications.join('、')}</p>
                </div>
              </div>
              <p className="text-sm text-sage-700 leading-relaxed whitespace-pre-line">{safetyAdvice.plainAdvice}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700 flex gap-2">
              <Info size={14} className="shrink-0 mt-0.5" />
              以上建议由 AI 根据您的用药情况生成，仅供参考，具体用药调整请咨询医生或药师。
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AnalysisBlock({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-sage-100">
      <p className={cn('text-sm font-semibold mb-1.5 flex items-center gap-1.5', color)}>{icon} {title}</p>
      <p className="text-sm text-sage-600 leading-relaxed">{children}</p>
    </div>
  );
}
