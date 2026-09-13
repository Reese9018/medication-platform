// 家属端（子女端）演示数据：两位老人（妈妈/爸爸）
// 真实环境下由后端 /family/members 下发每位老人授权后的用药与健康数据
// 比赛演示用静态数据，保证四个一级页面都有内容可看

export type DoseStatus = 'taken' | 'pending' | 'missed';

export interface ElderDose {
  time: string;
  name: string;
  status: DoseStatus;
  dosage?: string;
}

export interface ElderMed {
  name: string;
  genericName?: string;
  spec: string;
  dosage: string;
  freq: string;
  times: string;
  daysLeft: number;
  category: string;
}

export interface ElderDay {
  day: string;
  rate: number;
  ok: boolean;
}

export interface ElderBP {
  date: string;
  sys: number;
  dia: number;
}

export interface SugarRecord {
  date: string;
  time: string;
  value: number;
  when: '空腹' | '餐后' | '睡前';
}

export interface HRRecord {
  date: string;
  value: number;
}

export interface MedLog {
  date: string;
  time: string;
  name: string;
  status: '已服用' | '漏服';
}

export interface MissLog {
  date: string;
  time: string;
  name: string;
  overdue: string;
  final: '未确认服用' | '漏服';
}

export interface FamNotification {
  id: string;
  level: 'danger' | 'warn' | 'info';
  category: '用药' | '健康' | '家庭';
  title: string;
  detail: string;
  time: string;
}

export interface ElderProfile {
  name: string;
  age: number;
  chronic: string[];
  allergy: string;
  emergency: string;
}

export interface DemoElder {
  id: string;
  name: string; // 关系称呼（妈妈/爸爸）
  fullName: string;
  age: number;
  emoji: string;
  avatarColor: string;
  todayRate: number; // 今日服药率
  todayDoses: ElderDose[];
  week: ElderDay[];
  weekRate: number;
  alert?: { med: string; time: string; overdueMin: number };
  meds: ElderMed[];
  health: { bp: string; systolic: number; diastolic: number; hr: number; sugar: number };
  weekBP: ElderBP[];
  sugarHistory: SugarRecord[];
  hrHistory: HRRecord[];
  medLogs: MedLog[];
  missed: MissLog[];
  profile: ElderProfile;
  permissions: {
    viewSchedule: boolean;
    viewLogs: boolean;
    viewMissed: boolean;
    viewMeds: boolean;
    viewBP: boolean;
    viewSugar: boolean;
    viewFullProfile: boolean;
    editSchedule: boolean;
  };
  authorized: boolean;
}

export const DEMO_ELDERS: DemoElder[] = [
  {
    id: 'elder_mom',
    name: '妈妈',
    fullName: '王秀兰',
    age: 72,
    emoji: '👵',
    avatarColor: '#4A8265',
    todayRate: 80,
    todayDoses: [
      { time: '08:00', name: '硝苯地平缓释片', status: 'taken', dosage: '1片' },
      { time: '12:00', name: '二甲双胍缓释片', status: 'taken', dosage: '1片' },
      { time: '18:00', name: '硝苯地平缓释片', status: 'pending', dosage: '1片' },
      { time: '22:00', name: '氯氮平片', status: 'pending', dosage: '0.5片' },
    ],
    week: [
      { day: '周一', rate: 100, ok: true },
      { day: '周二', rate: 100, ok: true },
      { day: '周三', rate: 80, ok: false },
      { day: '周四', rate: 100, ok: true },
      { day: '周五', rate: 85, ok: false },
      { day: '周六', rate: 100, ok: true },
      { day: '周日', rate: 80, ok: false },
    ],
    weekRate: 92,
    alert: { med: '硝苯地平缓释片（降压药）', time: '18:00', overdueMin: 35 },
    meds: [
      { name: '阿司匹林肠溶片', genericName: 'Aspirin', spec: '100mg×30片', dosage: '1片', freq: '每日 1 次', times: '08:00', daysLeft: 18, category: '心血管药' },
      { name: '二甲双胍缓释片', genericName: 'Metformin', spec: '500mg×30片', dosage: '1片', freq: '每日 2 次', times: '08:00 / 18:00', daysLeft: 12, category: '降糖药' },
      { name: '硝苯地平缓释片', genericName: 'Nifedipine', spec: '20mg×14片', dosage: '1片', freq: '每日 2 次', times: '08:00 / 18:00', daysLeft: 5, category: '降压药' },
      { name: '氯氮平片', spec: '25mg×100片', dosage: '0.5片', freq: '每日 1 次', times: '22:00', daysLeft: 21, category: '精神类药' },
    ],
    health: { bp: '128 / 82', systolic: 128, diastolic: 82, hr: 72, sugar: 6.2 },
    weekBP: [
      { date: '一', sys: 132, dia: 82 },
      { date: '二', sys: 128, dia: 80 },
      { date: '三', sys: 135, dia: 85 },
      { date: '四', sys: 130, dia: 82 },
      { date: '五', sys: 142, dia: 88 },
      { date: '六', sys: 134, dia: 84 },
      { date: '日', sys: 131, dia: 81 },
    ],
    sugarHistory: [
      { date: '9月12日', time: '08:30', value: 6.2, when: '餐后' },
      { date: '9月11日', time: '08:20', value: 6.5, when: '餐后' },
      { date: '9月10日', time: '08:40', value: 6.1, when: '餐后' },
      { date: '9月9日', time: '08:25', value: 6.4, when: '餐后' },
    ],
    hrHistory: [
      { date: '一', value: 74 },
      { date: '二', value: 75 },
      { date: '三', value: 70 },
      { date: '四', value: 73 },
      { date: '五', value: 72 },
      { date: '六', value: 76 },
      { date: '日', value: 72 },
    ],
    medLogs: [
      { date: '今天', time: '08:03', name: '硝苯地平缓释片', status: '已服用' },
      { date: '今天', time: '12:08', name: '二甲双胍缓释片', status: '已服用' },
      { date: '昨天', time: '08:01', name: '硝苯地平缓释片', status: '已服用' },
      { date: '昨天', time: '12:05', name: '二甲双胍缓释片', status: '已服用' },
      { date: '昨天', time: '18:12', name: '硝苯地平缓释片', status: '已服用' },
      { date: '9月10日', time: '18:30', name: '硝苯地平缓释片', status: '漏服' },
    ],
    missed: [
      { date: '今天', time: '18:00', name: '硝苯地平缓释片', overdue: '超过服药时间 35 分钟', final: '未确认服用' },
      { date: '9月10日', time: '18:00', name: '硝苯地平缓释片', overdue: '未按时服用', final: '漏服' },
    ],
    profile: {
      name: '王秀兰',
      age: 72,
      chronic: ['高血压', '2型糖尿病'],
      allergy: '青霉素过敏',
      emergency: '王女士（女儿）138****6789',
    },
    permissions: {
      viewSchedule: true, viewLogs: true, viewMissed: true, viewMeds: true,
      viewBP: true, viewSugar: true, viewFullProfile: true, editSchedule: true,
    },
    authorized: true,
  },
  {
    id: 'elder_dad',
    name: '爸爸',
    fullName: '王建国',
    age: 75,
    emoji: '👴',
    avatarColor: '#3A85A8',
    todayRate: 100,
    todayDoses: [
      { time: '07:30', name: '苯磺酸氨氯地平片', status: 'taken', dosage: '1片' },
      { time: '12:00', name: '辛伐他汀片', status: 'taken', dosage: '1片' },
      { time: '19:00', name: '苯磺酸氨氯地平片', status: 'taken', dosage: '1片' },
    ],
    week: [
      { day: '周一', rate: 100, ok: true },
      { day: '周二', rate: 100, ok: true },
      { day: '周三', rate: 100, ok: true },
      { day: '周四', rate: 100, ok: true },
      { day: '周五', rate: 100, ok: true },
      { day: '周六', rate: 100, ok: true },
      { day: '周日', rate: 100, ok: true },
    ],
    weekRate: 100,
    meds: [
      { name: '苯磺酸氨氯地平片', genericName: 'Amlodipine', spec: '5mg×28片', dosage: '1片', freq: '每日 2 次', times: '07:30 / 19:00', daysLeft: 22, category: '降压药' },
      { name: '辛伐他汀片', genericName: 'Simvastatin', spec: '20mg×14片', dosage: '1片', freq: '每日 1 次', times: '12:00', daysLeft: 3, category: '降脂药' },
    ],
    health: { bp: '126 / 80', systolic: 126, diastolic: 80, hr: 70, sugar: 5.8 },
    weekBP: [
      { date: '一', sys: 128, dia: 80 },
      { date: '二', sys: 126, dia: 79 },
      { date: '三', sys: 130, dia: 82 },
      { date: '四', sys: 127, dia: 80 },
      { date: '五', sys: 125, dia: 78 },
      { date: '六', sys: 129, dia: 81 },
      { date: '日', sys: 126, dia: 80 },
    ],
    sugarHistory: [
      { date: '9月12日', time: '07:50', value: 5.8, when: '空腹' },
      { date: '9月11日', time: '07:40', value: 5.9, when: '空腹' },
      { date: '9月10日', time: '08:00', value: 5.6, when: '空腹' },
    ],
    hrHistory: [
      { date: '一', value: 70 },
      { date: '二', value: 72 },
      { date: '三', value: 69 },
      { date: '四', value: 71 },
      { date: '五', value: 70 },
      { date: '六', value: 73 },
      { date: '日', value: 70 },
    ],
    medLogs: [
      { date: '今天', time: '07:32', name: '苯磺酸氨氯地平片', status: '已服用' },
      { date: '今天', time: '12:02', name: '辛伐他汀片', status: '已服用' },
      { date: '今天', time: '19:05', name: '苯磺酸氨氯地平片', status: '已服用' },
    ],
    missed: [],
    profile: {
      name: '王建国',
      age: 75,
      chronic: ['高血压', '高血脂'],
      allergy: '无',
      emergency: '王女士（女儿）138****6789',
    },
    permissions: {
      viewSchedule: true, viewLogs: true, viewMissed: true, viewMeds: true,
      viewBP: true, viewSugar: true, viewFullProfile: true, editSchedule: true,
    },
    authorized: true,
  },
];

export const FAMILY_NOTIFICATIONS: FamNotification[] = [
  { id: 'n1', level: 'danger', category: '用药', title: '用药异常', detail: '妈妈 18:00 的硝苯地平缓释片尚未确认服用', time: '10 分钟前' },
  { id: 'n2', level: 'warn', category: '用药', title: '药品不足', detail: '爸爸的辛伐他汀预计剩余 3 天，建议及时补充', time: '昨天' },
  { id: 'n3', level: 'warn', category: '健康', title: '健康异常', detail: '妈妈最新血压 142/88 偏高，请关注', time: '9月11日' },
  { id: 'n4', level: 'info', category: '家庭', title: '家庭消息', detail: '妈妈已同意您的绑定申请', time: '9月10日' },
];

export function elderTodayStats(e: DemoElder) {
  const taken = e.todayDoses.filter((d) => d.status === 'taken').length;
  const total = e.todayDoses.length;
  const pending = e.todayDoses.filter((d) => d.status === 'pending').length;
  const missed = e.todayDoses.filter((d) => d.status === 'missed').length;
  return { taken, total, pending, missed, rate: total ? Math.round((taken / total) * 100) : 0 };
}
