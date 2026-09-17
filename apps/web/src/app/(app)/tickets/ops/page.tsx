'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowLeft, LifeBuoy, Users } from 'lucide-react';
import { Permission } from '@sydt/shared';
import { ticketsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusPill } from '@/components/tickets/StatusPill';
import { SeverityPill } from '@/components/common/SeverityPill';
import { relative } from '@/lib/format/time';
import { useServerStore } from '@/store/server';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/components/providers/LocaleProvider';
import { cn } from '@/lib/utils';
import { ticketCategoryLabel } from '@/i18n/ticket-labels';

/**
 * Organizer dashboard and live operations view (spec §19-20, §46-47).
 * Requires TICKET_VIEW_ALL; competitors are redirected away.
 */
export default function TicketOpsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const canViewAll = !!user?.permissions.includes(Permission.TICKET_VIEW_ALL);

  React.useEffect(() => {
    if (user && !canViewAll) router.replace('/tickets');
  }, [user, canViewAll, router]);

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: queryKeys.ticketStats(activeServerId ?? ''),
    queryFn: () => ticketsApi.stats(activeServerId!),
    enabled: !!activeServerId && canViewAll,
    refetchInterval: 20_000,
  });

  const { data: report } = useQuery({
    queryKey: queryKeys.ticketReport(activeServerId ?? ''),
    queryFn: () => ticketsApi.report(activeServerId!),
    enabled: !!activeServerId && canViewAll && !isError,
    refetchInterval: 60_000,
  });

  if (user && !canViewAll) return null;

  const minutes = (value: number | null) =>
    value === null ? t.ticketReportNoData : `${value} ${t.ticketReportMinutes}`;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        title={
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent-amber" />
            <span>{t.ticketOpsTitle}</span>
          </div>
        }
        subtitle={t.ticketOpsLead}
        right={
          <Button asChild size="sm" variant="outline">
            <Link href="/tickets">
              <ArrowLeft className="h-3.5 w-3.5" /> {t.ticketsTitle}
            </Link>
          </Button>
        }
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {isError ? (
            <EmptyState
              icon={LifeBuoy}
              title={t.ticketsEmpty}
              description={t.ticketOpsLead}
            />
          ) : null}

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : null}

          {stats ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label={t.ticketOpsLast5} value={stats.arrivals.last5} tone="rose" />
                <Metric label={t.ticketOpsLast15} value={stats.arrivals.last15} tone="amber" />
                <Metric label={t.ticketOpsLast30} value={stats.arrivals.last30} tone="cyan" />
                <Metric
                  label={t.ticketOpsUnassigned}
                  value={stats.unassignedActive}
                  tone={stats.unassignedActive > 0 ? 'rose' : 'emerald'}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label={t.ticketOpsTotal} value={stats.total} />
                <Metric label={t.ticketOpsActive} value={stats.active} tone="amber" />
                <Metric
                  label={t.severity_CRITICAL}
                  value={stats.priorityCounts.CRITICAL}
                  tone={stats.priorityCounts.CRITICAL > 0 ? 'rose' : undefined}
                />
                <Metric label={t.severity_HIGH} value={stats.priorityCounts.HIGH} tone="amber" />
              </div>

              <GlassPanel className="p-4">
                <PanelTitle>{t.ticketFieldStatus}</PanelTitle>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.statusCounts).map(([status, count]) => (
                    <div
                      key={status}
                      className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5"
                    >
                      <StatusPill status={status as never} />
                      <span className="text-sm font-semibold text-fg">{count}</span>
                    </div>
                  ))}
                </div>
              </GlassPanel>

              {stats.multiTeam.length > 0 ? (
                <GlassPanel tone="rose" className="p-4">
                  <PanelTitle>
                    <Users className="mr-1 inline h-3 w-3" /> {t.ticketOpsMultiTeam}
                  </PanelTitle>
                  <ul className="space-y-1.5">
                    {stats.multiTeam.map((row) => (
                      <li
                        key={row.challengeId}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="truncate text-fg">{row.challengeTitle}</span>
                        <span className="text-xs text-accent-rose">
                          {row.teamCount} {t.ticketOpsMultiTeamHint}
                        </span>
                      </li>
                    ))}
                  </ul>
                </GlassPanel>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-3">
                <BreakdownPanel
                  title={t.ticketOpsPerTeam}
                  rows={stats.perTeam.map((row) => ({
                    key: row.teamId,
                    label: row.name,
                    count: row.count,
                    color: row.color,
                  }))}
                />
                <BreakdownPanel
                  title={t.ticketOpsPerChallenge}
                  rows={stats.perChallenge.map((row) => ({
                    key: row.challengeId,
                    label: row.title,
                    count: row.count,
                  }))}
                />
                <BreakdownPanel
                  title={t.ticketOpsPerCategory}
                  rows={stats.perCategory.map((row) => ({
                    key: row.categoryId ?? 'none',
                    label: row.categoryId
                      ? ticketCategoryLabel(t, { key: row.key, name: row.name })
                      : t.ticketUncategorized,
                    count: row.count,
                  }))}
                />
              </div>

              {stats.perAssignee.length > 0 ? (
                <BreakdownPanel
                  title={t.ticketOpsPerAssignee}
                  rows={stats.perAssignee.map((row) => ({
                    key: row.userId,
                    label: row.name,
                    count: row.count,
                  }))}
                />
              ) : null}

              {report ? (
                <GlassPanel className="p-4">
                  <PanelTitle>{t.ticketOpsReport}</PanelTitle>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Metric
                      label={t.ticketReportAvgFirstResponse}
                      value={minutes(report.avgFirstResponseMinutes)}
                      hint={`${report.firstResponseSamples} ${t.ticketReportSamples}`}
                    />
                    <Metric
                      label={t.ticketReportAvgResolution}
                      value={minutes(report.avgResolutionMinutes)}
                      hint={`${report.resolutionSamples} ${t.ticketReportSamples}`}
                    />
                    <Metric label={t.ticketReportUnresolved} value={report.unresolved} />
                    <Metric label={t.ticketReportClosed} value={report.closed} />
                    <Metric label={t.ticketReportReopened} value={report.reopened} />
                    <Metric label={t.ticketReportCritical} value={report.critical} tone="rose" />
                  </div>
                </GlassPanel>
              ) : null}

              <GlassPanel className="p-4">
                <PanelTitle>{t.ticketOpsRecent}</PanelTitle>
                <ul className="space-y-1.5">
                  {stats.recent.map((ticket) => (
                    <li key={ticket.id}>
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="flex items-center gap-2 rounded-lg border border-white/8 px-2.5 py-1.5 text-sm transition-colors hover:border-accent-cyan/30"
                      >
                        <span className="font-mono text-[11px] text-muted-fg">{ticket.code}</span>
                        <span className="min-w-0 flex-1 truncate text-fg">{ticket.title}</span>
                        <SeverityPill severity={ticket.priority} />
                        <StatusPill status={ticket.status} />
                        <span className="text-[11px] text-muted-fg">
                          {relative(ticket.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </GlassPanel>
            </>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  tone?: 'rose' | 'amber' | 'cyan' | 'emerald';
  hint?: string;
}) {
  return (
    <GlassPanel className="p-3" tone={tone}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 text-2xl font-bold',
          tone === 'rose' && 'text-accent-rose',
          tone === 'amber' && 'text-accent-amber',
          tone === 'cyan' && 'text-accent-cyan',
          tone === 'emerald' && 'text-accent-emerald',
          !tone && 'text-fg',
        )}
      >
        {value}
      </div>
      {hint ? <div className="text-[10px] text-muted-fg">{hint}</div> : null}
    </GlassPanel>
  );
}

function BreakdownPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; label: string; count: number; color?: string }>;
}) {
  const max = rows.reduce((best, row) => Math.max(best, row.count), 0) || 1;
  return (
    <GlassPanel className="p-4">
      <PanelTitle>{title}</PanelTitle>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-fg">—</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 10).map((row) => (
            <li key={row.key} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-fg-subtle" style={row.color ? { color: row.color } : undefined}>
                  {row.label}
                </span>
                <span className="text-fg">{row.count}</span>
              </div>
              <div className="h-1 rounded-full bg-white/5">
                <div
                  className="h-1 rounded-full bg-accent-cyan/60"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
