import type { Medication, UserProfile, RiskAlert, RiskLevel } from '@/types';

// ============================================================
// 药品副作用知识库 —— 用老人能听懂的话描述
// ============================================================

interface SideEffectInfo {
  effects: string[];
  advice: string;
  level: RiskLevel;
  plainAdvice: string; // 老人能听懂的通俗建议
}

const SIDE_EFFECT_DB: Record<string, SideEffectInfo> = {
  '二甲双胍缓释片': {
    effects: ['恶心', '腹泻', '腹胀', '食欲不振'],
    advice: '建议餐中或餐后立即服用，可明显减轻胃肠道不适；刚开始吃时可能有点拉肚子，一般一两周后会慢慢适应，如果腹泻严重请咨询医生。',
    level: 'mid',
    plainAdvice: '吃二甲双胍容易肚子咕噜叫或拉肚子。AI建议：把这顿药放在吃完饭马上吃，不要空腹吃。如果今天拉肚子超过3次，记得多喝点淡盐水，明天赶紧给医生打电话问问要不要调药。',
  },
  '格列美脲片': {
    effects: ['恶心', '腹胀', '皮肤瘙痒', '头晕'],
    advice: '建议早餐前约30分钟服用，服药后一定要按时吃饭；如果身上起疹子、痒得厉害，要停药并去看医生。',
    level: 'mid',
    plainAdvice: '吃格列美脲可能会觉得胃里不舒服或者皮肤痒。AI建议：早饭前半小时吃这药，吃完药一定要按时吃早饭，别饿着。如果身上起了红疹子或者痒得受不了，赶紧停药去医院看看。',
  },
  '硝苯地平缓释片': {
    effects: ['脸部发红发热', '脚踝水肿', '头痛', '心慌'],
    advice: '不要和柚子汁一起吃；如果脚肿得明显或者头痛一直不缓解，要告诉医生。',
    level: 'low',
    plainAdvice: '吃硝苯地平可能会脸红发烫、脚脖子肿，或者有点头痛心慌。AI建议：吃药期间别喝柚子汁。如果脚肿得穿不上鞋，或者头痛好几天不见好，赶紧去医院跟医生说说，可能要调调药。',
  },
  '阿司匹林肠溶片': {
    effects: ['胃部不舒服', '恶心', '牙龈出血', '大便发黑'],
    advice: '肠溶片要空腹整片吞下去，不要嚼碎；平时留意有没有牙龈出血、大便发黑的情况，如果有要尽快看医生。',
    level: 'mid',
    plainAdvice: '长期吃阿司匹林要留意胃和出血的情况。AI建议：肠溶片要空腹整片吞下去，别嚼碎吃。平时刷牙看看有没有牙龈出血，大便颜色如果发黑像柏油一样，赶紧去医院，这可能是胃出血的信号。',
  },
  '氯氮平片': {
    effects: ['犯困嗜睡', '口干', '头晕', '便秘'],
    advice: '睡前吃，起床的时候先在床边坐一会儿再慢慢站起来，防止头晕摔倒；多喝水、多吃蔬菜预防便秘。',
    level: 'mid',
    plainAdvice: '吃氯氮平容易犯困、口干、头晕，还可能便秘。AI建议：这药睡前吃，第二天醒来别猛的一下坐起来，先在床上躺半分钟，再坐半分钟，再慢慢站起来。平时多喝水多吃蔬菜，要是好几天不拉大便，用点开塞露或者问问医生。',
  },
  '氨氯地平贝那普利片': {
    effects: ['干咳', '脚踝水肿', '头痛', '头晕'],
    advice: '如果干咳影响休息，可以告诉医生换一种药；起床动作慢一点防止头晕。',
    level: 'low',
    plainAdvice: '吃这个药可能会干咳、脚肿或者头晕。AI建议：如果干咳咳得晚上睡不着觉，跟医生说说能不能换一种药。起床的时候慢一点，别猛的站起来，防止头晕摔倒。',
  },
};

// ============================================================
// 药物相互作用规则
// ============================================================

interface InteractionRule {
  meds: string[];
  type: string;
  level: RiskLevel;
  reason: string;
  analysis: string;
  suggestion: string;
  plainAdvice: string;
}

const INTERACTION_RULES: InteractionRule[] = [
  {
    meds: ['格列美脲片', '二甲双胍缓释片'],
    type: '联用副作用提醒',
    level: 'mid',
    reason: '两种降糖药一起吃，可能增加胃肠道不舒服的几率，比如恶心、腹胀、拉肚子。',
    analysis: '格列美脲促进胰岛素分泌，二甲双胍改善身体对胰岛素的利用，两者联用是常用方案，但老年人肠胃功能较弱，两种药叠加可能加重消化道不适。',
    suggestion: '二甲双胍建议吃饭中间或刚吃完饭就吃，格列美脲建议饭前30分钟吃，两种药错开时间可以减轻胃肠刺激；如果拉肚子持续不好转要咨询医生。',
    plainAdvice: '这两种降糖药碰到一起，可能会让您肚子更不舒服，比如恶心、腹胀、拉肚子。AI建议：二甲双胍放在吃完饭马上吃，格列美脲饭前半小时吃，两种药错开点时间。如果拉得厉害，多喝点淡盐水，赶紧问问医生要不要调药。',
  },
  {
    meds: ['阿司匹林肠溶片', '格列美脲片'],
    type: '联用注意事项',
    level: 'low',
    reason: '两种药都可能刺激胃，一起在早上吃可能加重胃部不舒服。',
    analysis: '阿司匹林肠溶片空腹吃对胃刺激较小，格列美脲需要饭前30分钟服用，两者间隔开可以减少胃肠刺激叠加，同时不影响各自药效。',
    suggestion: '建议起床后先空腹吃阿司匹林，过20到30分钟再吃格列美脲，然后吃早饭；留意有没有胃痛、反酸的情况。',
    plainAdvice: '这两种药都有点刺激胃，放一起吃可能胃更难受。AI建议：起床后先空腹吃阿司匹林，等20多分钟再吃格列美脲，然后吃早饭。如果觉得胃痛、反酸，跟医生说说要不要调整吃药时间。',
  },
  {
    meds: ['硝苯地平缓释片', '氯氮平片'],
    type: '起身头晕风险',
    level: 'high',
    reason: '降压药和安眠药一起吃，起床时可能出现一过性头晕，容易摔倒。',
    analysis: '氯氮平有扩张血管的作用，和硝苯地平的降压效果叠加，从躺着变成坐着、从坐着变成站着的时候，血压可能突然降下来，导致头晕眼花，老年人摔倒风险高。',
    suggestion: '晚上起夜上厕所，一定要先在床边坐30秒，再扶着东西慢慢站起来；白天起床也要慢一点；如果觉得头晕眼花，马上坐下或扶稳，不要硬撑。',
    plainAdvice: '这两种药碰到一起，可能会让您觉得特别晕，尤其是早上起床的时候。AI建议：醒来后在床上先坐30秒，动动脚踝，再慢慢站起来。浴室地上铺个防滑垫，别摔着。如果觉得天旋地转，赶紧坐下或抓住旁边的东西，别硬撑。',
  },
  {
    meds: ['阿司匹林肠溶片', '硝苯地平缓释片'],
    type: '出血倾向提醒',
    level: 'low',
    reason: '阿司匹林预防血栓，长期吃要留意有没有异常出血。',
    analysis: '阿司匹林通过抑制血小板聚集来预防心脑血管事件，长期服用期间如果出现外伤或手术，出血时间可能延长，需要提前告知医生。',
    suggestion: '平时刷牙留意有没有牙龈出血，大便颜色有没有发黑；如果需要拔牙或做手术，提前告诉医生您在吃阿司匹林。',
    plainAdvice: '长期吃阿司匹林要多留意出血的情况。AI建议：平时刷牙看看牙龈有没有出血，大便颜色如果发黑要当心。要是需要拔牙或者做什么小手术，提前跟医生说您在吃阿司匹林，别瞒着。',
  },
];

// ============================================================
// 慢病适配
// ============================================================

function hasCondition(user: UserProfile | null, keyword: string): boolean {
  if (!user) return false;
  return user.chronicConditions.some((c) => c.includes(keyword));
}

// ============================================================
// 动态风险生成主函数
// ============================================================

export interface RiskEngineResult {
  alerts: RiskAlert[];
  score: number;
  summary: string;
  highCount: number;
  midCount: number;
  lowCount: number;
}

let riskCounter = 0;
function nextRiskId(): string {
  riskCounter += 1;
  return `dyn_r_${Date.now()}_${riskCounter}`;
}

export function generateRisks(user: UserProfile | null, medications: Medication[]): RiskEngineResult {
  const alerts: RiskAlert[] = [];
  const medNames = medications.map((m) => m.name);

  // ---- 1. 单药副作用提醒 ----
  medications.forEach((med) => {
    const info = SIDE_EFFECT_DB[med.name];
    if (!info) return;
    const isDiabetes = hasCondition(user, '糖尿病');
    const isDiabetesMed = med.category === '降糖药' || med.name.includes('格列') || med.name.includes('二甲双胍');

    let reason = `长期服用${med.name}，可能出现${info.effects.slice(0, 3).join('、')}等不适。`;
    let analysis = `${med.name}属于${med.category || '相关药物'}，上述副作用在老年患者中较为常见，多数可通过调整服药时间或对症处理缓解。`;

    if (isDiabetes && isDiabetesMed) {
      reason = `您有糖尿病，正在服用${med.name}，需要留意${info.effects.slice(0, 3).join('、')}等副作用，同时服药后要按时吃饭。`;
      analysis = `${med.name}是常用降糖药物，老年糖尿病患者胃肠功能相对较弱，出现胃肠道不适的比例较高；按时进餐、规律服药可以减少不适。`;
    }

    alerts.push({
      id: nextRiskId(),
      type: `${med.name}副作用提醒`,
      level: info.level,
      medications: [med.name],
      reason,
      aiAnalysis: analysis,
      suggestion: info.advice,
      plainAdvice: info.plainAdvice,
    });
  });

  // ---- 2. 药物相互作用 ----
  INTERACTION_RULES.forEach((rule) => {
    const allMatch = rule.meds.every((m) => medNames.includes(m));
    if (!allMatch) return;

    alerts.push({
      id: nextRiskId(),
      type: rule.type,
      level: rule.level,
      medications: rule.meds,
      reason: rule.reason,
      aiAnalysis: rule.analysis,
      suggestion: rule.suggestion,
      plainAdvice: rule.plainAdvice,
    });
  });

  // ---- 3. 过敏禁忌提醒 ----
  if (user && user.allergies.length > 0) {
    medications.forEach((med) => {
      const matchedAllergies = user.allergies.filter((a) => {
        const medText = `${med.name} ${med.genericName || ''} ${(med.contraindications || []).join(' ')} ${med.precautions || ''}`;
        return medText.includes(a) || a.includes(med.name.slice(0, 2));
      });
      if (matchedAllergies.length > 0) {
        alerts.push({
          id: nextRiskId(),
          type: '过敏禁忌提醒',
          level: 'high',
          medications: [med.name],
          reason: `您对${matchedAllergies.join('、')}过敏，服用${med.name}前请务必确认成分是否安全。`,
          aiAnalysis: `患者过敏史包含${matchedAllergies.join('、')}，${med.name}的成分或辅料可能存在交叉过敏风险，需仔细核对药品说明书中的成分表。`,
          suggestion: '服药前仔细查看药品说明书中的成分表，如果不确定是否含过敏成分，请咨询医生或药师，不要自行服用。',
          plainAdvice: `您对${matchedAllergies.join('、')}过敏，吃${med.name}之前一定要看清楚成分。AI建议：拿出药品说明书，找到成分那一栏，一个字一个字对一遍。要是拿不准有没有过敏成分，先别吃，打个电话问问医生或者药店的人，确认安全了再吃。`,
        });
      }
    });
  }

  // ---- 4. 每日多次用药 —— 服药间隔提醒 ----
  medications
    .filter((m) => m.frequencyPerDay >= 2)
    .forEach((med) => {
      const interval = Math.round(24 / med.frequencyPerDay);
      alerts.push({
        id: nextRiskId(),
        type: `${med.name}服药间隔提醒`,
        level: 'low',
        medications: [med.name],
        reason: `${med.name}每天吃${med.frequencyPerDay}次，两次之间要间隔大约${interval}小时，间隔不规律会影响药效。`,
        aiAnalysis: '缓释制剂需要保持体内药物浓度稳定，服药间隔不规律可能导致血药浓度波动，影响疗效或增加不良反应。',
        suggestion: '建议每天固定时间服用，比如早8点晚8点，用闹钟提醒，避免漏服或两次吃的时间太近。',
        plainAdvice: `${med.name}每天要吃${med.frequencyPerDay}次，两次之间得隔大约${interval}小时，吃乱了会影响药效。AI建议：每天固定时间吃，比如早8点晚8点，手机上个闹钟，到点就吃。别想起来才吃，也别两次吃的时间太近。`,
      });
    });

  // ---- 5. 慢病专属建议 ----
  if (hasCondition(user, '糖尿病')) {
    const diabetesMeds = medications.filter((m) => m.category === '降糖药' || m.name.includes('格列') || m.name.includes('二甲双胍') || m.name.includes('胰岛素'));
    if (diabetesMeds.length > 0) {
      alerts.push({
        id: nextRiskId(),
        type: '糖尿病用药日常提醒',
        level: 'mid',
        medications: diabetesMeds.map((m) => m.name),
        reason: '您有糖尿病，长期吃降糖药，除了按时吃药，还要留意吃饭规律和定期查血糖。',
        aiAnalysis: '老年糖尿病患者用药方案复杂，依从性和饮食配合是血糖控制的关键；规律进餐、按时服药、定期监测可以减少血糖波动和并发症风险。',
        suggestion: '每天按时吃饭、按时吃药，不要漏餐；自备血糖仪定期查空腹和餐后血糖；身上常备糖块或饼干，万一出现心慌、出汗、手抖时及时吃一点。',
        plainAdvice: '您有糖尿病，长期吃降糖药，光吃药还不够，吃饭和查血糖也很重要。AI建议：每天按时吃饭、按时吃药，别一顿吃一顿不吃。家里备个血糖仪，经常查查空腹和饭后的血糖。兜里常备几块糖或者饼干，万一觉得心慌、出汗、手抖，赶紧吃一点。',
      });
    }
  }

  if (hasCondition(user, '高血压')) {
    const bpMeds = medications.filter((m) => m.category === '降压药' || m.name.includes('硝苯') || m.name.includes('氨氯') || m.name.includes('贝那') || m.name.includes('缬沙'));
    if (bpMeds.length > 0) {
      alerts.push({
        id: nextRiskId(),
        type: '高血压用药日常提醒',
        level: 'low',
        medications: bpMeds.map((m) => m.name),
        reason: '您有高血压，吃降压药期间要少吃盐，定期量血压，不要自己随便停药。',
        aiAnalysis: '高血压是慢性病，需要长期规律服药，自行停药可能导致血压反弹，增加心脑血管事件风险；低盐饮食和规律监测有助于血压平稳。',
        suggestion: '每天盐控制在啤酒瓶盖一平盖以内；早晚各量一次血压并记录；即使血压正常了也要继续吃药，停药或减药一定要先问医生。',
        plainAdvice: '您有高血压，吃降压药的时候嘴要淡一点，别吃太咸，也别自己说停就停。AI建议：每天吃盐别超过一个啤酒瓶盖那么多。早晚各量一次血压，拿个本子记下来。就算血压量着正常了，药也得接着吃，想停药或者减药一定先问医生，别自己做主。',
      });
    }
  }

  // ---- 统计和评分 ----
  const highCount = alerts.filter((a) => a.level === 'high').length;
  const midCount = alerts.filter((a) => a.level === 'mid').length;
  const lowCount = alerts.filter((a) => a.level === 'low').length;

  const score = Math.max(40, 100 - highCount * 10 - midCount * 5 - lowCount * 2);

  const conditionText = user && user.chronicConditions.length > 0
    ? `您有${user.chronicConditions.join('、')}，`
    : '';
  const summary = `AI 综合分析了您当前服用的 ${medications.length} 种药品、${conditionText}识别出 ${highCount} 项需重点关注、${midCount} 项中等提醒 与 ${lowCount} 项日常注意事项。请重点关注高风险项目，按建议调整服药习惯。`;

  const levelOrder: Record<RiskLevel, number> = { high: 0, mid: 1, low: 2 };
  alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  return { alerts, score, summary, highCount, midCount, lowCount };
}
