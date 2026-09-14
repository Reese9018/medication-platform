import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Send, Sparkles, Pill, ShieldAlert, Lightbulb, ArrowRight,
  Activity, User, Stethoscope, RotateCcw, ClipboardList, ChevronDown, ChevronUp,
  WifiOff, RefreshCw, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, RiskBadge } from '@/components/ui/Badge';
import { RichText } from '@/components/ui/RichText';
import { useApp } from '@/context/AppContext';
import { aiQuickQuestionGroups } from '@/data/mockData';
import { assistantApi, type AssistantProfileSummary } from '@/lib/api';
import { answerLocally, localProfileSummary } from '@/lib/localAssistant';
import type { AIMessage, AICard } from '@/types';
import { cn } from '@/lib/utils';

/** 助手回答的来源：ai = 扣子智能体；local = 后端/前端本地应答引擎兜底 */
interface ChatMessage extends AIMessage {
  source?: 'ai' | 'local';
}

const WELCOME_ID = 'welcome';

/**
 * 欢迎语带出「我读到了什么」。
 * 之前是一句写死的「我已读取您的健康档案」，老人既看不到读到了什么，也看不出档案缺了什么。
 */
function buildWelcome(profile: AssistantProfileSummary | null): string {
  if (!profile) {
    return '您好，我是您的 AI 用药助手。我正在读取您的健康档案，您可以先把想问的说给我听。';
  }
  const facts: string[] = [];
  if (profile.age) facts.push(`年龄 ${profile.age} 岁`);
  if (profile.chronic_conditions.length) facts.push(`慢性病史：${profile.chronic_conditions.join('、')}`);
  if (profile.allergies.length) facts.push(`过敏史：${profile.allergies.join('、')}`);
  if (profile.active_medication_count) facts.push(`在服药品 ${profile.active_medication_count} 种`);
  if (profile.latest_bp) facts.push(`最近一次血压 ${profile.latest_bp} mmHg`);
  if (profile.today_total) facts.push(`今天的药已服 ${profile.today_taken}/${profile.today_total} 次`);

  const lines = [`${profile.name}您好，我是您的 AI 用药助手。您的健康档案我已经读到了：`];
  if (facts.length) lines.push(facts.map((f) => `- ${f}`).join('\n'));
  lines.push('不用只挑固定的几个问题。用药、指标、吃喝、心情、复查，想到什么直接问我就行。');
  if (profile.missing_fields.length) {
    lines.push(`（小提醒：您的档案还缺 ${profile.missing_fields.join('、')}，补上之后我给的建议会更贴合您的情况。）`);
  }
  return lines.join('\n');
}

export function AssistantPage() {
  const { showToast, askAssistant, user, medications, schedule, healthRecords } = useApp();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: WELCOME_ID, role: 'assistant', content: buildWelcome(null), timestamp: new Date().toISOString(), source: 'ai' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AssistantProfileSummary | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSource, setProfileSource] = useState<'ai' | 'local'>('ai');
  const [profileOpen, setProfileOpen] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  // 本地应答引擎的输入：已经加载到前端的真实数据
  const localCtx = useMemo(
    () => ({ user, medications, schedule, healthRecords }),
    [user, medications, schedule, healthRecords],
  );

  /**
   * 进入页面就拉档案摘要，不必先提一个问题。
   * 拉不到（后端没起 / 部署接口挂了）就用前端已有的数据本地估算，保证卡片不空着。
   */
  const loadProfile = useCallback(async () => {
    try {
      const data = await assistantApi.profile();
      setProfile(data);
      setProfileSource('ai');
    } catch {
      setProfile(localProfileSummary(localCtx));
      setProfileSource('local');
    } finally {
      setProfileLoading(false);
    }
  }, [localCtx]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  // 档案到手后把欢迎语换成带数据的版本（用户还没开始对话时才替换）
  useEffect(() => {
    if (profileLoading || !profile) return;
    setMessages((prev) => (
      prev.length === 1 && prev[0].id === WELCOME_ID
        ? [{ ...prev[0], content: buildWelcome(profile) }]
        : prev
    ));
  }, [profileLoading, profile]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    setMessages((m) => [...m, { id: `u_${Date.now()}`, role: 'user', content: text, timestamp: new Date().toISOString() }]);
    setInput('');
    setTyping(true);
    try {
      // 首轮不传 conversationId，扣子自动建会话并返回；后续轮次带上以维持上下文
      const response = await askAssistant(text, conversationId ?? undefined);
      if (response.conversation_id) setConversationId(response.conversation_id);
      if (response.profile) { setProfile(response.profile); setProfileSource('ai'); }
      setMessages((m) => [...m, {
        id: `a_${Date.now()}`, role: 'assistant', content: response.content,
        cards: response.cards, timestamp: new Date().toISOString(),
        source: response.source ?? 'ai',
      }]);
    } catch {
      // 后端不可达时不能只弹一句 toast 让对话区空着，用本地引擎基于真实数据作答
      const local = answerLocally(text, localCtx);
      setMessages((m) => [...m, {
        id: `a_${Date.now()}`, role: 'assistant', content: local.content,
        cards: local.cards as AICard[] | undefined, timestamp: new Date().toISOString(),
        source: 'local',
      }]);
      setProfile((cur) => cur ?? localProfileSummary(localCtx));
      showToast('暂时连不上 AI 服务，本次由本地应答', 'info');
    } finally {
      setTyping(false);
    }
  };

  const reset = () => {
    setMessages([{ id: WELCOME_ID, role: 'assistant', content: buildWelcome(profile), timestamp: new Date().toISOString(), source: 'ai' }]);
    setConversationId(null);
    showToast('已清空对话，开启新会话');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 lg:h-[calc(100vh-150px)] lg:flex lg:flex-col">
      <ProfileReadCard
        profile={profile}
        loading={profileLoading}
        source={profileSource}
        open={profileOpen}
        onToggle={() => setProfileOpen((v) => !v)}
        onReload={() => { setProfileLoading(true); void loadProfile(); }}
        onGoProfile={() => navigate('/profile')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 lg:flex-1 lg:min-h-0">
        {/* Chat area */}
        <Card className="flex flex-col h-[70vh] min-h-[440px] overflow-hidden lg:h-auto lg:min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-sage-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-600">
                <Bot size={22} />
              </div>
              <div>
                <h2 className="font-semibold text-sage-800">AI 智能用药助手</h2>
                <p className="text-xs text-sage-500 flex items-center gap-1">
                  <span className={cn('w-1.5 h-1.5 rounded-full', profileSource === 'ai' ? 'bg-sage-500' : 'bg-amber-500')} />
                  {profileLoading
                    ? '正在读取您的健康档案…'
                    : profileSource === 'ai'
                      ? `已读到您的档案与 ${profile?.active_medication_count ?? 0} 种在服药品，可以随便问`
                      : 'AI 服务未连通，当前按本地数据回答'}
                </p>
              </div>
            </div>
            <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={reset}>清空</Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', m.role === 'user' ? 'bg-sky-100 text-sky-600' : 'bg-sage-100 text-sage-600')}>
                  {m.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className={cn('max-w-[82%] min-w-0', m.role === 'user' && 'text-right')}>
                  <div className={cn('inline-block px-4 py-2.5 rounded-2xl text-sm text-left', m.role === 'user' ? 'bg-sky-50 text-sky-800 rounded-tr-sm' : 'bg-cream-50 text-sage-700 rounded-tl-sm border border-sage-100')}>
                    {m.role === 'user' ? m.content : <RichText text={m.content} />}
                  </div>
                  {m.role === 'assistant' && m.source === 'local' && (
                    <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                      <WifiOff size={12} /> 本地应答（未连接 AI 服务），内容仅供参考
                    </p>
                  )}
                  {/* Structured cards */}
                  {m.cards && m.cards.length > 0 && (
                    <div className="mt-2 space-y-2 text-left">
                      {m.cards.map((c, i) => <AICardView key={i} card={c} onNavigate={navigate} />)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-sage-100 flex items-center justify-center text-sage-600"><Bot size={18} /></div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-cream-50 border border-sage-100">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-sage-400 animate-pulse-soft" />
                    <span className="w-2 h-2 rounded-full bg-sage-400 animate-pulse-soft" style={{ animationDelay: '0.2s' }} />
                    <span className="w-2 h-2 rounded-full bg-sage-400 animate-pulse-soft" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <p className="mt-2 text-xs text-sage-500">正在结合您的档案与用药记录分析，通常需要十几秒，请稍等…</p>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-sage-100">
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="随便问，例如「阿司匹林有什么副作用」"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !typing) void send(input); }}
                disabled={typing}
              />
              <Button icon={<Send size={16} />} onClick={() => void send(input)} disabled={typing || !input.trim()}>发送</Button>
            </div>
          </div>
        </Card>

        {/* Quick questions sidebar */}
        <div className="space-y-4 lg:overflow-y-auto lg:min-h-0 lg:pr-1">
          <Card className="p-4">
            <p className="text-sm font-semibold text-sage-800 mb-1 flex items-center gap-1.5">
              <Sparkles size={16} className="text-sage-600" /> 不知道问什么？先试试这些
            </p>
            <p className="text-xs text-sage-500 mb-3">下面只是常用的例子，其他问题也可以直接问。</p>
            <div className="space-y-3">
              {aiQuickQuestionGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-medium text-sage-500 mb-1.5">{group.label}</p>
                  <div className="space-y-1.5">
                    {group.questions.map((q) => (
                      <button
                        key={q}
                        onClick={() => void send(q)}
                        disabled={typing}
                        className="w-full text-left px-3 py-2 rounded-xl bg-cream-50/60 hover:bg-sage-50 border border-sage-100 text-sm text-sage-700 transition disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 bg-sage-50/40 border-sage-100">
            <p className="text-xs text-sage-500 flex gap-1.5">
              <Stethoscope size={14} className="shrink-0 mt-0.5" />
              本助手会结合您的健康档案与药品信息作答。但所有内容仅供参考，不能替代医生诊断；出现严重不适请及时就医。
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** 档案字段小卡片：缺项 / 空值时用琥珀色提示，避免用户误以为「已读到」就是「已录入」 */
function FactChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn('rounded-xl border px-2.5 py-1.5 min-w-[100px]', warn ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-sage-100')}>
      <p className="text-[11px] text-sage-500 leading-none mb-1">{label}</p>
      <p className={cn('text-xs font-medium leading-tight break-all', warn ? 'text-amber-700' : 'text-sage-800')}>{value}</p>
    </div>
  );
}

/**
 * 「AI 已读到的您的档案」卡片。
 * 老人的疑问是「它到底读到了我什么、我的档案是不是空的」，所以这里把 AI 侧真实拿到的字段摊开给用户看，
 * 缺项也明确列出来并给出补录入口。
 */
function ProfileReadCard({
  profile, loading, source, open, onToggle, onReload, onGoProfile,
}: {
  profile: AssistantProfileSummary | null;
  loading: boolean;
  source: 'ai' | 'local';
  open: boolean;
  onToggle: () => void;
  onReload: () => void;
  onGoProfile: () => void;
}) {
  const missing = profile?.missing_fields ?? [];
  const pct = profile?.completeness ?? 0;
  const isMissing = (label: string) => missing.includes(label);

  const facts: { label: string; value: string; warn: boolean }[] = profile ? [
    { label: '姓名', value: profile.name || '未填写', warn: !profile.name },
    { label: '年龄', value: profile.age ? `${profile.age} 岁` : '未填写', warn: isMissing('年龄') },
    { label: '慢性病史', value: profile.chronic_conditions.join('、') || (isMissing('慢性病史') ? '未填写' : '未记录'), warn: isMissing('慢性病史') || profile.chronic_conditions.length === 0 },
    { label: '过敏史', value: profile.allergies.join('、') || '未记录', warn: profile.allergies.length === 0 },
    { label: '在服药品', value: profile.active_medication_count ? `${profile.active_medication_count} 种` : '未录入', warn: profile.active_medication_count === 0 },
    { label: '今日用药', value: profile.today_total ? `已服 ${profile.today_taken} / ${profile.today_total} 次` : '今日无计划', warn: false },
    { label: '最近血压', value: profile.latest_bp ? `${profile.latest_bp} mmHg` : '暂无记录', warn: false },
    { label: '最近血糖', value: profile.latest_blood_sugar ? `${profile.latest_blood_sugar} mmol/L` : '暂无记录', warn: false },
    { label: '最近心率', value: profile.latest_heart_rate ? `${profile.latest_heart_rate} 次/分` : '暂无记录', warn: false },
    { label: '健康记录', value: profile.record_count ? `${profile.record_count} 条` : '暂无记录', warn: false },
  ] : [];

  // 空值不是「未录入」的字段（如指标类），用中性文案展示
  return (
    <Card className="p-4 border-sage-100 bg-sage-50/30 shrink-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-white border border-sage-100 flex items-center justify-center text-sage-600 shrink-0">
            <ClipboardList size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sage-800 flex items-center gap-2 flex-wrap">
              AI 已读到的您的档案
              {loading ? (
                <span className="text-xs font-normal text-sage-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> 读取中…</span>
              ) : missing.length ? (
                <Badge level="mid"><AlertTriangle size={11} className="inline -mt-0.5 mr-0.5" />待补全 {missing.length} 项</Badge>
              ) : (
                <Badge level="low"><CheckCircle2 size={11} className="inline -mt-0.5 mr-0.5" />档案完整</Badge>
              )}
              {source === 'local' && !loading && <span className="text-xs font-normal text-amber-600">（按本地数据估算）</span>}
            </p>
            <p className="text-xs text-sage-500 mt-1">
              下面这些就是助手回答时会参考的您的信息，不是凭空编的。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {source === 'local' && !loading && (
            <button onClick={onReload} className="p-1.5 rounded-lg text-sage-500 hover:bg-white hover:text-sage-700 transition" title="重新连接 AI 服务">
              <RefreshCw size={15} />
            </button>
          )}
          <button onClick={onToggle} className="p-1.5 rounded-lg text-sage-500 hover:bg-white hover:text-sage-700 transition" title={open ? '收起' : '展开'}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3">
          {loading && !profile ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[46px] w-[110px] rounded-xl bg-white/70 border border-sage-100 animate-pulse-soft" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {facts.map((f) => <FactChip key={f.label} label={f.label} value={f.value} warn={f.warn} />)}
              </div>

              {/* 完整度进度条 */}
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-white overflow-hidden border border-sage-100">
                  <div
                    className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-sage-500' : 'bg-amber-400')}
                    style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
                  />
                </div>
                <span className="text-xs text-sage-600 shrink-0">档案完整度 {pct}%</span>
              </div>

              {missing.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50/70 border border-amber-200 px-3 py-2">
                  <p className="text-xs text-amber-800 flex-1 min-w-[200px]">
                    <span className="font-medium">还缺：{missing.join('、')}</span>
                    <span className="ml-2">补全后，助手判断用药风险和用法时会准确很多。</span>
                  </p>
                  <Button size="sm" variant="secondary" icon={<ArrowRight size={13} />} onClick={onGoProfile}>去完善健康档案</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function AICardView({ card, onNavigate }: { card: AICard; onNavigate: (to: string) => void }) {
  if (card.type === 'medication') {
    return (
      <div className="bg-white rounded-xl border border-sage-100 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Pill size={15} className="text-sage-600" />
          <span className="text-sm font-semibold text-sage-800">{card.title}</span>
        </div>
        <p className="text-xs text-sage-600">{card.detail}</p>
        {card.medications && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {card.medications.map((m) => <span key={m} className="px-2 py-0.5 rounded-md bg-cream-100 text-xs text-sage-600">{m}</span>)}
          </div>
        )}
      </div>
    );
  }
  if (card.type === 'risk') {
    return (
      <div className={cn('rounded-xl border p-3', card.level === 'high' ? 'bg-coral-50/60 border-coral-200' : card.level === 'mid' ? 'bg-amber-50/60 border-amber-200' : 'bg-sage-50/60 border-sage-200')}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-sage-800 flex items-center gap-1.5"><ShieldAlert size={15} className="text-coral-600" /> {card.title}</span>
          {card.level && <RiskBadge level={card.level} />}
        </div>
        <p className="text-xs text-sage-600">{card.detail}</p>
      </div>
    );
  }
  if (card.type === 'tip') {
    return (
      <div className="bg-sky-50/60 rounded-xl border border-sky-100 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Lightbulb size={15} className="text-sky-600" />
          <span className="text-sm font-semibold text-sky-800">{card.title}</span>
        </div>
        <p className="text-xs text-sage-600">{card.detail}</p>
      </div>
    );
  }
  if (card.type === 'health') {
    return (
      <div className="bg-sage-50/60 rounded-xl border border-sage-100 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Activity size={15} className="text-sage-600" />
          <span className="text-sm font-semibold text-sage-800">{card.title}</span>
        </div>
        <p className="text-xs text-sage-600">{card.detail}</p>
      </div>
    );
  }
  if (card.type === 'action') {
    return (
      <div className="flex flex-wrap gap-2">
        {card.actions?.map((a) => (
          <button key={a.label} onClick={() => a.to && onNavigate(a.to)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sage-600 text-white text-xs font-medium hover:bg-sage-700 transition">
            {a.label} <ArrowRight size={13} />
          </button>
        ))}
      </div>
    );
  }
  return null;
}
