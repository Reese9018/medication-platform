import type {
  UserProfile, Medication, ScheduleDose, HealthRecord,
  RiskAlert, FamilyMember, AppNotification, ReportData,
} from '@/types';

// ============================================================
// Mock data — realistic elder patient with hypertension + T2DM
// ============================================================

export const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayStr = iso(today);

function daysAgo(n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return iso(d);
}

export const elderProfile: UserProfile = {
  id: 'u_elder_001',
  name: '王秀兰',
  age: 68,
  gender: '女',
  height: 158,
  weight: 62,
  role: 'elder',
  avatarColor: '#4A8265',
  chronicConditions: ['高血压', '2型糖尿病'],
  allergies: ['青霉素'],
  bloodType: 'A型',
  emergencyContact: '李明（儿子）138****6789',
  createdAt: '2024-03-12',
};

export const familyProfile: UserProfile = {
  id: 'u_family_001',
  name: '李明',
  age: 38,
  gender: '男',
  height: 175,
  weight: 74,
  role: 'family',
  avatarColor: '#3A85A8',
  chronicConditions: [],
  allergies: [],
  bloodType: 'A型',
  emergencyContact: '王秀兰（母亲）139****1234',
  createdAt: '2024-03-12',
};

export const medications: Medication[] = [
  {
    id: 'm_001',
    name: '硝苯地平缓释片',
    genericName: 'Nifedipine',
    spec: '20mg×14片',
    dosage: '1片',
    purpose: '降压，用于高血压',
    frequencyPerDay: 2,
    times: ['08:00', '20:00'],
    status: 'active',
    riskLevel: 'mid',
    category: '降压药',
    startDate: '2024-03-15',
    endDate: '2026-12-31', // 长期服用，预计年底复查后再评估
    remindBeforeMinutes: 30,
    contraindications: ['对硝苯地平过敏者禁用'],
    precautions: '可能引起面部潮红、踝部水肿；避免与葡萄柚汁同服。',
  },
  {
    id: 'm_002',
    name: '二甲双胍缓释片',
    genericName: 'Metformin',
    spec: '500mg×30片',
    dosage: '1片',
    purpose: '降糖，用于2型糖尿病',
    frequencyPerDay: 2,
    times: ['08:00', '18:00'],
    status: 'active',
    riskLevel: 'low',
    category: '降糖药',
    startDate: '2024-03-15',
    // endDate 留空 = 长期服用
    remindBeforeMinutes: 30,
    contraindications: ['严重肾功能不全禁用'],
    precautions: '餐后服用以减少胃肠道不适。',
  },
  {
    id: 'm_003',
    name: '阿司匹林肠溶片',
    genericName: 'Aspirin',
    spec: '100mg×30片',
    dosage: '1片',
    purpose: '抗血小板聚集，预防心血管事件',
    frequencyPerDay: 1,
    times: ['08:00'],
    status: 'active',
    riskLevel: 'mid',
    category: '心血管药',
    startDate: '2024-03-20',
    endDate: '2026-12-31', // 预防性用药，长期服用
    remindBeforeMinutes: 30,
    contraindications: ['活动性消化道溃疡禁用'],
    precautions: '注意观察有无出血倾向，如黑便、牙龈出血。',
  },
  {
    id: 'm_004',
    name: '格列美脲片',
    genericName: 'Glimepiride',
    spec: '2mg×30片',
    dosage: '1片',
    purpose: '促胰岛素分泌，降糖',
    frequencyPerDay: 1,
    times: ['08:00'],
    status: 'active',
    riskLevel: 'high',
    category: '降糖药',
    startDate: '2024-04-01',
    endDate: '2026-10-31',
    remindBeforeMinutes: 20,
    contraindications: ['1型糖尿病、糖尿病酮症酸中毒禁用'],
    precautions: '可能引起低血糖，建议餐前服用，注意监测血糖。',
  },
  {
    id: 'm_005',
    name: '氯氮平片',
    genericName: 'Clozapine',
    spec: '25mg×100片',
    dosage: '0.5片',
    purpose: '改善睡眠，辅助镇静',
    frequencyPerDay: 1,
    times: ['22:00'],
    status: 'active',
    riskLevel: 'high',
    category: '精神类药',
    startDate: '2024-05-10',
    endDate: '2026-09-15', // 短期助眠用药，即将停药
    remindBeforeMinutes: 15,
    contraindications: ['严重粒细胞减少、癫痫史慎用'],
    precautions: '可能引起嗜睡、体位性低血压；起床宜缓。',
  },
];

export const todaySchedule: ScheduleDose[] = [
  // 早晨
  { id: 's1', medicationId: 'm_001', medicationName: '硝苯地平缓释片', period: 'morning', time: '08:00', dosage: '1片', usage: '餐后口服', status: 'taken' },
  { id: 's2', medicationId: 'm_002', medicationName: '二甲双胍缓释片', period: 'morning', time: '08:00', dosage: '1片', usage: '餐后口服', status: 'taken' },
  { id: 's3', medicationId: 'm_003', medicationName: '阿司匹林肠溶片', period: 'morning', time: '08:00', dosage: '1片', usage: '空腹整片吞服', status: 'taken' },
  { id: 's4', medicationId: 'm_004', medicationName: '格列美脲片', period: 'morning', time: '08:00', dosage: '1片', usage: '早餐前30分钟', status: 'taken' },
  // 午间
  { id: 's5', medicationId: 'm_002', medicationName: '二甲双胍缓释片', period: 'noon', time: '12:30', dosage: '1片', usage: '餐后口服', status: 'pending' },
  // 晚间
  { id: 's6', medicationId: 'm_001', medicationName: '硝苯地平缓释片', period: 'evening', time: '20:00', dosage: '1片', usage: '餐后口服', status: 'pending' },
  // 睡前
  { id: 's7', medicationId: 'm_005', medicationName: '氯氮平片', period: 'night', time: '22:00', dosage: '0.5片', usage: '睡前服用', status: 'missed' },
];

export const healthRecords: HealthRecord[] = [
  { id: 'h1', date: daysAgo(6), time: '08:10', systolic: 132, diastolic: 82, bloodSugar: 6.1, heartRate: 74, note: '晨起' },
  { id: 'h2', date: daysAgo(5), time: '08:05', systolic: 128, diastolic: 80, bloodSugar: 5.9, heartRate: 72 },
  { id: 'h3', date: daysAgo(4), time: '08:15', systolic: 135, diastolic: 85, bloodSugar: 6.4, heartRate: 76 },
  { id: 'h4', date: daysAgo(3), time: '08:00', systolic: 130, diastolic: 82, bloodSugar: 6.0, heartRate: 71 },
  { id: 'h5', date: daysAgo(2), time: '20:30', systolic: 142, diastolic: 88, bloodSugar: 7.2, heartRate: 80, note: '晚间略高' },
  { id: 'h6', date: daysAgo(1), time: '08:10', systolic: 134, diastolic: 84, bloodSugar: 6.2, heartRate: 75 },
  { id: 'h7', date: todayStr, time: '08:08', systolic: 131, diastolic: 81, bloodSugar: 6.1, heartRate: 73, note: '今日晨起' },
];

export const riskAlerts: RiskAlert[] = [
  {
    id: 'r1',
    type: '药物相互作用',
    level: 'high',
    medications: ['格列美脲片', '阿司匹林肠溶片'],
    reason: '阿司匹林可增强格列美脲的降糖作用，增加低血糖风险。',
    aiAnalysis: '阿司匹林通过竞争结合血浆蛋白，使格列美脲游离浓度升高，同时抑制其代谢排泄，两者联用低血糖事件发生率显著上升。',
    suggestion: '建议监测空腹及餐后血糖；如出现心慌、出汗、乏力等低血糖症状，及时补充糖分并联系医生调整剂量。',
    plainAdvice: '这两种药都有点刺激胃，放一起吃可能胃更难受。AI建议：起床后先空腹吃阿司匹林，等20多分钟再吃格列美脲，然后吃早饭。如果觉得胃痛、反酸，跟医生说说要不要调整吃药时间。',
  },
  {
    id: 'r2',
    type: '低血糖风险',
    level: 'high',
    medications: ['格列美脲片', '二甲双胍缓释片'],
    reason: '两种降糖药联用，叠加降糖效应，低血糖风险升高。',
    aiAnalysis: '格列美脲促进胰岛素分泌，二甲双胍改善胰岛素抵抗，联用虽为常见方案，但老年人代谢减慢，需警惕延迟性低血糖。',
    suggestion: '按时进餐，不漏餐；运动前后监测血糖；随身携带糖块或饼干。',
    plainAdvice: '这两种降糖药碰到一起，可能会让您肚子更不舒服，比如恶心、腹胀、拉肚子。AI建议：二甲双胍放在吃完饭马上吃，格列美脲饭前半小时吃，两种药错开点时间。如果拉得厉害，多喝点淡盐水，赶紧问问医生要不要调药。',
  },
  {
    id: 'r3',
    type: '重复用药',
    level: 'mid',
    medications: ['硝苯地平缓释片'],
    reason: '硝苯地平每日两次服用，需间隔12小时，避免血压波动。',
    aiAnalysis: '缓释制剂需保持稳定血药浓度，服药间隔不规律可能导致血压反跳或控制不佳。',
    suggestion: '建议固定早8点、晚8点服药，使用闹钟提醒，避免漏服或重复服用。',
    plainAdvice: '硝苯地平每天要吃2次，两次之间得隔大约12小时，吃乱了会影响药效。AI建议：每天固定时间吃，早8点晚8点，手机上个闹钟，到点就吃。别想起来才吃，也别两次吃的时间太近。',
  },
  {
    id: 'r4',
    type: '慢病禁忌',
    level: 'mid',
    medications: ['氯氮平片'],
    reason: '氯氮平可能加重体位性低血压，与降压药联用需谨慎。',
    aiAnalysis: '氯氮平具有α受体阻滞作用，与硝苯地平联用可能引起起床时一过性血压下降，增加跌倒风险。',
    suggestion: '夜间起床如厕应先坐立30秒再站立；避免突然改变体位。',
    plainAdvice: '吃氯氮平容易犯困、口干、头晕，还可能便秘。AI建议：这药睡前吃，第二天醒来别猛的一下坐起来，先在床上躺半分钟，再坐半分钟，再慢慢站起来。平时多喝水多吃蔬菜，要是好几天不拉大便，用点开塞露或者问问医生。',
  },
  {
    id: 'r5',
    type: '剂量风险',
    level: 'low',
    medications: ['二甲双胍缓释片'],
    reason: '老年患者肾功能下降，需定期监测肾功能。',
    aiAnalysis: '二甲双胍经肾脏排泄，eGFR下降时蓄积风险增加，建议每3-6个月复查肾功能。',
    suggestion: '保持充足饮水；定期复查肾功能与乳酸水平。',
    plainAdvice: '吃二甲双胍容易肚子咕噜叫或拉肚子。AI建议：把这顿药放在吃完饭马上吃，不要空腹吃。如果今天拉肚子超过3次，记得多喝点淡盐水，明天赶紧给医生打电话问问要不要调药。',
  },
  {
    id: 'r6',
    type: '服药时间冲突',
    level: 'low',
    medications: ['阿司匹林肠溶片', '格列美脲片'],
    reason: '阿司匹林建议空腹，格列美脲建议餐前30分钟，时间接近但可协调。',
    aiAnalysis: '两者均在早晨服用，间隔较短但药理上不冲突，注意按顺序服用。',
    suggestion: '建议起床后先服阿司匹林，30分钟后服格列美脲，再过30分钟进早餐。',
    plainAdvice: '这两种药都有点刺激胃，放一起吃可能胃更难受。AI建议：起床后先空腹吃阿司匹林，等20多分钟再吃格列美脲，然后吃早饭。如果觉得胃痛、反酸，跟医生说说要不要调整吃药时间。',
  },
];

// 未登录/未拉取时为空，登录后由后端 /family/members 填充
export const familyMembers: FamilyMember[] = [];

export const notifications: AppNotification[] = [
  { id: 'n1', title: '漏服提醒', detail: '昨晚 22:00 氯氮平片未按时服用', level: 'warn', time: '今日 08:00', read: false },
  { id: 'n2', title: '血压偏高', detail: '前天晚间血压 142/88 mmHg，略有升高', level: 'warn', time: '前天 20:30', read: false },
  { id: 'n3', title: '风险预警', detail: '格列美脲与阿司匹林联用存在低血糖风险', level: 'danger', time: '今日 07:50', read: false },
  { id: 'n4', title: '用药计划已更新', detail: 'AI 已根据您的健康档案优化今日用药计划', level: 'info', time: '今日 07:00', read: true },
];

// 7-day health trend for charts
export const weeklyTrend = healthRecords.slice(-7).map((r) => ({
  date: r.date.slice(5),
  systolic: r.systolic,
  diastolic: r.diastolic,
  bloodSugar: r.bloodSugar,
  heartRate: r.heartRate,
}));

export const weeklyReport: ReportData = {
  period: 'week',
  startDate: daysAgo(6),
  endDate: todayStr,
  adherenceRate: 86,
  missedCount: 1,
  avgSystolic: 133,
  avgDiastolic: 83,
  avgBloodSugar: 6.3,
  avgHeartRate: 74,
  riskCount: { high: 2, mid: 2, low: 2 },
  aiSummary: '近一周整体用药依从性良好，血压控制基本平稳，偶有晚间血压升高。降糖药联用方案需关注低血糖风险，建议保持规律作息与饮食。',
  suggestions: [
    '保持早8点、晚8点固定时间服用降压药',
    '晚间减少盐分摄入，监测睡前血压',
    '随身携带糖块，预防低血糖',
    '下次复查肾功能（建议3个月内）',
  ],
};

// Mock OCR recognition result
export const mockOCRResult = {
  name: '氨氯地平贝那普利片',
  spec: '10mg/2.5mg×7片',
  dosage: '1片/次',
  usage: '每日1次，晨起口服',
  indication: '用于高血压，尤其适用于单药控制不佳者',
  contraindication: '对本品任一成分过敏者禁用；妊娠期妇女禁用',
  precaution: '注意监测血压，避免与钾盐或保钾利尿剂合用；可能引起干咳。',
};

// Mock AI assistant canned responses
export const aiQuickQuestions = [
  '我今天应该吃哪些药？',
  '这个药有什么作用？',
  '我漏服了一次怎么办？',
  '这个水果可以和我的药一起吃吗？',
  '我的血压最近正常吗？',
  '我的药一起吃会有冲突吗？',
];
