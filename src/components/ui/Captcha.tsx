import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { cn } from '@/lib/utils';

// 去掉容易混淆的 0/O、1/I，长辈看着不费劲
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
const CHAR_COLORS = ['#386A51', '#2D5542', '#4A8265', '#679E80'];

export interface CaptchaHandle {
  /** 重新生成一张验证码（换一张 / 校验失败后调用） */
  refresh: () => void;
  /** 当前答案，提交时用于比对 */
  getCode: () => string;
}

interface CaptchaProps {
  /** 每次生成新验证码后回调，参数为当前正确答案 */
  onChange?: (code: string) => void;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Canvas 绘制的图形验证码：随机字符 + 旋转抖动 + 干扰线与噪点。
 * 点击图形本身即可换一张（长辈容易理解）。
 */
export const Captcha = forwardRef<CaptchaHandle, CaptchaProps>(function Captcha(
  { onChange, width = 118, height = 46, className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const codeRef = useRef('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // 底色
    ctx.fillStyle = '#F0F7F4';
    ctx.fillRect(0, 0, width, height);

    // 干扰线
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(185,214,199,0.85)' : 'rgba(143,188,164,0.7)';
      ctx.lineWidth = 1.2;
      const x1 = Math.random() * width;
      const y1 = Math.random() * height;
      const cx = Math.random() * width;
      const cy = Math.random() * height;
      const x2 = Math.random() * width;
      const y2 = Math.random() * height;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();
    }

    // 噪点
    for (let i = 0; i < 26; i += 1) {
      ctx.beginPath();
      ctx.fillStyle = i % 3 === 0 ? 'rgba(143,188,164,0.55)' : 'rgba(185,214,199,0.6)';
      ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 1.6 + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 字符
    const slot = width / CODE_LENGTH;
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
      code += ch;

      ctx.save();
      ctx.translate(slot * i + slot / 2, height / 2 + 1);
      ctx.rotate((Math.random() - 0.5) * 0.44);
      ctx.font = 'bold 22px Inter, "Noto Sans SC", Arial, sans-serif';
      ctx.fillStyle = CHAR_COLORS[Math.floor(Math.random() * CHAR_COLORS.length)];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }

    codeRef.current = code;
    onChangeRef.current?.(code);
  }, [width, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  useImperativeHandle(
    ref,
    () => ({ refresh: draw, getCode: () => codeRef.current }),
    [draw],
  );

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="图形验证码，点击可换一张"
      title="看不清？点击换一张"
      onClick={draw}
      style={{ width, height }}
      className={cn(
        'shrink-0 rounded-xl border border-sage-200 bg-sage-50 cursor-pointer select-none',
        'hover:border-sage-300 transition',
        className,
      )}
    />
  );
});
