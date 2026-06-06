/**
 * IOC / IP / hash / URL highlight pipeline.
 *
 * Runs over plain text nodes inside markdown output (NOT inside code blocks)
 * and wraps matched substrings in spans tagged for tooltips + click handlers.
 */

import * as React from 'react';

const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
const URL_RE = /\bhttps?:\/\/[^\s<>"`]+/g;
const HASH_RE = /\b(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64})\b/g;
const CVE_RE = /\bCVE-\d{4}-\d{4,7}\b/g;
const MENTION_RE = /@[a-z0-9_.-]{3,24}/gi;
const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|gov|edu|local|dev|sh|so|me|co|app|xyz|info|ai|cloud)\b/gi;

interface Token {
  type: 'text' | 'ip' | 'url' | 'hash' | 'cve' | 'domain' | 'mention';
  value: string;
}

function tokenize(text: string): Token[] {
  type Match = { type: Token['type']; start: number; end: number; value: string };
  const matches: Match[] = [];

  const collect = (re: RegExp, type: Token['type']) => {
    const r = new RegExp(re);
    let m: RegExpExecArray | null;
    while ((m = r.exec(text))) {
      if (m.index === r.lastIndex) r.lastIndex++;
      matches.push({ type, start: m.index, end: m.index + m[0].length, value: m[0] });
    }
  };

  collect(MENTION_RE, 'mention');
  collect(URL_RE, 'url');
  collect(IPV4, 'ip');
  collect(HASH_RE, 'hash');
  collect(CVE_RE, 'cve');
  collect(DOMAIN_RE, 'domain');

  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const filtered: Match[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue;
    filtered.push(m);
    cursor = m.end;
  }

  const out: Token[] = [];
  let idx = 0;
  for (const m of filtered) {
    if (idx < m.start) out.push({ type: 'text', value: text.slice(idx, m.start) });
    out.push({ type: m.type, value: m.value });
    idx = m.end;
  }
  if (idx < text.length) out.push({ type: 'text', value: text.slice(idx) });
  return out;
}

const classByType: Record<Token['type'], string> = {
  text: '',
  ip: 'rounded bg-accent-cyan/10 px-1 py-px font-mono text-[0.9em] text-accent-cyan border border-accent-cyan/20',
  hash: 'rounded bg-accent-violet/10 px-1 py-px font-mono text-[0.85em] text-accent-violet border border-accent-violet/20',
  url: 'text-accent-cyan underline underline-offset-2 hover:text-accent-violet',
  cve: 'rounded bg-accent-rose/10 px-1 py-px font-mono text-[0.85em] text-accent-rose border border-accent-rose/20',
  domain: 'rounded bg-accent-emerald/10 px-1 py-px font-mono text-[0.85em] text-accent-emerald border border-accent-emerald/20',
  mention: 'rounded bg-accent-cyan/10 px-0.5 font-medium text-accent-cyan',
};

const titleByType: Record<Token['type'], string | undefined> = {
  text: undefined,
  ip: 'IP address',
  hash: 'Hash',
  url: 'URL',
  cve: 'CVE identifier',
  domain: 'Domain',
  mention: 'Mention',
};

export function highlightText(text: string, keyPrefix = 'h'): React.ReactNode[] {
  const tokens = tokenize(text);
  return tokens.map((t, i) => {
    if (t.type === 'text') return <React.Fragment key={`${keyPrefix}-${i}`}>{t.value}</React.Fragment>;
    if (t.type === 'url') {
      return (
        <a
          key={`${keyPrefix}-${i}`}
          href={t.value}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={classByType.url}
          title={titleByType.url}
        >
          {t.value}
        </a>
      );
    }
    return (
      <span key={`${keyPrefix}-${i}`} className={classByType[t.type]} title={titleByType[t.type]}>
        {t.value}
      </span>
    );
  });
}

export function highlightChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') return highlightText(children);
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === 'string') return <React.Fragment key={i}>{highlightText(child, String(i))}</React.Fragment>;
      return <React.Fragment key={i}>{child}</React.Fragment>;
    });
  }
  return children;
}
