// Core domain types — structured for future AI/DB integration

export type UserRole = 'elder' | 'family';

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: '男' | '女';
  height: number; // cm
  weight: number; // kg
  role: UserRole;
  avatarColor: string;
  chronicConditions: string[];
  allergies: string[];
  bloodType: string;
  emergencyContact?: string;
  phone?: string;
  createdAt: string;
}

export type MedicationStatus = 'active' | 'paused' | 'finished';

export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  spec: string; // 规格 e.g. 10mg×14片
  dosage: string; // 剂量 e.g. 1片
  purpose: string; // 用途/适应症
  frequencyPerDay: number;
  times: string[]; // 服用时间点 e.g. ['08:00','20:00']
  status: MedicationStatus;
  riskLevel: 'high' | 'mid' | 'low';
  category: string; // 分类
  notes?: string;
  startDate: string;
  endDate?: string; // 停药/结束日期（留空表示长期服用）
  remindBeforeMinutes?: number; // 每次服药前提前多少分钟发消息提醒
  contraindications?: string[];
  precautions?: string;
}

export type DoseStatus = 'taken' | 'pending' | 'missed';

export interface ScheduleDose {
  id: string;
  medicationId: string;
  medicationName: string;
  period: 'morning' | 'noon' | 'evening' | 'night';
  time: string; // HH:mm
  dosage: string;
  usage: string; // 用法
  status: DoseStatus;
}

export interface HealthRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  systolic: number; // 收缩压
  diastolic: number; // 舒张压
  bloodSugar: number; // 血糖 mmol/L
  heartRate: number; // 心率
  note?: string;
}

export type RiskLevel = 'high' | 'mid' | 'low';

export interface RiskAlert {
  id: string;
  type: string; // 药物相互作用 / 低血糖风险 ...
  level: RiskLevel;
  medications: string[]; // 涉及药品
  reason: string;
  aiAnalysis: string;
  suggestion: string;
  plainAdvice: string; // 老人能听懂的通俗安全建议
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cards?: AICard[];
  timestamp: string;
}

export interface AICard {
  type: 'medication' | 'risk' | 'tip' | 'action' | 'health';
  title: string;
  detail?: string;
  level?: RiskLevel;
  medications?: string[];
  actions?: { label: string; to?: string }[];
}

// 家庭绑定关系三态
// pending  —— 申请中：一方发起，等另一方同意，双方互不可见数据
// active   —— 已绑定：家属可查看老人授权数据
// rejected —— 已拒绝/已解除
export type FamilyLinkStatus = 'pending' | 'active' | 'rejected';

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string; // 关系
  role: UserRole;
  status: FamilyLinkStatus;
  avatarColor: string;
  phone?: string;
}

export interface FamilyRequest {
  id: string;
  peerId: string;        // 相对方 id（incoming=申请人；outgoing=被申请人）
  peerName: string;
  peerRole: UserRole;
  peerPhone?: string;
  relationship: string;
  status: FamilyLinkStatus;
  requesterId: string;
  requesterName: string;
  direction: 'incoming' | 'outgoing'; // incoming=等我处理；outgoing=我发出的
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  level: 'info' | 'warn' | 'danger';
  time: string;
  read: boolean;
}

export interface ReportData {
  period: 'week' | 'month';
  startDate: string;
  endDate: string;
  adherenceRate: number; // 服药完成率
  missedCount: number;
  avgSystolic: number;
  avgDiastolic: number;
  avgBloodSugar: number;
  avgHeartRate: number;
  riskCount: { high: number; mid: number; low: number };
  aiSummary: string;
  suggestions: string[];
}
