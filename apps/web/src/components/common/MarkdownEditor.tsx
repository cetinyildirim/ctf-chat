'use client';

import * as React from 'react';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Eye,
  Pencil,
  Strikethrough,
  Quote,
  Minus,
  ImageIcon,
  Table,
  Underline,
  SquareCode,
  FileCode,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { MessageMarkdown } from '@/components/chat/MessageMarkdown';
import { useI18n } from '@/components/providers/LocaleProvider';
import { cn } from '@/lib/utils';

type Selection = { start: number; end: number };

function insertAround(value: string, sel: Selection, before: string, after: string) {
  const selected = value.slice(sel.start, sel.end);
  const next = value.slice(0, sel.start) + before + selected + after + value.slice(sel.end);
  const start = sel.start + before.length;
  const end = start + selected.length;
  return { value: next, selection: { start, end } };
}

function insertLinePrefix(value: string, sel: Selection, prefix: string) {
  const lineStart = value.lastIndexOf('\n', sel.start - 1) + 1;
  const lineEnd = value.indexOf('\n', sel.start);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const line = value.slice(lineStart, end);
  const stripped = line
    .replace(/^#+\s*/, '')
    .replace(/^>\s?/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+\.\s*/, '');
  const active =
    (prefix === '# ' && /^#\s/.test(line)) ||
    (prefix === '## ' && /^##\s/.test(line)) ||
    (prefix === '### ' && /^###\s/.test(line)) ||
    (prefix === '> ' && /^>\s?/.test(line)) ||
    (prefix === '- ' && /^[-*]\s/.test(line)) ||
    (prefix === '1. ' && /^\d+\.\s/.test(line));
  const nextLine = active ? stripped : prefix + stripped;
  const next = value.slice(0, lineStart) + nextLine + value.slice(end);
  const delta = nextLine.length - line.length;
  return {
    value: next,
    selection: { start: sel.start + delta, end: sel.end + delta },
  };
}

function insertBlock(value: string, sel: Selection, block: string) {
  const next = value.slice(0, sel.start) + block + value.slice(sel.end);
  const pos = sel.start + block.length;
  return { value: next, selection: { start: pos, end: pos } };
}

function insertLink(value: string, sel: Selection) {
  const selected = value.slice(sel.start, sel.end);
  if (!selected) {
    return insertAround(value, sel, '[', '](https://)');
  }
  const next = value.slice(0, sel.start) + `[${selected}](https://)` + value.slice(sel.end);
  const cursor = sel.start + `[${selected}](https://`.length;
  return { value: next, selection: { start: cursor, end: cursor } };
}

function insertImage(value: string, sel: Selection, defaultAlt: string) {
  const selected = value.slice(sel.start, sel.end);
  const alt = selected || defaultAlt;
  return insertAround(value, sel, `![${alt}](`, 'https://)');
}

function insertQuoteBlock(value: string, sel: Selection) {
  const selected = value.slice(sel.start, sel.end);
  if (!selected) {
    return insertLinePrefix(value, sel, '> ');
  }
  const quoted = selected
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
  const next = value.slice(0, sel.start) + quoted + value.slice(sel.end);
  return { value: next, selection: { start: sel.start, end: sel.start + quoted.length } };
}

type Tool = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  action: () => void;
  group?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  minHeight?: string;
};

function ToolbarBtn({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1.5 text-muted-fg transition-colors hover:bg-white/8 hover:text-fg disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 hidden h-5 w-px bg-white/10 sm:block" aria-hidden />;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 12,
  className,
  minHeight = '240px',
}: Props) {
  const { t } = useI18n();
  const [tab, setTab] = React.useState<'write' | 'preview'>('write');
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const apply = React.useCallback(
    (fn: (v: string, s: Selection) => { value: string; selection: Selection }) => {
      const el = ref.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      const { value: next, selection } = fn(value, { start, end });
      onChange(next);
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        el.setSelectionRange(selection.start, selection.end);
      });
    },
    [onChange, value],
  );

  const tools: Tool[] = React.useMemo(
    () => [
      { icon: Heading1, label: t.mdEditorH1, group: 'head', action: () => apply((v, s) => insertLinePrefix(v, s, '# ')) },
      { icon: Heading2, label: t.mdEditorH2, group: 'head', action: () => apply((v, s) => insertLinePrefix(v, s, '## ')) },
      { icon: Heading3, label: t.mdEditorH3, group: 'head', action: () => apply((v, s) => insertLinePrefix(v, s, '### ')) },
      { icon: Bold, label: t.mdEditorBold, group: 'fmt', action: () => apply((v, s) => insertAround(v, s, '**', '**')) },
      { icon: Italic, label: t.mdEditorItalic, group: 'fmt', action: () => apply((v, s) => insertAround(v, s, '_', '_')) },
      { icon: Underline, label: t.mdEditorUnderline, group: 'fmt', action: () => apply((v, s) => insertAround(v, s, '<u>', '</u>')) },
      { icon: Strikethrough, label: t.mdEditorStrike, group: 'fmt', action: () => apply((v, s) => insertAround(v, s, '~~', '~~')) },
      {
        icon: SquareCode,
        label: t.mdEditorInlineCode,
        group: 'fmt',
        action: () => apply((v, s) => insertAround(v, s, '`', '`')),
      },
      { icon: Link, label: t.mdEditorLink, group: 'media', action: () => apply(insertLink) },
      {
        icon: ImageIcon,
        label: t.mdEditorImage,
        group: 'media',
        action: () => apply((v, s) => insertImage(v, s, t.mdEditorImageAltDefault)),
      },
      { icon: List, label: t.mdEditorBulletList, group: 'list', action: () => apply((v, s) => insertLinePrefix(v, s, '- ')) },
      {
        icon: ListOrdered,
        label: t.mdEditorNumberedList,
        group: 'list',
        action: () => apply((v, s) => insertLinePrefix(v, s, '1. ')),
      },
      { icon: Quote, label: t.mdEditorQuote, group: 'list', action: () => apply(insertQuoteBlock) },
      { icon: Minus, label: t.mdEditorHr, group: 'list', action: () => apply((v, s) => insertBlock(v, s, '\n\n---\n\n')) },
      {
        icon: FileCode,
        label: t.mdEditorCode,
        group: 'block',
        action: () => apply((v, s) => insertAround(v, s, '```\n', '\n```')),
      },
      {
        icon: Table,
        label: t.mdEditorTable,
        group: 'block',
        action: () => apply((v, s) => insertBlock(v, s, `\n${t.mdEditorTableDefault}\n`)),
      },
    ],
    [apply, t],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    const map: Record<string, () => void> = {
      b: () => tools.find((x) => x.label === t.mdEditorBold)?.action(),
      i: () => tools.find((x) => x.label === t.mdEditorItalic)?.action(),
      k: () => tools.find((x) => x.label === t.mdEditorLink)?.action(),
    };
    if (map[key]) {
      e.preventDefault();
      map[key]?.();
    }
  };

  const charCount = value.length;
  const lineCount = value ? value.split('\n').length : 0;

  let lastGroup: string | undefined;
  const toolbarNodes: React.ReactNode[] = [];
  for (const tool of tools) {
    if (tool.group && tool.group !== lastGroup && lastGroup !== undefined) {
      toolbarNodes.push(<ToolbarDivider key={`div-${tool.group}`} />);
    }
    lastGroup = tool.group;
    toolbarNodes.push(
      <ToolbarBtn
        key={tool.label}
        label={tool.label}
        icon={tool.icon}
        disabled={tab === 'preview'}
        onClick={tool.action}
      />,
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-md border border-white/10 bg-bg-elev/40', className)}>
      <div className="flex flex-col gap-2 border-b border-white/10 bg-white/[0.03] px-2 py-2">
        <div className="flex flex-wrap items-center gap-0.5">{toolbarNodes}</div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-muted-fg">{t.mdEditorShortcutsHint}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] tabular-nums text-muted-fg">
              {t.mdEditorStats.replace('{{lines}}', String(lineCount)).replace('{{chars}}', String(charCount))}
            </span>
            <div className="flex rounded-md border border-white/10 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTab('write')}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-1 transition-colors',
                  tab === 'write' ? 'bg-white/10 text-fg' : 'text-muted-fg hover:text-fg',
                )}
              >
                <Pencil className="h-3 w-3" />
                {t.mdEditorWrite}
              </button>
              <button
                type="button"
                onClick={() => setTab('preview')}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-1 transition-colors',
                  tab === 'preview' ? 'bg-white/10 text-fg' : 'text-muted-fg hover:text-fg',
                )}
              >
                <Eye className="h-3 w-3" />
                {t.mdEditorPreview}
              </button>
            </div>
          </div>
        </div>
      </div>

      {tab === 'write' ? (
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={rows}
          placeholder={placeholder}
          style={{ minHeight }}
          className="resize-y rounded-none border-0 bg-transparent font-mono text-sm leading-relaxed focus-visible:ring-0"
        />
      ) : (
        <div className="overflow-y-auto p-4" style={{ minHeight }}>
          {value.trim() ? (
            <MessageMarkdown content={value} allowHtml />
          ) : (
            <p className="text-sm text-muted-fg">{t.mdEditorPreviewEmpty}</p>
          )}
        </div>
      )}
    </div>
  );
}
