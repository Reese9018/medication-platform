import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 轻量富文本渲染：把 AI 回答里的 Markdown 片段渲染成正常排版。
 *
 * 背景：扣子智能体和后端应答引擎返回的都是 Markdown（### 标题、**加粗**、- 列表、--- 分隔线）。
 * 原来的助手页把整段回答直接塞进一个 div 当纯文本显示，用户看到的是满屏的
 * "### 已经吃过的药" "**硝苯地平缓释片**"，像坏掉了一样。
 *
 * 这里只支持回答里实际会用到的语法，不引入完整 Markdown 库：
 * 标题 / 无序列表 / 有序列表 / 加粗 / 分隔线 / 空行分段。
 */

/** 把一行内的 **加粗** 语法拆成普通文本 + strong 节点 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== '');
  return parts.map((part, i) => {
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-sage-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-t${i}`}>{part}</span>;
  });
}

interface ListBuffer {
  ordered: boolean;
  items: string[];
}

function flushList(buffer: ListBuffer | null, key: string): ReactNode {
  if (!buffer || buffer.items.length === 0) return null;
  const Tag = buffer.ordered ? 'ol' : 'ul';
  return (
    <Tag
      key={key}
      className={cn(
        'space-y-1.5 my-2 pl-1',
        buffer.ordered ? 'list-none' : 'list-none',
      )}
    >
      {buffer.items.map((item, i) => (
        <li key={`${key}-${i}`} className="flex gap-2 leading-relaxed">
          <span
            className={cn(
              'shrink-0 text-sage-400 select-none',
              buffer.ordered ? 'min-w-[1.1em] tabular-nums' : 'mt-[0.35em]',
            )}
          >
            {buffer.ordered ? `${i + 1}.` : '•'}
          </span>
          <span className="flex-1">{renderInline(item, `${key}-${i}`)}</span>
        </li>
      ))}
    </Tag>
  );
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let buffer: ListBuffer | null = null;
  let paragraph: string[] = [];

  const flushParagraph = (key: string) => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={key} className="leading-relaxed">
        {renderInline(paragraph.join(''), key)}
      </p>,
    );
    paragraph = [];
  };

  const flushAll = (key: string) => {
    flushParagraph(`${key}-p`);
    const list = flushList(buffer, `${key}-l`);
    if (list) blocks.push(list);
    buffer = null;
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    const key = `ln${index}`;

    // 空行 = 段落分隔
    if (!trimmed) {
      flushAll(key);
      return;
    }

    // 分隔线
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushAll(key);
      blocks.push(<hr key={key} className="my-3 border-sage-100" />);
      return;
    }

    // 标题（扣子主要用 ### ，同时也兼容 ## / #）
    const heading = trimmed.match(/^(#{1,4})\s*(.+)$/);
    if (heading) {
      flushAll(key);
      const level = heading[1].length;
      blocks.push(
        <p
          key={key}
          className={cn(
            'font-semibold text-sage-800',
            level <= 2 ? 'text-base mt-3 mb-1' : 'text-[0.95rem] mt-3 mb-0.5',
          )}
        >
          {renderInline(heading[2], key)}
        </p>,
      );
      return;
    }

    // 有序列表
    const ordered = trimmed.match(/^(\d+)[.、)]\s*(.+)$/);
    if (ordered) {
      flushParagraph(`${key}-p`);
      if (!buffer || !buffer.ordered) {
        const prev = flushList(buffer, `${key}-lprev`);
        if (prev) blocks.push(prev);
        buffer = { ordered: true, items: [] };
      }
      buffer.items.push(ordered[2]);
      return;
    }

    // 无序列表
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      flushParagraph(`${key}-p`);
      if (!buffer || buffer.ordered) {
        const prev = flushList(buffer, `${key}-lprev`);
        if (prev) blocks.push(prev);
        buffer = { ordered: false, items: [] };
      }
      buffer.items.push(bullet[1]);
      return;
    }

    // 缩进的补充说明（例如列表项下的"建议：…"），并进上一段
    if (/^\s{2,}\S/.test(line) && buffer) {
      buffer.items.push(trimmed);
      return;
    }

    // 普通文本
    const prev = flushList(buffer, `${key}-lprev`);
    if (prev) blocks.push(prev);
    buffer = null;
    paragraph.push(trimmed);
  });

  flushAll('tail');

  return <div className={cn('space-y-1 text-sm', className)}>{blocks}</div>;
}
