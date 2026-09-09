export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
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
