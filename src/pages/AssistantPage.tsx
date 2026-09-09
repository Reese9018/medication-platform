import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Send, Sparkles, Pill, ShieldAlert, Lightbulb, ArrowRight,
  FileText, Activity, User, Stethoscope, RotateCcw,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, RiskBadge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { aiQuickQuestions } from '@/data/mockData';
import type { AIMessage, AICard } from '@/types';
import { cn } from '@/lib/utils';

const initialMessages: AIMessage[] = [
  {
    id: 'init',
    role: 'assistant',
    content: '您好，我是您的私人用药助手。我已读取您的健康档案、当前药品与近期健康数据，可以为您解答用药相关问题。',
    timestamp: new Date().toISOString(),
  },
];

// Canned AI responses keyed by question keywords
function generateAIResponse(question: string): { content: string; cards: AICard[] } {
  const q = question;
  if (q.includes('今天') || q.includes('吃哪些药')) {
    return {
      content: '根据您今日的用药计划，共需服用 7 次药品，分布在 4 个时间段。早晨 4 种、午间 1 种、晚间 1 种、睡前 1 种。',
      cards: [
        { type: 'medication', title: '早晨 08:00', detail: '硝苯地平缓释片、二甲双胍缓释片、阿司匹林肠溶片、格列美脲片', medications: ['硝苯地平缓释片', '二甲双胍缓释片', '阿司匹林肠溶片', '格列美脲片'] },
        { type: 'medication', title: '睡前 22:00', detail: '氯氮平片 0.5片（注意：昨日漏服，今日请按时服用）', medications: ['氯氮平片'] },
        { type: 'action', title: '查看完整用药计划', actions: [{ label: '前往用药计划', to: '/schedule' }] },
      ],
    };
  }
  if (q.includes('作用')) {
    return {
      content: '您正在服用的药品主要分为三类：降压药、降糖药和心血管防护药。以下是各药品的主要作用：',
      cards: [
        { type: 'medication', title: '硝苯地平缓释片', detail: '钙通道阻滞剂，通过扩张血管降低血压，用于治疗高血压。', medications: ['硝苯地平缓释片'] },
        { type: 'medication', title: '二甲双胍缓释片', detail: '改善胰岛素抵抗，减少肝脏葡萄糖输出，用于2型糖尿病。', medications: ['二甲双胍缓释片'] },
        { type: 'medication', title: '格列美脲片', detail: '促进胰岛β细胞分泌胰岛素，降低血糖。', medications: ['格列美脲片'] },
      ],
    };
  }
  if (q.includes('漏服')) {
    return {
      content: '漏服药品的处理需根据药品类型判断。针对您的情况，给出以下建议：',
      cards: [
        { type: 'risk', title: '氯氮平片（昨晚漏服）', level: 'mid', detail: '若漏服时间接近下一次服药时间，不建议补服，按原计划继续即可。切勿一次服用双倍剂量。' },
        { type: 'tip', title: '降压药漏服原则', detail: '硝苯地平缓释片若漏服不超过2小时，可立即补服；若已接近下次服药时间，跳过漏服剂量。' },
        { type: 'risk', title: '降糖药漏服注意', level: 'high', detail: '格列美脲片漏服后切勿自行加倍剂量，否则可能导致严重低血糖。建议监测血糖后决定。' },
        { type: 'action', title: '建议操作', actions: [{ label: '查看用药计划', to: '/schedule' }, { label: '咨询风险分析', to: '/risk' }] },
      ],
    };
  }
  if (q.includes('水果') || q.includes('葡萄柚') || q.includes('食物')) {
    return {
      content: '部分食物会与您服用的药品产生相互作用，需要特别注意：',
      cards: [
        { type: 'risk', title: '葡萄柚 / 西柚汁', level: 'high', detail: '葡萄柚会抑制肝脏代谢酶，显著升高硝苯地平血药浓度，可能引起血压过低。服用降压药期间应避免食用。', medications: ['硝苯地平缓释片'] },
        { type: 'tip', title: '高糖水果', detail: '西瓜、葡萄等高糖水果可能影响血糖控制，建议适量食用并在餐后监测血糖。', medications: ['格列美脲片', '二甲双胍缓释片'] },
        { type: 'tip', title: '建议水果', detail: '苹果、梨、柚子（非葡萄柚）等低升糖指数水果较为适宜，建议在两餐之间食用。' },
      ],
    };
  }
  if (q.includes('血压')) {
    return {
      content: '根据您近 7 天的健康数据，血压整体较为稳定，但有一次晚间血压略高。',
      cards: [
        { type: 'health', title: '近 7 天血压趋势', detail: '收缩压平均 133 mmHg，舒张压平均 83 mmHg，整体在合理范围。' },
        { type: 'risk', title: '需关注', level: 'mid', detail: '前天晚间血压 142/88 mmHg，略有升高，建议持续关注睡前血压。' },
        { type: 'action', title: '查看详细数据', actions: [{ label: '前往健康数据', to: '/health' }] },
      ],
    };
  }
  if (q.includes('冲突') || q.includes('一起吃') || q.includes('相互作用')) {
    return {
      content: 'AI 已分析您当前 5 种药品的相互作用，发现 2 项高风险与 2 项中风险因素：',
      cards: [
        { type: 'risk', title: '格列美脲 + 阿司匹林', level: 'high', detail: '阿司匹林增强格列美脲降糖作用，增加低血糖风险。', medications: ['格列美脲片', '阿司匹林肠溶片'] },
        { type: 'risk', title: '两种降糖药联用', level: 'high', detail: '格列美脲与二甲双胍联用增加低血糖风险，需监测血糖。', medications: ['格列美脲片', '二甲双胍缓释片'] },
        { type: 'risk', title: '氯氮平 + 降压药', level: 'mid', detail: '氯氮平可能加重体位性低血压，起床宜缓。', medications: ['氯氮平片', '硝苯地平缓释片'] },
        { type: 'action', title: '查看完整风险分析', actions: [{ label: '前往风险分析', to: '/risk' }] },
      ],
    };
  }
  return {
    content: '我已了解您的问题。基于您的健康档案，我可以帮您分析用药、健康数据与风险。您可以试试左侧的快捷问题，或直接描述您的疑问。',
    cards: [{ type: 'tip', title: '温馨提示', detail: '本助手提供的建议仅供参考，不能替代医生诊断与处方。如出现严重不适，请及时就医。' }],
  };
}

export function AssistantPage() {
  const { showToast, askAssistant } = useApp();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<AIMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: AIMessage = { id: `u_${Date.now()}`, role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setTyping(true);
    try {
      // 首轮对话不传 conversationId，扣子自动创建会话并返回；后续轮次带上以维持上下文
      const response = await askAssistant(text, conversationId ?? undefined);
      if (response.conversation_id) setConversationId(response.conversation_id);
      setMessages((m) => [...m, { id: `a_${Date.now()}`, role: 'assistant', content: response.content, cards: response.cards, timestamp: new Date().toISOString() }]);
    } catch {
      showToast('助手暂时无法连接，请确认后端服务已启动', 'error');
    } finally {
      setTyping(false);
    }
  };

  const reset = () => { setMessages(initialMessages); setConversationId(null); showToast('已清空对话，开启新会话'); };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
        {/* Chat area */}
        <Card className="flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-sage-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-600">
                <Bot size={22} />
              </div>
              <div>
                <h2 className="font-semibold text-sage-800">AI 智能用药助手</h2>
                <p className="text-xs text-sage-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sage-500" /> AI 已读取您的健康档案
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
                <div className={cn('max-w-[80%]', m.role === 'user' && 'text-right')}>
                  <div className={cn('inline-block px-4 py-2.5 rounded-2xl text-sm', m.role === 'user' ? 'bg-sky-50 text-sky-800 rounded-tr-sm' : 'bg-cream-50 text-sage-700 rounded-tl-sm border border-sage-100')}>
                    {m.content}
                  </div>
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
                placeholder="输入您的用药问题…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
              />
              <Button icon={<Send size={16} />} onClick={() => send(input)}>发送</Button>
            </div>
          </div>
        </Card>

        {/* Quick questions sidebar */}
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm font-semibold text-sage-800 mb-3 flex items-center gap-1.5">
              <Sparkles size={16} className="text-sage-600" /> 快捷问题
            </p>
            <div className="space-y-2">
              {aiQuickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="w-full text-left px-3 py-2.5 rounded-xl bg-cream-50/60 hover:bg-sage-50 border border-sage-100 text-sm text-sage-700 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4 bg-sage-50/40 border-sage-100">
            <p className="text-xs text-sage-500 flex gap-1.5">
              <Stethoscope size={14} className="shrink-0 mt-0.5" />
              本助手已读取您的健康档案与药品信息，可提供个性化建议。但所有内容仅供参考，不能替代医生诊断。
            </p>
          </Card>
        </div>
      </div>
    </div>
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
