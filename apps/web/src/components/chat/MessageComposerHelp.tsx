'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { useI18n } from '@/components/providers/LocaleProvider';
import type { Dict } from '@/i18n/dict';
import { previewMessageFormat } from '@/lib/chat/message-format-preview';

type HelpRow = {
  title: string;
  syntax: string;
  desc: string;
  example: string;
};

function buildRows(t: Dict): HelpRow[] {
  return [
    {
      title: t.cmdBoldTitle,
      syntax: t.cmdBoldSyntax,
      desc: t.cmdBoldDesc,
      example: t.cmdBoldOut,
    },
    {
      title: t.cmdItalicTitle,
      syntax: t.cmdItalicSyntax,
      desc: t.cmdItalicDesc,
      example: t.cmdItalicOut,
    },
    {
      title: t.cmdCodeTitle,
      syntax: t.cmdCodeSyntax,
      desc: t.cmdCodeDesc,
      example: t.cmdCodeOut,
    },
    {
      title: t.cmdBlockTitle,
      syntax: t.cmdBlockSyntax,
      desc: t.cmdBlockDesc,
      example: t.cmdBlockOut,
    },
    {
      title: t.cmdQuoteTitle,
      syntax: t.cmdQuoteSyntax,
      desc: t.cmdQuoteDesc,
      example: t.cmdQuoteOut,
    },
    {
      title: t.cmdMentionTitle,
      syntax: t.cmdMentionSyntax,
      desc: t.cmdMentionDesc,
      example: t.cmdMentionOut,
    },
  ];
}

export function MessageComposerHelp() {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const rows = React.useMemo(() => buildRows(t), [t]);

  return (
    <div className="relative mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-white/[0.02] px-3 py-2 text-left text-xs text-fg-subtle transition-colors hover:bg-white/5 hover:text-fg"
      >
        <Terminal className="h-3.5 w-3.5 shrink-0 text-accent-cyan" />
        <span className="font-medium">{t.composerHelpTitle}</span>
        {open ? <ChevronUp className="ml-auto h-3.5 w-3.5" /> : <ChevronDown className="ml-auto h-3.5 w-3.5" />}
      </button>
      {open ? (
        <div
          className="absolute bottom-full left-0 right-0 z-30 mb-1 max-h-[min(42vh,24rem)] space-y-3 overflow-y-auto rounded-lg border border-border/50 bg-bg-elev/95 px-3 py-3 shadow-glass backdrop-blur-md"
          role="region"
          aria-label={t.composerHelpTitle}
        >
          <p className="text-[13px] leading-relaxed text-fg-subtle">{t.composerHelpIntro}</p>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border/50 text-[10px] font-semibold uppercase tracking-wide text-muted-fg">
                  <th className="px-2 py-2">{t.composerColFormat}</th>
                  <th className="px-2 py-2">{t.composerColSyntax}</th>
                  <th className="px-2 py-2">{t.composerColUse}</th>
                  <th className="px-2 py-2">{t.composerColWrite}</th>
                  <th className="px-2 py-2">{t.composerColResult}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.title} className="border-b border-border/30 align-top">
                    <td className="px-2 py-2.5 font-medium text-fg">{row.title}</td>
                    <td className="px-2 py-2.5">
                      <code className="rounded bg-bg-deep/80 px-1.5 py-0.5 font-mono text-[11px] text-accent-cyan">
                        {row.syntax}
                      </code>
                    </td>
                    <td className="max-w-[200px] px-2 py-2.5 text-fg-subtle">{row.desc}</td>
                    <td className="px-2 py-2.5">
                      <code className="whitespace-pre-wrap rounded bg-bg-deep/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-fg">
                        {row.example}
                      </code>
                    </td>
                    <td className="px-2 py-2.5">
                      <div
                        className="rounded-md border border-border/40 bg-bg-deep/40 p-2 text-sm text-fg"
                        dangerouslySetInnerHTML={{ __html: previewMessageFormat(row.example) }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 sm:hidden">
            {rows.map((row) => (
              <div key={row.title} className="rounded-md border border-border/40 bg-bg-deep/40 p-3">
                <div className="font-medium text-fg">{row.title}</div>
                <p className="mt-1 text-[12px] text-fg-subtle">{row.desc}</p>
                <div className="mt-2 text-[11px] text-muted-fg">
                  {t.composerColSyntax}:{' '}
                  <code className="font-mono text-accent-cyan">{row.syntax}</code>
                </div>
                <div className="mt-1 text-[11px] text-muted-fg">
                  {t.composerColWrite}:{' '}
                  <code className="whitespace-pre-wrap font-mono">{row.example}</code>
                </div>
                <div
                  className="mt-2 rounded border border-border/30 bg-white/[0.02] p-2 text-sm"
                  dangerouslySetInnerHTML={{ __html: previewMessageFormat(row.example) }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
