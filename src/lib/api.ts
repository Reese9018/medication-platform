import axios from 'axios';
import { formatDate, formatTime } from '@/lib/utils';
import type {
  AppNotification,
  FamilyMember,
  FamilyRequest,
  HealthRecord,
  Medication,
  ReportData,
  RiskAlert,
  ScheduleDose,
  UserProfile,
} from '@/types';

// 默认走相对路径 /api/v1，统一由反向代理转发到后端：
//   - 生产构建（同源部署）：由 nginx / 单 docker 容器把 /api 反代到后端
//   - vite dev：vite.config.ts 的 server.proxy['/api'] 把 /api 转给 localhost:8000
// 留 VITE_API_URL 给自定义部署（如直接跨域打后端 IP）覆盖
const apiBaseURL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
  // 15 秒超时：冷启动/网络慢时快速失败并提示，而不是一直转圈
  timeout: 15000,
});

// AI 助手的回答要经过大模型生成，实测耗时 8~50 秒（扣子智能体还要轮询会话状态），
// 沿用上面的 15 秒会在回答生成到一半时被 axios 主动中断，前端只能提示「助手无法连接」，
// 用户看到的现象就是「问了不回答」。这里给助手单独放宽到 120 秒。
const ASSISTANT_TIMEOUT_MS = 120000;
const assistantApiClient = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: ASSISTANT_TIMEOUT_MS,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zhiyouyao_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

assistantApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('zhiyouyao_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 自动重试：冷启动/网络波动时自动重试 2 次，避免一打开就报错
const retryRequest = async (error: any) => {
  const config = error.config;
  if (!config || config.__retryCount >= 2) {
    return Promise.reject(error);
  }
  config.__retryCount = (config.__retryCount || 0) + 1;
  // 网络错误或 502/503 才重试
  const status = error.response?.status;
  if (!error.response || status === 502 || status === 503) {
    await new Promise((r) => setTimeout(r, 1500 * config.__retryCount));
    return api(config);
  }
  return Promise.reject(error);
};

api.interceptors.response.use(
  (response) => response,
  retryRequest
);

// ============================================================
// 接口错误 → 用户可读文案
// ============================================================

/** 请求根本没到后端（后端没启动 / 端口不对 / 代理失效），axios 无 response */
export function isOfflineError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response;
}

/** 服务端已经没有这条数据了（例如重复删除已删掉的药品） */
export function isNotFoundError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 404;
}

/**
 * 把 axios 错误转成可直接展示给老人的中文提示：
 * - 后端连不上（axios 没有 response）→ 直接说清怎么恢复，而不是弹 "Network Error"
 * - 后端/代理返回了中文 detail → 用它（如 404「药品不存在」、代理的「后端服务不可达…」）
 * - 其余（如 500 "Internal Server Error"）→ 用兜底文案，不把英文抛给用户
 */
export function describeApiError(err: unknown, fallback: string): string {
  if (isOfflineError(err)) return '后端服务未连接，请确认后端服务已启动';
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && /[\u4e00-\u9fa5]/.test(detail)) return detail.trim();
  }
  return fallback;
}

export interface AssistantProfileSummary {
  name: string;
  age: number | null;
  gender: string;
  height: number | null;
  weight: number | null;
  blood_type: string;
  chronic_conditions: string[];
  allergies: string[];
  emergency_contact: string;
  active_medication_count: number;
  today_total: number;
  today_taken: number;
  today_pending: number;
  today_missed: number;
  latest_bp: string;
  latest_blood_sugar: number | null;
  latest_heart_rate: number | null;
  record_count: number;
  risk_count: number;
  completeness: number;
  missing_fields: string[];
}

export interface AssistantResponse {
  content: string;
  cards: NonNullable<import('@/types').AIMessage['cards']>;
  conversation_id?: string; // 扣子会话ID，首轮由后端返回，后续轮次带上以维持上下文
  source?: 'ai' | 'local'; // ai=扣子智能体；local=后端本地应答引擎兜底
  profile?: AssistantProfileSummary | null; // 当前用户档案摘要，供助手页展示
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
  phone?: string;
  chronicConditions?: string[];
  allergies?: string[];
  emergencyContact?: string;
}

export interface FamilyRequestPayload {
  account: string;
  relationship: string;
}

/** 家属端查看老人真实数据的返回结构 */
export interface ElderOverview {
  id: number;
  name: string;
  age: number;
  gender: string;
  avatar_color: string;
  relationship: string;
  chronic_conditions: string[];
  allergies: string[];
  blood_type: string;
  emergency_contact: string | null;
  today_doses: { time: string; name: string; dosage: string; status: 'taken' | 'pending' | 'missed'; period: string }[];
  today_rate: number;
  today_taken: number;
  today_total: number;
  medications: { id: number; name: string; generic_name?: string; spec: string; dosage: string; freq: string; times: string; category: string }[];
  health_records: { date: string; time: string; systolic: number; diastolic: number; blood_sugar: number; heart_rate: number }[];
  latest_bp: string;
  latest_sugar: number | null;
  latest_hr: number | null;
}

function toUser(data: Record<string, unknown>): UserProfile {
  return {
    id: String(data.id), name: String(data.name ?? ''), age: Number(data.age ?? 0),
    gender: data.gender === '男' ? '男' : '女', height: Number(data.height ?? 0), weight: Number(data.weight ?? 0),
    role: data.role === 'family' ? 'family' : 'elder', avatarColor: String(data.avatar_color ?? '#4A8265'),
    chronicConditions: Array.isArray(data.chronic_conditions) ? data.chronic_conditions.map(String) : [],
    allergies: Array.isArray(data.allergies) ? data.allergies.map(String) : [], bloodType: String(data.blood_type ?? ''),
    emergencyContact: data.emergency_contact ? String(data.emergency_contact) : undefined,
    phone: data.phone ? String(data.phone) : undefined,
    // created_at 是 ISO 长串（2026-09-13T09:23:16.729089），
    // 统一在此归一化为日期，避免各页面直接渲染时撑破卡片
    createdAt: formatDate(String(data.created_at ?? '')),
    // 健康档案建档/更新日期：修改档案保存后后端会刷新；老数据为空时回退到 createdAt
    profileUpdatedAt: formatDate(String(data.profile_updated_at ?? '')) || undefined,
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
  async login(account: string, password: string, role?: 'elder' | 'family'): Promise<UserProfile> {
    // 前端传 role 仅为防御性校验：账号若不属于所选身份，后端会 403，
    // 防止「切到家属性，账号字段却还残留老人默认」这种误登场景
    const { data } = await api.post('/auth/login', { account, password, role });
    localStorage.setItem('zhiyouyao_token', data.access_token);
    return toUser(data.user);
  },
  async register(payload: { account: string; password: string; name: string; role: 'elder' | 'family'; phone?: string }): Promise<UserProfile> {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('zhiyouyao_token', data.access_token);
    return toUser(data.user);
  },
  async me(): Promise<UserProfile> { const { data } = await api.get('/auth/me'); return toUser(data); },
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword });
  },
  logout(): void { localStorage.removeItem('zhiyouyao_token'); },
};

export const userApi = {
  async update(payload: UserUpdatePayload): Promise<UserProfile> {
    const { data } = await api.patch('/users/me', {
      ...payload, blood_type: payload.bloodType, chronic_conditions: payload.chronicConditions,
      emergency_contact: payload.emergencyContact, phone: payload.phone,
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
    const { data } = await api.post('/medications/ocr', { image_base64: imageBase64 }, { timeout: 120000 });
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
    const { data } = await assistantApiClient.post('/assistant/chat', {
      question,
      conversation_id: conversationId ?? null,
    });
    return data;
  },
  /** 进入助手页时拉取「AI 已读到的档案」摘要，不必先提一个问题 */
  async profile(): Promise<AssistantProfileSummary> {
    const { data } = await assistantApiClient.get('/assistant/profile');
    return data;
  },
};

function toFamilyMember(data: Record<string, unknown>): FamilyMember {
  return {
    id: String(data.id),
    name: String(data.name ?? ''),
    relationship: String(data.relationship ?? '家属'),
    role: data.role === 'family' ? 'family' : 'elder',
    status: data.status === 'active' ? 'active' : data.status === 'pending' ? 'pending' : 'rejected',
    avatarColor: data.role === 'family' ? '#3A85A8' : '#4A8265',
    phone: data.phone ? String(data.phone) : undefined,
  };
}

function toFamilyRequest(data: Record<string, unknown>): FamilyRequest {
  return {
    id: String(data.id),
    peerId: String(data.peer_id),
    peerName: String(data.peer_name ?? ''),
    peerRole: data.peer_role === 'family' ? 'family' : 'elder',
    peerPhone: data.peer_phone ? String(data.peer_phone) : undefined,
    relationship: String(data.relationship ?? '家属'),
    status: data.status === 'pending' ? 'pending' : data.status === 'active' ? 'active' : 'rejected',
    requesterId: String(data.requester_id),
    requesterName: String(data.requester_name ?? ''),
    direction: data.direction === 'outgoing' ? 'outgoing' : 'incoming',
    createdAt: String(data.created_at ?? ''),
  };
}

export const familyApi = {
  async listMembers(): Promise<FamilyMember[]> {
    const { data } = await api.get('/family/members');
    return data.map(toFamilyMember);
  },
  /** 家属查看某位绑定老人的真实数据（资料/今日用药/药品/健康记录） */
  async elderOverview(elderId: string | number): Promise<ElderOverview> {
    const { data } = await api.get(`/family/elders/${elderId}/overview`);
    return data;
  },
  async listIncoming(): Promise<FamilyRequest[]> {
    const { data } = await api.get('/family/requests/incoming');
    return data.map(toFamilyRequest);
  },
  async listOutgoing(): Promise<FamilyRequest[]> {
    const { data } = await api.get('/family/requests/outgoing');
    return data.map(toFamilyRequest);
  },
  async createRequest(payload: FamilyRequestPayload): Promise<FamilyRequest> {
    const { data } = await api.post('/family/requests', { account: payload.account, relationship: payload.relationship });
    return toFamilyRequest(data);
  },
  async acceptRequest(id: string): Promise<void> {
    await api.post(`/family/requests/${id}/accept`);
  },
  async rejectRequest(id: string): Promise<void> {
    await api.post(`/family/requests/${id}/reject`);
  },
  async unbind(peerId: string): Promise<void> {
    await api.delete(`/family/members/${peerId}`);
  },
};

export const notificationApi = {
  async list(): Promise<AppNotification[]> { const { data } = await api.get('/notifications'); return data.map((item: Record<string, unknown>) => ({ id: String(item.id), title: String(item.title), detail: String(item.detail), level: item.level === 'danger' || item.level === 'warn' ? item.level : 'info', time: formatTime(String(item.created_at ?? '')), read: Boolean(item.read) })); },
  async read(id: string): Promise<void> { await api.post(`/notifications/${id}/read`); },
  async readAll(): Promise<void> { await api.post('/notifications/read-all'); },
};

export const reportApi = { async get(period: 'week' | 'month'): Promise<ReportData> { const { data } = await api.get(`/reports/${period}`); return { period: data.period, startDate: formatDate(String(data.start_date ?? '')), endDate: formatDate(String(data.end_date ?? '')), adherenceRate: data.adherence_rate, missedCount: data.missed_count, avgSystolic: data.avg_systolic, avgDiastolic: data.avg_diastolic, avgBloodSugar: data.avg_blood_sugar, avgHeartRate: data.avg_heart_rate, riskCount: data.risk_count, aiSummary: data.ai_summary, suggestions: data.suggestions }; } };

export default api;
