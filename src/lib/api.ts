import axios from 'axios';
import type {
  AppNotification,
  FamilyMember,
  HealthRecord,
  Medication,
  ReportData,
  RiskAlert,
  ScheduleDose,
  UserProfile,
} from '@/types';

// 生产构建且未显式指定 VITE_API_URL 时，使用同源相对路径（前后端一体部署）
// 本地开发（vite dev 5173 端口）继续指向本地后端 8000 端口
const apiBaseURL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api/v1' : 'http://localhost:8000/api/v1');

const api = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zhiyouyao_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface AssistantResponse {
  content: string;
  cards: NonNullable<import('@/types').AIMessage['cards']>;
  conversation_id?: string; // 扣子会话ID，首轮由后端返回，后续轮次带上以维持上下文
}

// AI 拍照识别药品返回的结构化结果（与后端 OCRResult 对应）
export interface OCRResult {
  name: string;
  spec: string;
  dosage: string;
  purpose: string;
  frequency_per_day: number;
  times: string[];
  contraindications: string[];
  precautions: string;
}

export interface UserUpdatePayload {
  name?: string;
  age?: number;
  gender?: '男' | '女';
  height?: number;
  weight?: number;
  bloodType?: string;
  chronicConditions?: string[];
  allergies?: string[];
  emergencyContact?: string;
}

export interface FamilyBindPayload {
  familyAccount: string;
  relationship: string;
}

function toUser(data: Record<string, unknown>): UserProfile {
  return {
    id: String(data.id), name: String(data.name ?? ''), age: Number(data.age ?? 0),
    gender: data.gender === '男' ? '男' : '女', height: Number(data.height ?? 0), weight: Number(data.weight ?? 0),
    role: data.role === 'family' ? 'family' : 'elder', avatarColor: String(data.avatar_color ?? '#4A8265'),
    chronicConditions: Array.isArray(data.chronic_conditions) ? data.chronic_conditions.map(String) : [],
    allergies: Array.isArray(data.allergies) ? data.allergies.map(String) : [], bloodType: String(data.blood_type ?? ''),
    emergencyContact: data.emergency_contact ? String(data.emergency_contact) : undefined,
    createdAt: String(data.created_at ?? ''),
  };
}

function toMedication(data: Record<string, unknown>): Medication {
  return {
    id: String(data.id), name: String(data.name), genericName: data.generic_name ? String(data.generic_name) : undefined,
    spec: String(data.spec ?? ''), dosage: String(data.dosage ?? ''), purpose: String(data.purpose ?? ''),
    frequencyPerDay: Number(data.frequency_per_day ?? 1), times: Array.isArray(data.times) ? data.times.map(String) : [],
    status: data.status === 'paused' || data.status === 'finished' ? data.status : 'active',
    riskLevel: data.risk_level === 'high' || data.risk_level === 'mid' ? data.risk_level : 'low',
    category: String(data.category ?? '其他'), notes: data.notes ? String(data.notes) : undefined,
    startDate: String(data.start_date ?? ''), endDate: data.end_date ? String(data.end_date) : undefined, remindBeforeMinutes: data.remind_before_minutes != null ? Number(data.remind_before_minutes) : undefined, contraindications: Array.isArray(data.contraindications) ? data.contraindications.map(String) : [],
    precautions: data.precautions ? String(data.precautions) : undefined,
  };
}

function toSchedule(data: Record<string, unknown>, medicationName = '药品'): ScheduleDose {
  const doseTime = String(data.dose_time ?? '');
  return {
    id: String(data.id), medicationId: String(data.medication_id), medicationName,
    period: data.period === 'noon' || data.period === 'evening' || data.period === 'night' ? data.period : 'morning',
    time: doseTime.slice(11, 16) || doseTime.slice(0, 5), dosage: String(data.dosage ?? ''), usage: String(data.usage ?? ''),
    status: data.status === 'taken' || data.status === 'missed' ? data.status : 'pending',
  };
}

function toHealthRecord(data: Record<string, unknown>): HealthRecord {
  const recordTime = String(data.record_time ?? '');
  return { id: String(data.id), date: String(data.record_date ?? ''), time: recordTime.slice(11, 16), systolic: Number(data.systolic), diastolic: Number(data.diastolic), bloodSugar: Number(data.blood_sugar), heartRate: Number(data.heart_rate), note: data.note ? String(data.note) : undefined };
}

function toRisk(data: Record<string, unknown>): RiskAlert {
  return { id: String(data.id), type: String(data.type), level: data.level === 'high' || data.level === 'mid' ? data.level : 'low', medications: Array.isArray(data.medications) ? data.medications.map(String) : [], reason: String(data.reason), aiAnalysis: String(data.ai_analysis ?? ''), suggestion: String(data.suggestion ?? ''), plainAdvice: String(data.plain_advice ?? '') };
}

export const authApi = {
  async login(account: string, password: string): Promise<UserProfile> {
    const { data } = await api.post('/auth/login', { account, password });
    localStorage.setItem('zhiyouyao_token', data.access_token);
    return toUser(data.user);
  },
  async register(payload: { account: string; password: string; name: string; role: 'elder' | 'family'; phone?: string }): Promise<UserProfile> {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('zhiyouyao_token', data.access_token);
    return toUser(data.user);
  },
  async me(): Promise<UserProfile> { const { data } = await api.get('/auth/me'); return toUser(data); },
  logout(): void { localStorage.removeItem('zhiyouyao_token'); },
};

export const userApi = {
  async update(payload: UserUpdatePayload): Promise<UserProfile> {
    const { data } = await api.patch('/users/me', {
      ...payload, blood_type: payload.bloodType, chronic_conditions: payload.chronicConditions,
      emergency_contact: payload.emergencyContact,
    });
    return toUser(data);
  },
};

export const medicationApi = {
  async list(): Promise<Medication[]> { const { data } = await api.get('/medications'); return data.map(toMedication); },
  async create(medication: Omit<Medication, 'id'>): Promise<Medication> {
    const { data } = await api.post('/medications', {
      name: medication.name, generic_name: medication.genericName, spec: medication.spec, dosage: medication.dosage,
      purpose: medication.purpose, frequency_per_day: medication.frequencyPerDay, times: medication.times, status: medication.status,
      risk_level: medication.riskLevel, category: medication.category, notes: medication.notes, start_date: medication.startDate,
      end_date: medication.endDate || null,
      remind_before_minutes: medication.remindBeforeMinutes ?? 30,
      contraindications: medication.contraindications, precautions: medication.precautions,
    });
    return toMedication(data);
  },
  async update(id: string, medication: Medication): Promise<Medication> { const { data } = await api.patch(`/medications/${id}`, medication); return toMedication(data); },
  async remove(id: string): Promise<void> { await api.delete(`/medications/${id}`); },
  async recognize(imageBase64: string): Promise<OCRResult> {
    const { data } = await api.post('/medications/ocr', { image_base64: imageBase64 });
    return data;
  },
};

export const scheduleApi = {
  async list(medications: Medication[]): Promise<ScheduleDose[]> {
    const { data } = await api.get('/schedule');
    return data.map((item: Record<string, unknown>) => toSchedule(item, medications.find((med) => med.id === String(item.medication_id))?.name));
  },
  async update(id: string, status: ScheduleDose['status']): Promise<ScheduleDose> { const { data } = await api.patch(`/schedule/${id}`, { status }); return toSchedule(data); },
};

export const healthApi = {
  async list(): Promise<HealthRecord[]> { const { data } = await api.get('/health-records'); return data.map(toHealthRecord); },
  async create(record: Omit<HealthRecord, 'id'>): Promise<HealthRecord> {
    const { data } = await api.post('/health-records', { record_date: record.date, record_time: `${record.date}T${record.time}:00`, systolic: record.systolic, diastolic: record.diastolic, blood_sugar: record.bloodSugar, heart_rate: record.heartRate, note: record.note });
    return toHealthRecord(data);
  },
};

export const riskApi = { async list(): Promise<RiskAlert[]> { const { data } = await api.get('/risks'); return data.map(toRisk); } };

export const assistantApi = {
  async chat(question: string, conversationId?: string): Promise<AssistantResponse> {
    const { data } = await api.post('/assistant/chat', { question, conversation_id: conversationId ?? null });
    return data;
  },
};

export const familyApi = {
  async list(): Promise<FamilyMember[]> {
    const { data } = await api.get('/family/members');
    return data.map((item: Record<string, unknown>) => ({ id: String(item.id), name: String(item.name), relationship: String(item.relationship), role: item.role === 'family' ? 'family' : 'elder', bound: Boolean(item.bound), avatarColor: '#3A85A8', phone: item.phone ? String(item.phone) : undefined }));
  },
  async bind(payload: FamilyBindPayload): Promise<FamilyMember> { const { data } = await api.post('/family/bind', { family_account: payload.familyAccount, relationship: payload.relationship }); return { id: String(data.id), name: String(data.name), relationship: String(data.relationship), role: 'family', bound: true, avatarColor: '#3A85A8', phone: data.phone ? String(data.phone) : undefined }; },
  async unbind(id: string): Promise<void> { await api.delete(`/family/bind/${id}`); },
};

export const notificationApi = {
  async list(): Promise<AppNotification[]> { const { data } = await api.get('/notifications'); return data.map((item: Record<string, unknown>) => ({ id: String(item.id), title: String(item.title), detail: String(item.detail), level: item.level === 'danger' || item.level === 'warn' ? item.level : 'info', time: String(item.created_at ?? ''), read: Boolean(item.read) })); },
  async read(id: string): Promise<void> { await api.post(`/notifications/${id}/read`); },
  async readAll(): Promise<void> { await api.post('/notifications/read-all'); },
};

export const reportApi = { async get(period: 'week' | 'month'): Promise<ReportData> { const { data } = await api.get(`/reports/${period}`); return { period: data.period, startDate: data.start_date, endDate: data.end_date, adherenceRate: data.adherence_rate, missedCount: data.missed_count, avgSystolic: data.avg_systolic, avgDiastolic: data.avg_diastolic, avgBloodSugar: data.avg_blood_sugar, avgHeartRate: data.avg_heart_rate, riskCount: data.risk_count, aiSummary: data.ai_summary, suggestions: data.suggestions }; } };

export default api;
