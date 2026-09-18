export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ============================================================
// 日期 / 时间格式化
// ============================================================

const pad2 = (v: string | number) => String(v).padStart(2, '0');

/**
 * 把后端返回的时间统一格式化成「YYYY-MM-DD」。
 *
 * 后端 created_at / start_date 等字段是 ISO 串（如 2026-09-13T09:23:16.729089），
 * 直接渲染会撑破卡片（如健康档案里的「建档日期」），因此展示前必须过一层格式化。
 * 用正则优先截取年月日，避免 new Date('2026-09-13') 按 UTC 解析在部分时区倒退一天。
 */
export function formatDate(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const matched = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(raw);
  if (matched) return `${matched[1]}-${pad2(matched[2])}-${pad2(matched[3])}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

/** 兼容 MM-DD 的短日期，用于列表等空间有限的位置 */
export function formatDateShort(value?: string | null): string {
  const full = formatDate(value);
  const matched = /^\d{4}-(\d{2})-(\d{2})$/.exec(full);
  return matched ? `${matched[1]}-${matched[2]}` : full;
}

/** 「YYYY-MM-DD HH:mm」，用于需要精确到分钟的场景（如用药记录时间） */
export function formatTime(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const matched = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[T\s](\d{1,2}):(\d{2})/.exec(raw);
  return matched
    ? `${matched[1]}-${pad2(matched[2])}-${pad2(matched[3])} ${pad2(matched[4])}:${matched[5]}`
    : formatDate(raw);
}

// ============================================================
// 角色头像：按用户角色 + 性别返回对应的卡通形象路径
// ============================================================

/**
 * 根据用户角色（elder / family）和性别（男 / 女）返回对应的卡通头像 URL。
 * 头像素材位于 public/avatars/，由 Vite 作为静态资源暴露到站点根路径。
 *
 * 约定：
 *  - elder + 男 → 老爷爷（蓝底）
 *  - elder + 女 → 老太太（紫底）
 *  - family + 男 → 青年男（绿底）
 *  - family + 女 → 青年女（粉底）
 *
 * 兜底：gender 缺失或其他取值时按"女"处理；role 同理按"elder"处理。
 */
export function getRoleAvatarUrl(role: 'elder' | 'family' | string | undefined, gender: '男' | '女' | string | undefined): string {
  const r = role === 'family' ? 'family' : 'elder';
  const g = gender === '男' ? 'male' : 'female';
  return `/avatars/${r}-${g}.jpg`;
}

// ============================================================
// 健康指标正常范围判定（面向老年人，通俗易懂）
// ============================================================

export type HealthStatus = 'normal' | 'high' | 'low';

export interface HealthStatusResult {
  status: HealthStatus;
  label: string;       // 正常 / 偏高 / 偏低
  color: string;       // 文字颜色 class
  bg: string;          // 背景颜色 class
  border: string;      // 边框颜色 class
  tip: string;         // 给老人看的一句话提示
}

/**
 * 血压正常范围（老年人参考标准）
 * 收缩压 90~139 mmHg，舒张压 60~89 mmHg
 * 收缩压 ≥140 或 舒张压 ≥90 → 偏高
 * 收缩压 <90 或 舒张压 <60 → 偏低
 */
export function getBloodPressureStatus(systolic: number, diastolic: number): HealthStatusResult {
  if (systolic >= 140 || diastolic >= 90) {
    return {
      status: 'high',
      label: '偏高',
      color: 'text-coral-600',
      bg: 'bg-coral-50',
      border: 'border-coral-200',
      tip: '血压偏高，请按时服药、低盐饮食，必要时咨询医生。',
    };
  }
  if (systolic < 90 || diastolic < 60) {
    return {
      status: 'low',
      label: '偏低',
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      tip: '血压偏低，起身时请慢一些，注意补充水分和营养。',
    };
  }
  return {
    status: 'normal',
    label: '正常',
    color: 'text-sage-600',
    bg: 'bg-sage-50',
    border: 'border-sage-200',
    tip: '血压在正常范围内，请继续保持良好的生活习惯。',
  };
}

/**
 * 血糖正常范围（老年人/糖尿病患者参考标准，适当放宽）
 * 空腹 3.9~6.9 mmol/L
 * ≥7.0 → 偏高
 * <3.9 → 偏低
 */
export function getBloodSugarStatus(value: number): HealthStatusResult {
  if (value >= 7.0) {
    return {
      status: 'high',
      label: '偏高',
      color: 'text-coral-600',
      bg: 'bg-coral-50',
      border: 'border-coral-200',
      tip: '血糖偏高，请控制饮食、按时服药，注意监测餐后血糖。',
    };
  }
  if (value < 3.9) {
    return {
      status: 'low',
      label: '偏低',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      tip: '血糖偏低，请及时吃点东西，随身携带糖块预防低血糖。',
    };
  }
  return {
    status: 'normal',
    label: '正常',
    color: 'text-sage-600',
    bg: 'bg-sage-50',
    border: 'border-sage-200',
    tip: '血糖在正常范围内，请继续保持规律饮食和用药。',
  };
}

/**
 * 心率正常范围
 * 60~100 次/分
 * >100 → 偏高
 * <60 → 偏低
 */
export function getHeartRateStatus(value: number): HealthStatusResult {
  if (value > 100) {
    return {
      status: 'high',
      label: '偏快',
      color: 'text-coral-600',
      bg: 'bg-coral-50',
      border: 'border-coral-200',
      tip: '心率偏快，请休息片刻后再测，如持续偏快请咨询医生。',
    };
  }
  if (value < 60) {
    return {
      status: 'low',
      label: '偏慢',
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      border: 'border-sky-200',
      tip: '心率偏慢，如无不适一般无碍，如有头晕乏力请咨询医生。',
    };
  }
  return {
    status: 'normal',
    label: '正常',
    color: 'text-sage-600',
    bg: 'bg-sage-50',
    border: 'border-sage-200',
    tip: '心率在正常范围内，心脏状态良好。',
  };
}
