import type { AICard, HealthRecord, Medication, ScheduleDose, UserProfile } from '@/types';
import type { AssistantProfileSummary } from '@/lib/api';

/**
 * 前端本地应答引擎（兜底用）。
 *
 * 场景：后端不可达（没启动、网络断开、部署的接口挂了）时，助手页原本只弹一句
 * 「助手暂时无法连接，请确认后端服务已启动」，对话区一片空白——用户会觉得这模块是坏的。
 *
 * 这里在浏览器侧用同一套意图规则 + 用户已经加载到前端的真实数据（档案/用药/今日计划/
 * 健康记录）生成回答，保证「问什么都有回应」。回答质量不如后端大模型，但信息来自真实数据，
 * 不会编造数值。
 */

interface LocalContext {
  user: UserProfile | null;
  medications: Medication[];
  schedule: ScheduleDose[];
  healthRecords: HealthRecord[];
}

interface LocalAnswer {
  content: string;
  cards?: AICard[];
}

const DISCLAIMER = '以上内容仅供参考，不能替代医生诊断。用药相关的调整请先咨询医生或药师。';

const MED_KNOWLEDGE: Record<string, { cls: string; action: string; side: string }> = {
  地平: { cls: '钙通道阻滞剂（降压药）', action: '通过扩张血管降低血压。', side: '可能出现脚踝水肿、面部潮红、头痛、心跳偏快，多会逐渐减轻。' },
  普利: { cls: '血管紧张素转换酶抑制剂（降压药）', action: '扩张血管降压，同时保护心脏和肾脏。', side: '部分人会出现干咳，需定期复查肾功能和血钾。' },
  沙坦: { cls: '血管紧张素受体拮抗剂（降压药）', action: '阻断受体降压，作用平稳。', side: '偶有头晕、血钾升高。' },
  洛尔: { cls: 'β受体阻滞剂', action: '减慢心率、降低心肌耗氧。', side: '可能心跳偏慢、乏力、手脚发凉，不能突然停药。' },
  二甲双胍: { cls: '双胍类降糖药', action: '减少肝糖输出、改善胰岛素抵抗。', side: '常见胃肠不适，随餐服用可减轻。' },
  格列: { cls: '磺脲类降糖药', action: '刺激胰岛素分泌降血糖。', side: '低血糖风险较高，漏服后切勿自行加倍。' },
  阿司匹林: { cls: '抗血小板药', action: '抑制血小板聚集，预防心梗、脑梗。', side: '可能胃部不适、易出血、大便发黑。' },
  他汀: { cls: '调脂药', action: '降低胆固醇、稳定血管斑块。', side: '少数人肌肉酸痛、肝酶升高。' },
  氯氮平: { cls: '抗精神病药', action: '控制精神症状、辅助镇静。', side: '可能嗜睡、头晕、体位性低血压，起身要慢。' },
};

const FOOD_RULES: { keys: string[]; level: 'high' | 'mid' | 'low'; text: string }[] = [
  { keys: ['葡萄柚', '西柚'], level: 'high', text: '葡萄柚（西柚）会抑制肝脏代谢酶，让部分降压药、他汀类药的血药浓度明显升高，可能造成血压过低。服药期间请避免食用。' },
  { keys: ['酒', '白酒', '啤酒'], level: 'high', text: '酒精会加强降压药和镇静药的作用，容易引起低血压、头晕、跌倒，也会干扰血糖。服药期间建议不饮酒。' },
  { keys: ['牛奶', '豆浆'], level: 'low', text: '牛奶、豆浆与常用慢病药没有严重冲突，建议与服药时间错开 1~2 小时，避免影响吸收。' },
  { keys: ['茶', '咖啡'], level: 'mid', text: '浓茶、咖啡含咖啡因，会让心率加快、血压波动、影响睡眠，建议与服药时间错开，下午后少喝。' },
  { keys: ['香蕉', '橙子', '菠菜', '紫菜'], level: 'mid', text: '这类食物富含钾。服用普利类、沙坦类降压药时大量摄入可能使血钾升高，建议适量并复查血钾。' },
  { keys: ['西瓜', '葡萄', '荔枝', '甜'], level: 'mid', text: '高糖水果会让血糖明显波动，建议放在两餐之间、每次一小份，并监测餐后血糖。' },
  { keys: ['盐', '咸菜', '腌'], level: 'high', text: '高盐饮食是血压升高的重要原因，建议每天食盐控制在 5 克以内，少吃咸菜和腌制品。' },
];

const EMERGENCY_KEYS = ['胸痛', '胸口痛', '胸闷', '呼吸困难', '喘不上气', '昏倒', '晕倒', '昏迷', '抽搐', '嘴歪', '说话不清', '大出血', '剧烈头痛'];

/** 剂型后缀：老人平时只记药名主体（「二甲双胍」），不会带上「缓释片」 */
const DOSE_FORM_SUFFIX = /(缓释胶囊|缓释片|肠溶片|分散片|咀嚼片|胶囊|颗粒|口服液|注射液|滴眼液|乳膏|软膏|喷雾剂|片|丸|散|膏)$/;

function nameTokens(m: Medication): string[] {
  const tokens = new Set<string>();
  if (m.name) tokens.add(m.name);
  if (m.genericName) tokens.add(m.genericName);
  const bare = (m.name || '').replace(DOSE_FORM_SUFFIX, '');
  if (bare.length >= 2) tokens.add(bare);
  return [...tokens];
}

function findMeds(question: string, meds: Medication[]): Medication[] {
  const hits = meds.filter((m) => nameTokens(m).some((token) => question.includes(token)));
  if (hits.length) return hits;
  return meds.filter((m) => m.category && m.category !== '其他' && question.includes(m.category));
}

function knowledgeOf(name: string) {
  return Object.entries(MED_KNOWLEDGE).find(([key]) => name.includes(key))?.[1];
}

function latestRecord(records: HealthRecord[]): HealthRecord | null {
  if (!records.length) return null;
  return [...records].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))[0];
}

function doseStats(schedule: ScheduleDose[]) {
  return {
    total: schedule.length,
    taken: schedule.filter((d) => d.status === 'taken').length,
    pending: schedule.filter((d) => d.status === 'pending').length,
    missed: schedule.filter((d) => d.status === 'missed').length,
  };
}

const PROFILE_FIELDS: { label: string; filled: (u: UserProfile) => boolean }[] = [
  { label: '年龄', filled: (u) => Boolean(u.age) },
  { label: '身高', filled: (u) => Boolean(u.height) },
  { label: '体重', filled: (u) => Boolean(u.weight) },
  { label: '血型', filled: (u) => Boolean(u.bloodType) },
  { label: '慢性病史', filled: (u) => u.chronicConditions.length > 0 },
  { label: '紧急联系人', filled: (u) => Boolean(u.emergencyContact) },
];

function profileFacts(ctx: LocalContext): string[] {
  const facts: string[] = [];
  if (ctx.user?.chronicConditions.length) facts.push(`慢性病史 ${ctx.user.chronicConditions.join('、')}`);
  if (ctx.medications.length) facts.push(`在服药品 ${ctx.medications.length} 种`);
  const latest = latestRecord(ctx.healthRecords);
  if (latest) facts.push(`最近一次血压 ${latest.systolic}/${latest.diastolic} mmHg`);
  return facts;
}

function missingFields(ctx: LocalContext): string[] {
  if (!ctx.user) return [];
  const missing = PROFILE_FIELDS.filter((f) => !f.filled(ctx.user as UserProfile)).map((f) => f.label);
  if (!ctx.medications.length) missing.push('在服药品');
  return missing;
}

/** 本地生成回答；返回 null 表示无法处理（调用方展示通用的断线说明） */
export function answerLocally(question: string, ctx: LocalContext): LocalAnswer {
  const q = (question || '').trim();
  const user = ctx.user;
  const name = user?.name || '您';
  const activeMeds = ctx.medications.filter((m) => m.status === 'active');
  const meds = activeMeds.length ? activeMeds : ctx.medications;
  const stats = doseStats(ctx.schedule);
  const latest = latestRecord(ctx.healthRecords);
  const cards: AICard[] = [];
  const missing = missingFields(ctx);

  // 0) 急救优先
  if (EMERGENCY_KEYS.some((k) => q.includes(k))) {
    return {
      content: `您描述的这种情况需要马上处理，请先别自己判断、也别自行加药或停药：\n\n1. 立刻拨打 **120**，或让身边人马上送医。\n2. 保持坐位休息，不要剧烈活动，解开领口。\n3. 带上您的药盒或用药清单，医生需要知道您正在吃的每一种药。\n\n如果是低血糖引起的心慌、出冷汗、手抖，可以立刻吃两块糖，15 分钟后再测一次血糖。`,
      cards: [
        { type: 'risk', title: '紧急情况：请立即就医', level: 'high', detail: '胸痛、呼吸困难、意识不清等可能是心脑血管急症，必须由医生处理。' },
        { type: 'action', title: '联系家人', actions: [{ label: '打开家属监护', to: '/family' }] },
      ],
    };
  }

  // 1) 寒暄 / 我是谁
  if (['你好', '您好', '你是谁', '在吗', '介绍一下', '早上好', '晚上好', '下午好'].some((k) => q.includes(k))) {
    const lines = [`${name}您好，我是您的 AI 用药助手。`];
    const facts = profileFacts(ctx);
    if (facts.length) lines.push(`\n我这边记录到的情况是：${facts.join('，')}。`);
    if (stats.total) lines.push(`今天的用药：已服 ${stats.taken} 次、待服 ${stats.pending} 次、漏服 ${stats.missed} 次。`);
    lines.push('\n您可以问我任何用药和健康方面的问题，比如「今天还要吃哪些药」「这个药有什么副作用」「我最近的血压怎么样」，直接说就行。');
    if (missing.length) lines.push(`\n提醒一句：您的档案还缺 ${missing.join('、')}，补全后我给的建议会更贴合您。`);
    if (missing.length) cards.push({ type: 'action', title: '完善档案', actions: [{ label: '去完善健康档案', to: '/profile' }] });
    return { content: lines.join('\n'), cards: cards.length ? cards : undefined };
  }

  // 2) 查档案
  if (['我的档案', '我的信息', '我是谁', '我叫什么', '我的年龄', '我的病史', '慢性病', '我的血型', '个人信息', '健康档案', '我有什么病'].some((k) => q.includes(k))) {
    if (!user) return { content: '我这次没有读到您的档案信息，请刷新页面后重试。' };
    const lines = [
      '我这边记录到的您的健康档案是：\n',
      `- 姓名：${user.name}`,
      `- 年龄：${user.age || '未填写'}（${user.gender || '性别未填写'}）`,
      `- 身高体重：${user.height || '未填写'} cm / ${user.weight || '未填写'} kg`,
      `- 血型：${user.bloodType || '未填写'}`,
      `- 慢性病史：${user.chronicConditions.join('、') || '未填写'}`,
      `- 过敏史：${user.allergies.join('、') || '未填写'}`,
      `- 在服药品：${meds.length} 种`,
      `- 紧急联系人：${user.emergencyContact || '未填写'}`,
    ];
    if (missing.length) {
      lines.push(`\n还有 ${missing.length} 项没录全：${missing.join('、')}。`);
      cards.push({ type: 'action', title: '完善档案', actions: [{ label: '去完善健康档案', to: '/profile' }] });
    }
    return { content: lines.join('\n'), cards };
  }

  // 3) 过敏
  if (q.includes('过敏')) {
    const allergies = user?.allergies ?? [];
    if (!allergies.length) {
      return {
        content: '您的过敏史这一项还没有填写。为了用药安全建议补上——很多人是对某种抗生素或解热镇痛药过敏，医生开药时必须知道。',
        cards: [{ type: 'action', title: '填写过敏史', actions: [{ label: '去完善健康档案', to: '/profile' }] }],
      };
    }
    return {
      content: `您的过敏史登记为：**${allergies.join('、')}**。\n\n- 每次看病、买药都主动告诉医生和药师；\n- 拿药后看清成分表，避免买到含同类成分的药；\n- 服药后出现皮疹、嘴唇或眼皮肿、呼吸困难，立即停药并就医。`,
      cards: [{ type: 'risk', title: `过敏史：${allergies.join('、')}`, level: 'high', detail: '就诊购药时务必主动告知。' }],
    };
  }

  // 4) 情绪
  if (['心情', '烦', '焦虑', '抑郁', '不开心', '孤独'].some((k) => q.includes(k))) {
    return {
      content: `${name}，情绪不好时血压血糖也会跟着波动，照顾心情和照顾身体一样重要。\n\n1. 找家人或老邻居聊聊天，把心里的事说出来。\n2. 天气好时下楼晒晒太阳，慢慢走 20 分钟。\n3. 做点喜欢的事：听戏曲、养花、听广播。\n4. 深呼吸放松：吸气 4 秒、屏住 4 秒、呼气 6 秒，重复 5 次。\n\n如果这种状态持续两周以上，或者影响到吃饭睡觉，请一定告诉家人，也可以找医生聊聊。`,
      cards: [{ type: 'tip', title: '情绪与慢病', detail: '情绪波动会影响血压血糖，规律作息和家人交流很重要。' }],
    };
  }

  // 5) 副作用 / 身体不适
  if (['副作用', '不良反应', '不舒服', '难受', '头晕', '恶心', '皮疹', '干咳', '水肿'].some((k) => q.includes(k))) {
    const targets = findMeds(q, meds).length ? findMeds(q, meds) : meds.slice(0, 3);
    const lines = ['任何药都可能有不良反应，但绝大多数人按医嘱剂量服用是安全的，不要因为担心就自己停药。\n'];
    targets.forEach((m) => {
      const info = knowledgeOf(m.name);
      if (info) {
        lines.push(`**${m.name}**（${info.cls}）：${info.side}`);
        cards.push({ type: 'tip', title: `${m.name}常见反应`, detail: info.side, medications: [m.name] });
      } else {
        lines.push(`**${m.name}**：${m.precautions || '暂无登记的注意事项，服药后不舒服请记录下来并告知医生。'}`);
      }
    });
    lines.push('\n**出现这些情况请尽快就医：**皮疹、呼吸困难、嘴唇眼皮肿、大便发黑、持续心慌、肌肉酸痛无力。');
    lines.push(`\n${DISCLAIMER}`);
    return { content: lines.join('\n'), cards };
  }

  // 6) 习惯性忘药
  if (['老忘', '总忘', '老是忘', '经常忘', '容易忘', '记不住吃药', '坚持不了', '不想吃药'].some((k) => q.includes(k))) {
    return {
      content: `慢病用药最怕「三天打鱼两天晒网」，给您几个好用的办法：\n\n1. 用分药盒，把一周的药按早、中、晚、睡前分好，吃没吃一眼看出来。\n2. 把药放在水杯、牙刷旁边，刷牙后顺手就吃。\n3. 在「智能用药计划」里把提醒打开，到点会叫您。\n4. 家属绑定的提醒会同步给家人，忘了一起提醒您。\n5. 吃了就在计划里点一下「已服」，复查时医生才看得清。` +
        (stats.total ? `\n\n今天的记录是：${stats.taken}/${stats.total} 次已完成，${stats.missed} 次漏服。` : ''),
      cards: [{ type: 'action', title: '设置提醒', actions: [{ label: '打开用药计划', to: '/schedule' }] }],
    };
  }

  // 7) 漏服
  if (['漏服', '忘了吃', '忘记吃', '补服'].some((k) => q.includes(k))) {
    const lines = [
      '漏服的处理原则是：**不要自行一次吃双倍剂量**，宁可少一次也不要过量。\n',
      '- 降压药、降糖药漏服后，如果已接近下次服药时间，就跳过这次。',
      '- 降糖药漏服后出现心慌、手抖、出冷汗，先吃糖块应急并及时就医。',
      '- 阿司匹林这类抗血小板药漏服一次通常影响不大，不要补双倍。',
      '- 氯氮平这类镇静药漏服，离睡觉时间还近可补半片；到第二天就直接跳过。',
    ];
    const missed = ctx.schedule.filter((d) => d.status === 'missed');
    if (missed.length) {
      const names = missed.map((d) => `${d.time} ${d.medicationName}`).join('；');
      lines.push(`\n我查到您今天漏服的是：${names}。`);
      cards.push({ type: 'risk', title: '今天有漏服的药', level: 'mid', detail: `${names}。请按上面原则处理，不要加倍补服。` });
    }
    lines.push(`\n${DISCLAIMER}`);
    cards.push({ type: 'action', title: '记录服药情况', actions: [{ label: '打开用药计划', to: '/schedule' }] });
    return { content: lines.join('\n'), cards };
  }

  // 8) 血压 / 血糖 / 心率
  if (q.includes('血压') || q.includes('高压') || q.includes('低压')) {
    const list = ctx.healthRecords.filter((r) => r.systolic && r.diastolic);
    if (!list.length) {
      return { content: '我这边还没有您的血压记录，暂时没法判断。建议每天早晚各测一次，测前静坐 5 分钟，把结果记到「健康数据」里。', cards: [{ type: 'action', title: '记录血压', actions: [{ label: '去记录健康数据', to: '/health' }] }] };
    }
    const recent = list.slice(-7);
    const avgSys = Math.round(recent.reduce((s, r) => s + r.systolic, 0) / recent.length);
    const avgDia = Math.round(recent.reduce((s, r) => s + r.diastolic, 0) / recent.length);
    const highs = recent.filter((r) => r.systolic >= 140 || r.diastolic >= 90);
    const lines = [
      `最近 ${recent.length} 次记录：收缩压平均 ${avgSys} mmHg，舒张压平均 ${avgDia} mmHg。`,
      latest ? `最近一次（${latest.date}）是 ${latest.systolic}/${latest.diastolic} mmHg。` : '',
    ];
    cards.push({ type: 'health', title: `近 ${recent.length} 次血压`, detail: `收缩压平均 ${avgSys}、舒张压平均 ${avgDia} mmHg` });
    if (highs.length) {
      const worst = highs.reduce((a, b) => (b.systolic > a.systolic ? b : a));
      lines.push(`\n有 ${highs.length} 次偏高，最高的是 ${worst.date} 的 ${worst.systolic}/${worst.diastolic} mmHg，需要留意。`);
      cards.push({ type: 'risk', title: '血压偏高', level: 'mid', detail: `${worst.date} 测到 ${worst.systolic}/${worst.diastolic} mmHg，建议复测并告知医生。` });
    } else {
      lines.push('\n整体都在 140/90 mmHg 以内，状态比较理想，继续保持。');
    }
    lines.push('\n日常注意：按时吃降压药、少盐、别熬夜、起床先坐 30 秒再站起来。连续几天偏高请找医生调整方案，不要自己加药。');
    cards.push({ type: 'action', title: '查看趋势图', actions: [{ label: '打开健康数据', to: '/health' }] });
    return { content: lines.join('\n'), cards };
  }

  if (q.includes('血糖') || q.includes('糖尿病') || q.includes('糖化')) {
    const list = ctx.healthRecords.filter((r) => r.bloodSugar);
    if (!list.length) {
      return { content: '我这边还没有您的血糖记录，暂时没法评估。建议按医生要求的时间点测量并记录到「健康数据」里。', cards: [{ type: 'action', title: '记录血糖', actions: [{ label: '去记录健康数据', to: '/health' }] }] };
    }
    const recent = list.slice(-7);
    const avg = (recent.reduce((s, r) => s + r.bloodSugar, 0) / recent.length).toFixed(1);
    const abnormal = recent.filter((r) => r.bloodSugar >= 7.0);
    const lines = [`最近 ${recent.length} 次记录：平均血糖 ${avg} mmol/L。`];
    cards.push({ type: 'health', title: `近 ${recent.length} 次血糖`, detail: `平均 ${avg} mmol/L` });
    if (abnormal.length) {
      lines.push(`\n有 ${abnormal.length} 次达到或超过 7.0 mmol/L，属于偏高，建议复查。`);
      cards.push({ type: 'risk', title: '血糖偏高', level: 'mid', detail: `${abnormal.length} 次记录达到 7.0 mmol/L 及以上。` });
    } else {
      lines.push('\n血糖控制还不错，继续保持规律饮食和用药。');
    }
    lines.push('\n日常注意：主食定量、少喝粥和含糖饮料、餐后走一走；用格列美脲这类药时要随身带糖防低血糖。');
    cards.push({ type: 'action', title: '查看趋势图', actions: [{ label: '打开健康数据', to: '/health' }] });
    return { content: lines.join('\n'), cards };
  }

  if (q.includes('心率') || q.includes('心跳') || q.includes('脉搏')) {
    const list = ctx.healthRecords.filter((r) => r.heartRate);
    if (!list.length) {
      return { content: '我这边还没有您的心率记录，测血压时一起记下来，我就能帮您看趋势。', cards: [{ type: 'action', title: '记录心率', actions: [{ label: '去记录健康数据', to: '/health' }] }] };
    }
    const recent = list.slice(-7);
    const avg = Math.round(recent.reduce((s, r) => s + r.heartRate, 0) / recent.length);
    const last = recent[recent.length - 1];
    const lines = [`最近 ${recent.length} 次记录：平均心率 ${avg} 次/分，最近一次 ${last.heartRate} 次/分。`, '安静状态下 60~100 次/分属于正常。'];
    cards.push({ type: 'health', title: `近 ${recent.length} 次心率`, detail: `平均 ${avg} 次/分` });
    if (last.heartRate < 60) lines.push('\n最近一次偏慢，如伴有乏力、头晕请告诉医生。');
    else if (last.heartRate > 100) lines.push('\n最近一次偏快，先静坐 10 分钟复测，仍偏快且心慌胸闷请就医。');
    else lines.push('\n心率在正常范围内。');
    return { content: lines.join('\n'), cards };
  }

  // 9) 饮食
  const foodHit = FOOD_RULES.filter((rule) => rule.keys.some((k) => q.includes(k)));
  if (foodHit.length || ['能吃', '能不能吃', '可以吃', '食物', '水果', '饮食', '忌口', '不能吃', '喝'].some((k) => q.includes(k))) {
    const lines: string[] = [];
    const targets = foodHit.length ? foodHit : FOOD_RULES.filter((r) => r.keys.includes('葡萄柚'));
    targets.forEach((rule) => {
      lines.push(`- **${rule.keys[0]}**：${rule.text}`);
      cards.push({ type: rule.level === 'low' ? 'tip' : 'risk', title: `${rule.keys[0]}与用药`, level: rule.level, detail: rule.text });
    });
    lines.push('\n无论吃什么，都建议与服药时间错开 1~2 小时。');
    if (!foodHit.length) {
      lines.push('\n如果您想问某一样具体的东西（比如牛奶、香蕉、浓茶），直接说名字我就能给更明确的答复。');
    }
    return { content: lines.join('\n'), cards };
  }

  // 10) 药物相互作用
  if (['冲突', '一起吃', '相互作用', '同服', '相克'].some((k) => q.includes(k))) {
    const names = meds.map((m) => m.name).join('、') || '您正在服用的药';
    return {
      content: `我核对了您正在服用的药（${names}），同时服用时主要注意：\n\n- 同一时间吃的药越多，相互影响的可能性越大，不要自行加药或换药。\n- 看其他病时，主动把用药清单给医生看，避免开出重复或冲突的药。\n- 服用阿司匹林时若同时用降糖药，要留意低血糖；出现心慌、手抖先测血糖。\n\n详细的相互作用分析在「AI 用药风险分析」页，那里有逐条的说明。`,
      cards: [{ type: 'action', title: '查看完整风险分析', actions: [{ label: '打开风险分析', to: '/risk' }] }],
    };
  }

  // 11) 停药 / 调量
  if (['停药', '能停', '减量', '加量', '加药', '换药', '加点', '多吃一粒'].some((k) => q.includes(k))) {
    const names = meds.map((m) => m.name).join('、') || '您正在服用的药';
    return {
      content: `关于停药和调整剂量，请您**不要自己决定**，尤其是${names}这类长期用的药：\n\n- 降压药突然停可能引起血压反弹升高；\n- 降糖药自己加量容易造成低血糖；\n- 阿司匹林、氯氮平突然停用也有风险。\n\n正确做法是把最近一段时间的血压、血糖记录整理好，带上药盒去找开药的医生判断。`,
      cards: [
        { type: 'risk', title: '不要自行停药或加减剂量', level: 'high', detail: '自行调整慢病用药可能引起血压反弹、低血糖或撤药反应。' },
        { type: 'action', title: '准备复查资料', actions: [{ label: '打开健康数据', to: '/health' }, { label: '打开健康报告', to: '/reports' }] },
      ],
    };
  }

  // 12) 药品详情
  const targets = findMeds(q, meds);
  if (targets.length || ['作用', '功效', '治什么', '有什么用', '怎么吃', '吃几片', '剂量', '用法', '什么时候吃'].some((k) => q.includes(k))) {
    const list = targets.length ? targets : meds.slice(0, 3);
    if (!list.length) {
      return { content: '我这边还没有您的用药记录，没法告诉您某种药的具体用法。请先在「我的药品」里添加您正在吃的药。', cards: [{ type: 'action', title: '添加药品', actions: [{ label: '打开我的药品', to: '/medications' }] }] };
    }
    const lines = ['根据您的用药记录，给您说说这些药：\n'];
    list.slice(0, 3).forEach((m) => {
      const times = m.times.join('、') || '未设置时间';
      lines.push(`**${m.name}**（${m.category || '未分类'}）`);
      lines.push(`- 用法用量：每次 ${m.dosage}，每天 ${m.frequencyPerDay} 次，时间 ${times}。用途：${m.purpose || '未填写'}。`);
      if (m.precautions) lines.push(`- 注意事项：${m.precautions}`);
      const info = knowledgeOf(m.name);
      if (info) lines.push(`- 这类药是${info.cls}：${info.action}`);
      cards.push({ type: 'medication', title: m.name, detail: `每次 ${m.dosage}，每天 ${m.frequencyPerDay} 次，时间 ${times}`, medications: [m.name] });
    });
    lines.push('\n药名、剂量、时间有变化，记得先在「我的药品」里更新，我的提醒才会准确。');
    cards.push({ type: 'action', title: '查看药品详情', actions: [{ label: '打开我的药品', to: '/medications' }] });
    return { content: lines.join('\n'), cards };
  }

  // 13) 今日用药计划
  if (['今天', '今日', '哪些药', '什么药', '用药计划', '几点吃', '该吃药', '接下来'].some((k) => q.includes(k))) {
    if (!ctx.schedule.length) {
      return { content: '今天还没有用药计划。请先确认「我的药品」里每种药的服用时间和次数是否填好了，填好后系统会自动排出每天的用药计划。', cards: [{ type: 'action', title: '检查药品', actions: [{ label: '打开我的药品', to: '/medications' }] }] };
    }
    const lines = [`今天一共 ${stats.total} 次用药，已服 ${stats.taken} 次、待服 ${stats.pending} 次、漏服 ${stats.missed} 次。\n`];
    const pending = ctx.schedule.filter((d) => d.status === 'pending');
    if (pending.length) {
      lines.push('**接下来要吃的药：**');
      pending.forEach((d) => lines.push(`- ${d.time} · ${d.medicationName} · ${d.dosage}（${d.usage || '口服'}）`));
      cards.push({ type: 'medication', title: '接下来待服用药', detail: pending.map((d) => `${d.time} ${d.medicationName} ${d.dosage}`).join('；'), medications: pending.map((d) => d.medicationName) });
    } else {
      lines.push('今天剩下的药都已经记录完成了，很不错。');
    }
    const missed = ctx.schedule.filter((d) => d.status === 'missed');
    if (missed.length) {
      lines.push('\n**已漏服的：**');
      missed.forEach((d) => lines.push(`- ${d.time} · ${d.medicationName} · ${d.dosage}`));
      lines.push('漏服的药不要一次吃双倍补回来，具体可以问我「漏服了怎么办」。');
    }
    cards.push({ type: 'action', title: '查看完整计划', actions: [{ label: '打开用药计划', to: '/schedule' }] });
    return { content: lines.join('\n'), cards };
  }

  // 14) 家属 / 隐私
  if (['家人', '家属', '谁能看', '隐私', '绑定'].some((k) => q.includes(k))) {
    return {
      content: '关于家人查看您的数据：\n\n- 只有**您同意绑定**的家人才能看到您的健康数据和用药情况；\n- 绑定需要双方确认，您可以随时解除；\n- 家人的手机能收到您的漏服和血压异常提醒；\n- 没有绑定的家人看不到您任何数据。',
      cards: [{ type: 'action', title: '管理家属', actions: [{ label: '打开家属监护', to: '/family' }] }],
    };
  }

  // 15) 报告 / 记录
  if (['报告', '记录', '完成率', '统计', '按时吃药率'].some((k) => q.includes(k))) {
    const rate = stats.total ? Math.round((stats.taken / stats.total) * 100) : 0;
    return {
      content: `今天的用药统计：共 ${stats.total} 次，已服 ${stats.taken} 次，待服 ${stats.pending} 次，漏服 ${stats.missed} 次，按时服药率 ${rate}%。\n\n周报和月报里还能看到血压、血糖、心率的平均值与趋势。复查时把报告给医生看，医生更容易判断要不要调药。`,
      cards: [
        { type: 'health', title: '今日服药完成率', detail: `${rate}%（${stats.taken}/${stats.total}）` },
        { type: 'action', title: '查看完整报告', actions: [{ label: '打开健康报告', to: '/reports' }] },
      ],
    };
  }

  // 16) 运动 / 睡眠 / 复查 / 风险
  if (['运动', '锻炼', '散步', '太极'].some((k) => q.includes(k))) {
    return {
      content: '适合您的运动是「中等强度、能正常说话」的活动：\n\n- 快走：每次 20~30 分钟，每周 5 天，饭后休息 1 小时再走。\n- 太极拳、八段锦：动作舒缓，对血压血糖都有好处。\n\n**要避免的：**憋气用力的运动（举重、拔河）、突然低头弯腰、快跑。\n\n运动时兜里带两块糖，出现心慌、手抖、出冷汗先坐下吃一块。',
      cards: [{ type: 'tip', title: '运动建议', detail: '快走 20~30 分钟 / 太极八段锦，每周 5 天' }],
    };
  }
  if (['睡不着', '失眠', '睡眠'].some((k) => q.includes(k))) {
    return {
      content: '睡不好会影响血压和血糖，可以从这几件小事做起：\n\n1. 固定作息，白天午睡别超过 30 分钟。\n2. 睡前 1 小时不看手机电视，不喝浓茶咖啡。\n3. 睡前温水泡脚 10 分钟，房间调暗。\n4. 躺下 20 分钟睡不着就起来坐一会儿再躺下。\n\n夜间起身一定要先坐 30 秒再站，防止头晕摔倒。长期失眠请找医生评估。',
      cards: [{ type: 'tip', title: '助眠小贴士', detail: '固定作息 + 睡前不喝浓茶咖啡 + 泡脚放松' }],
    };
  }
  if (['复查', '复诊', '去医院', '体检', '化验'].some((k) => q.includes(k))) {
    return {
      content: `去医院复查前建议这样准备：\n\n1. 带上所有药盒或用药清单：${meds.map((m) => `${m.name}（${m.spec}）`).join('、') || '您正在服用的药'}\n2. 带上最近的血压、血糖记录。\n3. 需要空腹抽血时，当天早上先别吃降糖药和早饭，抽完血再吃；降压药通常按原时间服用。\n4. 主动告诉医生您的慢性病和过敏史。\n5. 最好有家人陪同。`,
      cards: [{ type: 'action', title: '导出记录', actions: [{ label: '打开健康数据', to: '/health' }, { label: '打开健康报告', to: '/reports' }] }],
    };
  }
  if (['注意什么', '要注意', '该注意', '风险', '危险'].some((k) => q.includes(k))) {
    const lines = ['我把您的档案和用药过了一遍，这些是需要注意的：\n'];
    if (user?.chronicConditions.length) lines.push(`- 您有 ${user.chronicConditions.join('、')}，要按时服药、定期监测。`);
    if (user?.allergies.length) lines.push(`- 您对 ${user.allergies.join('、')} 过敏，每次看病开药都要提前告诉医生。`);
    lines.push('- 起床、起夜动作要慢，先坐 30 秒再站，防止头晕摔倒。');
    lines.push('- 饮食少盐少糖，避免葡萄柚和酒。');
    lines.push(`- 不要自行停药或加减剂量。`);
    return { content: lines.join('\n'), cards: [{ type: 'action', title: '查看完整分析', actions: [{ label: '打开风险分析', to: '/risk' }] }] };
  }

  // 17) 兜底：基于已有数据给出说明 + 引导
  const facts = profileFacts(ctx);
  const lines = ['这个问题我这次没能给出准确回答，先跟您说清楚我看到了什么，免得误导您：\n'];
  if (facts.length) lines.push(`目前的记录是：${facts.join('，')}。`);
  if (stats.total) lines.push(`今天的用药记录：已服 ${stats.taken} 次、待服 ${stats.pending} 次、漏服 ${stats.missed} 次。`);
  lines.push('\n您可以这样问我，我能答得更准：');
  lines.push('- 说药名：「二甲双胍怎么吃」「阿司匹林有什么副作用」');
  lines.push('- 说指标：「我最近血压怎么样」「血糖高不高」');
  lines.push('- 说场景：「能不能喝牛奶」「可以做什么运动」');
  lines.push(`\n${DISCLAIMER}`);
  return {
    content: lines.join('\n'),
    cards: [{ type: 'action', title: '快捷入口', actions: [{ label: '用药计划', to: '/schedule' }, { label: '健康数据', to: '/health' }, { label: '风险分析', to: '/risk' }] }],
  };
}

/** 本地兜底也要知道「AI 读到了什么」，用于助手页档案卡展示 */
export function localProfileSummary(ctx: LocalContext): AssistantProfileSummary {
  const user = ctx.user;
  const latest = latestRecord(ctx.healthRecords);
  const stats = doseStats(ctx.schedule);
  const missing = missingFields(ctx);
  const total = PROFILE_FIELDS.length + 1;
  const activeMeds = ctx.medications.filter((m) => m.status === 'active');
  return {
    name: user?.name || '未填写',
    age: user?.age ?? null,
    gender: user?.gender || '',
    height: user?.height ?? null,
    weight: user?.weight ?? null,
    blood_type: user?.bloodType || '',
    chronic_conditions: user?.chronicConditions ?? [],
    allergies: user?.allergies ?? [],
    emergency_contact: user?.emergencyContact || '',
    active_medication_count: (activeMeds.length ? activeMeds : ctx.medications).length,
    today_total: stats.total,
    today_taken: stats.taken,
    today_pending: stats.pending,
    today_missed: stats.missed,
    latest_bp: latest ? `${latest.systolic}/${latest.diastolic}` : '',
    latest_blood_sugar: latest?.bloodSugar ?? null,
    latest_heart_rate: latest?.heartRate ?? null,
    record_count: ctx.healthRecords.length,
    risk_count: 0,
    completeness: Math.round(((total - missing.length) / total) * 100),
    missing_fields: missing,
  };
}
