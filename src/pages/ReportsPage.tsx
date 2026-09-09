import { useState, useRef, useEffect } from 'react';
import {
  FileText, Calendar, Download, Save, Sparkles, CheckCircle2,
  AlertTriangle, TrendingUp, Heart, Activity, Pill, Printer,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SectionTitle } from '@/components/ui/Common';
import { weeklyTrend, weeklyReport, elderProfile } from '@/data/mockData';
import { reportApi } from '@/lib/api';
import { cn } from '@/lib/utils';

export function ReportsPage() {
  const { showToast } = useApp();
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [generated, setGenerated] = useState(true);
  const [report, setReport] = useState(weeklyReport);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    reportApi.get(period).then(setReport).catch(() => showToast('报告加载失败，请确认后端服务已启动', 'error'));
  }, [period, showToast]);

  const handleGenerate = async () => {
    setGenerated(false);
    try {
      setReport(await reportApi.get(period));
      showToast('报告已生成');
    } catch {
      showToast('报告生成失败，请确认后端服务已启动', 'error');
    } finally {
      setGenerated(true);
    }
  };

  const handleSave = () => { showToast('报告已保存到档案'); };
  const handleDownload = () => {
    window.print();
    showToast('正在打开打印/下载窗口');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <SectionTitle
        title="健康报告"
        subtitle="生成周报或月报，了解您的健康全貌"
        icon={<FileText size={22} />}
        right={
          <div className="flex gap-2">
            <div className="flex p-1 bg-cream-100 rounded-xl">
              {(['week', 'month'] as const).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={cn('px-3.5 py-1.5 rounded-lg text-sm transition', period === p ? 'bg-white text-sage-800 shadow-soft font-medium' : 'text-sage-500')}>
                  {p === 'week' ? '周报' : '月报'}
                </button>
              ))}
            </div>
            <Button variant="secondary" icon={<Sparkles size={16} />} onClick={handleGenerate} loading={!generated}>生成报告</Button>
          </div>
        }
      />

      {/* Action bar */}
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" icon={<Save size={15} />} onClick={handleSave}>保存报告</Button>
        <Button size="sm" icon={<Download size={15} />} onClick={handleDownload}>下载报告</Button>
      </div>

      {/* Report document */}
      <Card className="overflow-hidden">
        <div ref={reportRef} className="p-7 lg:p-10">
          {/* Report header */}
          <div className="flex items-center justify-between pb-5 border-b border-sage-100">
            <div>
              <h2 className="text-2xl font-bold text-sage-800 font-display">
                {period === 'week' ? '每周健康报告' : '每月健康报告'}
              </h2>
              <p className="text-sm text-sage-500 mt-1 flex items-center gap-1.5">
                <Calendar size={14} /> {report.startDate} 至 {report.endDate} · 智药护航 AI 生成
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-sage-400">报告对象</p>
              <p className="font-semibold text-sage-700">{elderProfile.name}</p>
            </div>
          </div>

          {/* Summary score */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
            <ProgressRing value={report.adherenceRate} size={120} label={`${report.adherenceRate}%`} sublabel="服药完成率" />
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
              <ReportStat label="漏服次数" value={report.missedCount} color="coral" />
              <ReportStat label="平均血压" value={`${report.avgSystolic}/${report.avgDiastolic}`} color="sage" />
              <ReportStat label="平均血糖" value={report.avgBloodSugar} color="sky" />
              <ReportStat label="平均心率" value={report.avgHeartRate} color="amber" />
            </div>
          </div>

          {/* Charts */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <h3 className="text-sm font-semibold text-sage-700 mb-2 flex items-center gap-1.5"><Heart size={15} /> 血压趋势</h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyTrend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DCEBE3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8FBCA4' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#8FBCA4' }} axisLine={false} tickLine={false} domain={[60, 150]} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #DCEBE3', fontSize: 11 }} />
                    <Line type="monotone" dataKey="systolic" stroke="#4A8265" strokeWidth={2} dot={false} name="收缩压" />
                    <Line type="monotone" dataKey="diastolic" stroke="#82BDD8" strokeWidth={2} dot={false} name="舒张压" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-sage-700 mb-2 flex items-center gap-1.5"><Activity size={15} /> 血糖与心率</h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyTrend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DCEBE3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8FBCA4' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#8FBCA4' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #DCEBE3', fontSize: 11 }} />
                    <Line type="monotone" dataKey="bloodSugar" stroke="#3A85A8" strokeWidth={2} dot={false} name="血糖" />
                    <Line type="monotone" dataKey="heartRate" stroke="#D2624A" strokeWidth={2} dot={false} name="心率" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Risk summary */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-sage-700 mb-2 flex items-center gap-1.5"><AlertTriangle size={15} /> 用药风险</h3>
            <div className="flex gap-3">
              <RiskCount label="高风险" count={report.riskCount.high} color="coral" />
              <RiskCount label="中风险" count={report.riskCount.mid} color="amber" />
              <RiskCount label="低风险" count={report.riskCount.low} color="sage" />
            </div>
          </div>

          {/* AI analysis */}
          <div className="mt-6 p-4 rounded-2xl bg-sage-50/50 border border-sage-100">
            <h3 className="text-sm font-semibold text-sage-800 mb-2 flex items-center gap-1.5"><Sparkles size={15} className="text-sage-600" /> AI 健康分析</h3>
            <p className="text-sm text-sage-600 leading-relaxed">{report.aiSummary}</p>
          </div>

          {/* Suggestions */}
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-sage-700 mb-2 flex items-center gap-1.5"><TrendingUp size={15} /> 健康建议</h3>
            <ul className="space-y-1.5">
              {report.suggestions.map((s, i) => (
                <li key={i} className="text-sm text-sage-600 flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-sage-500 mt-0.5 shrink-0" /> {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-sage-100 text-xs text-sage-400">
            本报告由智药护航 AI 自动生成，仅供参考，不能替代医生诊断和处方。如出现严重不适或用药疑问，请及时咨询医生或药师。
          </div>
        </div>
      </Card>
    </div>
  );
}

function ReportStat({ label, value, color }: { label: string; value: string | number; color: 'sage' | 'sky' | 'coral' | 'amber' }) {
  const colorMap = {
    sage: 'text-sage-700 bg-sage-50', sky: 'text-sky-700 bg-sky-50',
    coral: 'text-coral-700 bg-coral-50', amber: 'text-amber-700 bg-amber-50',
  };
  return (
    <div className={cn('rounded-xl p-3 text-center', colorMap[color])}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

function RiskCount({ label, count, color }: { label: string; count: number; color: 'coral' | 'amber' | 'sage' }) {
  const colorMap = { coral: 'text-coral-700', amber: 'text-amber-700', sage: 'text-sage-700' };
  return (
    <div className="flex-1 p-3 rounded-xl bg-cream-50/60 border border-sage-100 text-center">
      <p className={cn('text-2xl font-bold', colorMap[color])}>{count}</p>
      <p className="text-xs text-sage-500 mt-0.5">{label}</p>
    </div>
  );
}
