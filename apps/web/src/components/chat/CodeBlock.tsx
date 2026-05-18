'use client';

import * as React from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

type Highlighter = {
  codeToHtml: (code: string, opts: { lang: string; theme: string }) => string;
};

let highlighterPromise: Promise<Highlighter> | null = null;
async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const shiki = await import('shiki');
      return shiki.createHighlighter({
        themes: ['github-dark-dimmed'],
        langs: [
          'bash',
          'shell',
          'json',
          'javascript',
          'typescript',
          'python',
          'go',
          'rust',
          'c',
          'cpp',
          'sql',
          'yaml',
          'diff',
          'http',
          'log',
        ],
      }) as Promise<Highlighter>;
    })();
  }
  return highlighterPromise;
}

interface Props {
  code: string;
  language?: string;
}

const SUPPORTED = new Set([
  'bash', 'shell', 'sh', 'json', 'javascript', 'js', 'typescript', 'ts',
  'python', 'py', 'go', 'rust', 'rs', 'c', 'cpp', 'sql', 'yaml', 'yml',
  'diff', 'http', 'log',
]);

function resolveLang(lang?: string): string {
  if (!lang) return 'log';
  const l = lang.toLowerCase();
  if (l === 'js') return 'javascript';
  if (l === 'ts') return 'typescript';
  if (l === 'py') return 'python';
  if (l === 'rs') return 'rust';
  if (l === 'sh') return 'bash';
  if (l === 'yml') return 'yaml';
  return SUPPORTED.has(l) ? l : 'log';
}

export function CodeBlock({ code, language }: Props) {
  const [html, setHtml] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const lang = resolveLang(language);

  React.useEffect(() => {
    let mounted = true;
    getHighlighter()
      .then((hl) => {
        if (!mounted) return;
        setHtml(hl.codeToHtml(code, { lang, theme: 'github-dark-dimmed' }));
      })
      .catch(() => {
        if (!mounted) return;
        setHtml(null);
      });
    return () => {
      mounted = false;
    };
  }, [code, lang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error('Clipboard unavailable');
    }
  };

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-white/8 bg-bg-deep/80 shadow-glass">
      <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.03] px-3 py-1.5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-fg">
          <span className="inline-block h-2 w-2 rounded-full bg-accent-rose/70" />
          <span className="inline-block h-2 w-2 rounded-full bg-accent-amber/70" />
          <span className="inline-block h-2 w-2 rounded-full bg-accent-emerald/70" />
          <span className="ml-2">{lang}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-fg-subtle opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-fg"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {html ? (
        <div
          className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed text-fg-subtle">
          {code}
        </pre>
      )}
    </div>
  );
}
