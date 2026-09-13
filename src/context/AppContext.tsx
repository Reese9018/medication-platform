import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserProfile, Medication, ScheduleDose, HealthRecord, FamilyMember, FamilyRequest, AppNotification, DoseStatus } from '@/types';
import { elderProfile, familyProfile, medications as initialMeds, todaySchedule, healthRecords as initialHealth, familyMembers as initialFamily, notifications as initialNotifs } from '@/data/mockData';
import { assistantApi, authApi, familyApi, healthApi, medicationApi, notificationApi, scheduleApi, userApi } from '@/lib/api';

interface Settings { elderMode: boolean; highContrast: boolean; reducedDeco: boolean; voiceRead: boolean }
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }

interface AppContextValue {
  user: UserProfile | null;
  login: (account: string, password: string, role?: 'elder' | 'family') => Promise<boolean>;
  logout: () => void;
  register: (name: string, role: 'elder' | 'family', account?: string, password?: string, phone?: string) => Promise<void>;
  updateUser: (patch: Partial<UserProfile>) => Promise<void>;
  medications: Medication[];
  setMedications: React.Dispatch<React.SetStateAction<Medication[]>>;
  addMedication: (m: Medication) => Promise<void>;
  updateMedication: (id: string, patch: Partial<Medication>) => Promise<void>;
  removeMedication: (id: string) => Promise<void>;
  schedule: ScheduleDose[];
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleDose[]>>;
  markDose: (id: string, status: DoseStatus) => Promise<void>;
  healthRecords: HealthRecord[];
  addHealthRecord: (r: HealthRecord) => Promise<void>;
  familyMembers: FamilyMember[];
  incomingRequests: FamilyRequest[];
  outgoingRequests: FamilyRequest[];
  sendFamilyRequest: (account: string, relationship: string) => Promise<boolean>;
  acceptFamilyRequest: (id: string) => Promise<void>;
  rejectFamilyRequest: (id: string) => Promise<void>;
  unbindMember: (peerId: string) => Promise<void>;
  refreshFamily: () => Promise<void>;
  notifications: AppNotification[];
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  askAssistant: typeof assistantApi.chat;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  speak: (text: string) => void;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [medications, setMedications] = useState<Medication[]>(initialMeds);
  const [schedule, setSchedule] = useState<ScheduleDose[]>(todaySchedule);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>(initialHealth);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(initialFamily);
  const [incomingRequests, setIncomingRequests] = useState<FamilyRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FamilyRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifs);
  const [settings, setSettings] = useState<Settings>({ elderMode: false, highContrast: false, reducedDeco: false, voiceRead: false });
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('font-elder', settings.elderMode);
    html.classList.toggle('contrast-high', settings.highContrast);
    html.classList.toggle('reduced-deco', settings.reducedDeco);
  }, [settings.elderMode, settings.highContrast, settings.reducedDeco]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, type }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), []);

  const refreshFamily = useCallback(async () => {
    const [members, incoming, outgoing] = await Promise.all([
      familyApi.listMembers(), familyApi.listIncoming(), familyApi.listOutgoing(),
    ]);
    setFamilyMembers(members);
    setIncomingRequests(incoming);
    setOutgoingRequests(outgoing);
  }, []);

  const loadUserData = useCallback(async () => {
    const [meds, health, notifs] = await Promise.all([medicationApi.list(), healthApi.list(), notificationApi.list()]);
    setMedications(meds);
    setHealthRecords(health);
    setNotifications(notifs);
    setSchedule(await scheduleApi.list(meds));
    await refreshFamily();
  }, [refreshFamily]);

  useEffect(() => {
    if (!localStorage.getItem('zhiyouyao_token')) return;
    authApi.me().then((profile) => {
      setUser(profile);
      return loadUserData();
    }).catch(() => authApi.logout());
  }, [loadUserData]);

  const login = useCallback(async (account: string, password: string, role?: 'elder' | 'family') => {
    try {
      const profile = await authApi.login(account, password, role);
      setUser(profile);
      await loadUserData();
      return true;
    } catch (err) {
      // 把 axios 错误原样抛出，让登录页 UI 能区分：网络异常 / 401 密码错 / 403 身份错 / 其他
      // —— 否则所有失败都会被合并成「账号或密码错误」一条文案，用户根本没法自助排查
      throw err;
    }
  }, [loadUserData]);

  const logout = useCallback(() => { authApi.logout(); setUser(null); }, []);

  const register = useCallback(async (name: string, role: 'elder' | 'family', account = '', password = '', phone = '') => {
    const profile = await authApi.register({ account: account || phone, password, name: name || (role === 'elder' ? elderProfile.name : familyProfile.name), role, phone });
    setUser(profile);
    await loadUserData();
  }, [loadUserData]);

  const updateUser = useCallback(async (patch: Partial<UserProfile>) => {
    try {
      const payload = {
        name: patch.name, age: patch.age, gender: patch.gender,
        height: patch.height, weight: patch.weight, bloodType: patch.bloodType,
        phone: patch.phone,
        chronicConditions: patch.chronicConditions, allergies: patch.allergies,
        emergencyContact: patch.emergencyContact,
      };
      const updated = await userApi.update(payload);
      setUser(updated);
      showToast('健康档案已更新');
    } catch {
      showToast('档案更新失败，请确认后端服务已启动', 'error');
    }
  }, [showToast]);

  const addMedication = useCallback(async (medication: Medication) => {
    try { const created = await medicationApi.create(medication); setMedications((items) => [...items, created]); showToast('药品已添加'); } catch { showToast('药品添加失败，请确认后端服务已启动', 'error'); }
  }, [showToast]);
  const updateMedication = useCallback(async (id: string, patch: Partial<Medication>) => {
    try { const current = medications.find((item) => item.id === id); if (!current) return; const updated = await medicationApi.update(id, { ...current, ...patch }); setMedications((items) => items.map((item) => item.id === id ? updated : item)); } catch { showToast('药品更新失败', 'error'); }
  }, [medications, showToast]);
  const removeMedication = useCallback(async (id: string) => {
    try { await medicationApi.remove(id); setMedications((items) => items.filter((item) => item.id !== id)); setSchedule((items) => items.filter((item) => item.medicationId !== id)); } catch { showToast('药品删除失败', 'error'); }
  }, [showToast]);
  const markDose = useCallback(async (id: string, status: DoseStatus) => {
    // 乐观更新：点击后立即更新本地状态，保证用户体验
    setSchedule((items) => items.map((item) => item.id === id ? { ...item, status } : item));
    const successMsg = status === 'taken' ? '已记录服药' : status === 'missed' ? '已标记为漏服' : '已重置为待服';
    try {
      const updated = await scheduleApi.update(id, status);
      setSchedule((items) => items.map((item) => item.id === id ? { ...item, status: updated.status } : item));
      showToast(successMsg);
    } catch {
      // 同步服务器失败时保持本地状态，仅给出温和提示
      showToast('本地已更新，同步服务器失败', 'error');
    }
  }, [showToast]);
  const addHealthRecord = useCallback(async (record: HealthRecord) => {
    try { const created = await healthApi.create(record); setHealthRecords((items) => [...items, created]); } catch { showToast('健康数据保存失败', 'error'); }
  }, [showToast]);
  const sendFamilyRequest = useCallback(async (account: string, relationship: string): Promise<boolean> => {
    try {
      await familyApi.createRequest({ account, relationship });
      await refreshFamily();
      showToast('申请已发送，等待对方同意');
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.detail || '申请发送失败，请检查对方账号';
      showToast(msg, 'error');
      return false;
    }
  }, [refreshFamily, showToast]);

  const acceptFamilyRequest = useCallback(async (id: string) => {
    try {
      await familyApi.acceptRequest(id);
      await refreshFamily();
      showToast('已同意绑定');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || '操作失败', 'error');
    }
  }, [refreshFamily, showToast]);

  const rejectFamilyRequest = useCallback(async (id: string) => {
    try {
      await familyApi.rejectRequest(id);
      setIncomingRequests((items) => items.filter((item) => item.id !== id));
      showToast('已拒绝该申请', 'info');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || '操作失败', 'error');
    }
  }, [showToast]);

  const unbindMember = useCallback(async (peerId: string) => {
    try {
      await familyApi.unbind(peerId);
      await refreshFamily();
      showToast('已解除绑定', 'info');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || '解除绑定失败', 'error');
    }
  }, [refreshFamily, showToast]);
  const markNotificationRead = useCallback(async (id: string) => {
    try { await notificationApi.read(id); setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item)); } catch { showToast('消息更新失败', 'error'); }
  }, [showToast]);
  const markAllRead = useCallback(async () => {
    try { await notificationApi.readAll(); setNotifications((items) => items.map((item) => ({ ...item, read: true }))); } catch { showToast('消息更新失败', 'error'); }
  }, [showToast]);
  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch })), []);

  // 语音朗读：仅在 voiceRead 开启时生效
  const speak = useCallback((text: string) => {
    if (!settings.voiceRead) return;
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch { /* 语音不可用时静默 */ }
  }, [settings.voiceRead]);

  return <AppContext.Provider value={{ user, login, logout, register, updateUser, medications, setMedications, addMedication, updateMedication, removeMedication, schedule, setSchedule, markDose, healthRecords, addHealthRecord, familyMembers, incomingRequests, outgoingRequests, sendFamilyRequest, acceptFamilyRequest, rejectFamilyRequest, unbindMember, refreshFamily, notifications, markNotificationRead, markAllRead, askAssistant: assistantApi.chat, settings, updateSettings, speak, toasts, showToast, dismissToast }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
