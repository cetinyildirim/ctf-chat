'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, ScrollText } from 'lucide-react';
import type { AuditLogEntry } from '@sydt/shared';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useI18n } from '@/components/providers/LocaleProvider';
import { formatAuditEntry, formatAuditTarget } from '@/lib/audit/format-audit';
import { fullTimestamp } from '@/lib/format/time';
import { TeamMark } from '@/components/common/TeamMark';
import { cn } from '@/lib/utils';

type SortKey = 'createdAt' | 'action' | 'summary' | 'actor' | 'target';
type SortDir = 'asc' | 'desc';

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-1.5 px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-fg transition-colors hover:text-fg',
        active && 'text-accent-cyan',
        className,
      )}
    >
      <span className="truncate">{label}</span>
      <Icon className={cn('h-3.5 w-3.5 shrink-0 opacity-60', active && 'opacity-100')} />
    </button>
  );
}

export function AdminAuditSection() {
  const { t } = useI18n();
  const [q, setQ] = React.useState('');
  const [action, setAction] = React.useState('');
  const [actorId, setActorId] = React.useState('');
  const [target, setTarget] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [applied, setApplied] = React.useState({
    q: '',
    action: '',
    actorId: '',
    target: '',
    from: '',
    to: '',
  });
  const [sortKey, setSortKey] = React.useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = React.useState<SortDir>('desc');

  const { data: actionCodes = [] } = useQuery({
    queryKey: queryKeys.auditActions,
    queryFn: adminApi.auditActions,
    staleTime: 120_000,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...queryKeys.audit, applied] as const,
    queryFn: () =>
      adminApi.audit({
        q: applied.q || undefined,
        action: applied.action || undefined,
        actorId: applied.actorId || undefined,
        target: applied.target || undefined,
        from: applied.from ? new Date(applied.from).toISOString() : undefined,
        to: applied.to ? new Date(applied.to).toISOString() : undefined,
        limit: 500,
      }),
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const sorted = React.useMemo(() => {
    const list = [...(data?.entries ?? [])];
    const mul = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'action':
          cmp = a.action.localeCompare(b.action);
          break;
        case 'summary':
          cmp = formatAuditEntry(a, t).localeCompare(formatAuditEntry(b, t));
          break;
        case 'actor': {
          const an = a.actor?.displayName ?? '';
          const bn = b.actor?.displayName ?? '';
          cmp = an.localeCompare(bn);
          break;
        }
        case 'target':
          cmp = (a.target ?? '').localeCompare(b.target ?? '');
          break;
      }
      return cmp * mul;
    });
    return list;
  }, [data?.entries, sortKey, sortDir, t]);

  const applyFilters = () => setApplied({ q, action, actorId, target, from, to });

  const resetFilters = () => {
    setQ('');
    setAction('');
    setActorId('');
    setTarget('');
    setFrom('');
    setTo('');
    setApplied({ q: '', action: '', actorId: '', target: '', from: '', to: '' });
  };

  return (
    <div className="admin-page w-full space-y-6 text-[15px] leading-relaxed">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
          <ScrollText className="h-5 w-5 text-accent-cyan" />
          {t.adminMenuAudit}
        </h1>
        <p className="mt-1 text-fg-subtle">{t.auditPageLead}</p>
      </div>

      <GlassPanel className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label>{t.auditFilterSearch}</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.auditFilterSearchHint} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.auditFilterAction}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-border/80 bg-bg-deep px-3 text-[15px] text-fg"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="">{t.auditFilterActionAll}</option>
              {actionCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.auditFilterActorId}</Label>
            <Input value={actorId} onChange={(e) => setActorId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.auditFilterTarget}</Label>
            <Input
              className="text-[15px]"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={t.auditFilterTargetHint}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t.auditFilterFrom}</Label>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.auditFilterTo}</Label>
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={applyFilters}>
            {t.auditFilterApply}
          </Button>
          <Button type="button" variant="outline" onClick={resetFilters}>
            {t.auditFilterReset}
          </Button>
          {isFetching ? <span className="self-center text-xs text-muted-fg">{t.loading}</span> : null}
        </div>
        {data ? (
          <p className="text-xs text-muted-fg">{t.auditResultCount.replace('{{count}}', String(data.total))}</p>
        ) : null}
      </GlassPanel>

      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-[15px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="w-[11rem]">
                  <SortHeader
                    label={t.auditColTime}
                    active={sortKey === 'createdAt'}
                    dir={sortDir}
                    onClick={() => toggleSort('createdAt')}
                  />
                </th>
                <th className="w-[10rem]">
                  <SortHeader
                    label={t.auditColAction}
                    active={sortKey === 'action'}
                    dir={sortDir}
                    onClick={() => toggleSort('action')}
                  />
                </th>
                <th>
                  <SortHeader
                    label={t.auditColSummary}
                    active={sortKey === 'summary'}
                    dir={sortDir}
                    onClick={() => toggleSort('summary')}
                  />
                </th>
                <th className="w-[12rem]">
                  <SortHeader
                    label={t.auditColActor}
                    active={sortKey === 'actor'}
                    dir={sortDir}
                    onClick={() => toggleSort('actor')}
                  />
                </th>
                <th className="w-[9rem]">
                  <SortHeader
                    label={t.auditColTarget}
                    active={sortKey === 'target'}
                    dir={sortDir}
                    onClick={() => toggleSort('target')}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-fg">
                    {t.loading}
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-fg-subtle">
                    {t.auditEmpty}
                  </td>
                </tr>
              ) : (
                sorted.map((entry) => <AuditTableRow key={entry.id} entry={entry} t={t} />)
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}

function AuditTableRow({ entry, t }: { entry: AuditLogEntry; t: import('@/i18n/dict').Dict }) {
  const targetInfo = formatAuditTarget(entry, t);
  return (
    <tr className="border-b border-white/5 transition-colors hover:bg-accent-cyan/[0.08]">
      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-muted-fg">
        {fullTimestamp(entry.createdAt)}
      </td>
      <td className="px-3 py-3">
        <code className="rounded border border-white/10 bg-black/25 px-1.5 py-0.5 font-mono text-xs text-fg-subtle">
          {entry.action}
        </code>
      </td>
      <td className="max-w-md px-3 py-3 leading-relaxed text-fg">{formatAuditEntry(entry, t)}</td>
      <td className="px-3 py-3">
        {entry.actor ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {entry.actor.team ? <TeamMark team={entry.actor.team} size="xs" /> : null}
            <span className="min-w-0">
              <span className="block truncate font-medium text-fg">{entry.actor.displayName}</span>
              <span className="block truncate font-mono text-[10px] text-muted-fg">@{entry.actor.username}</span>
            </span>
          </span>
        ) : (
          <span className="text-fg-subtle">{t.auditSystemActor}</span>
        )}
      </td>
      <td className="px-3 py-3 text-fg-subtle">
        {targetInfo.label === '—' ? (
          '—'
        ) : (
          <span className="block max-w-[14rem]" title={targetInfo.detail ?? undefined}>
            <span className="block truncate text-[15px] text-fg">{targetInfo.label}</span>
            {targetInfo.detail ? (
              <span className="block truncate font-mono text-xs text-muted-fg">{targetInfo.detail}</span>
            ) : null}
          </span>
        )}
      </td>
    </tr>
  );
}
