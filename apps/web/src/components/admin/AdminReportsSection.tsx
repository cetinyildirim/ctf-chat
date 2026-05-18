'use client';

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { UserIdentity } from '@/components/common/UserIdentity';
import { adminReportsApi, type AdminUserReport } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';
import { fullTimestamp } from '@/lib/format/time';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function statusClass(status: string) {
  if (status === 'OPEN') return 'bg-accent-amber/15 text-accent-amber';
  if (status === 'REVIEWED') return 'bg-accent-emerald/15 text-accent-emerald';
  return 'bg-white/10 text-muted-fg';
}

function ReportRow({
  row,
  onPatch,
  pending,
  t,
}: {
  row: AdminUserReport;
  onPatch: (status: 'REVIEWED' | 'DISMISSED') => void;
  pending: boolean;
  t: ReturnType<typeof useI18n>['t'];
}) {
  return (
    <tr className="border-b border-white/5 align-top">
      <td className="px-3 py-3 text-xs text-muted-fg whitespace-nowrap">{fullTimestamp(row.createdAt)}</td>
      <td className="px-3 py-3">
        <UserIdentity user={row.reporter} />
      </td>
      <td className="px-3 py-3">
        <UserIdentity user={row.reported} />
      </td>
      <td className="px-3 py-3 text-sm text-fg">{row.reason}</td>
      <td className="px-3 py-3 max-w-xs text-sm text-fg-subtle whitespace-pre-wrap">{row.details ?? '—'}</td>
      <td className="px-3 py-3 text-xs text-muted-fg">
        {row.contextType ?? '—'}
        {row.contextId ? <div className="font-mono truncate">{row.contextId}</div> : null}
      </td>
      <td className="px-3 py-3">
        <span className={cn('rounded px-2 py-0.5 text-[11px] font-medium uppercase', statusClass(row.status))}>
          {t[`reportsStatus_${row.status}` as keyof typeof t] as string}
        </span>
        {row.reviewedAt ? (
          <div className="mt-1 text-[10px] text-muted-fg">{fullTimestamp(row.reviewedAt)}</div>
        ) : null}
      </td>
      <td className="px-3 py-3">
        {row.status === 'OPEN' ? (
          <div className="flex flex-col gap-1">
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onPatch('REVIEWED')}>
              {t.reportsMarkReviewed}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => onPatch('DISMISSED')}>
              {t.reportsMarkDismissed}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-fg">
            {row.reviewedBy ? `@${row.reviewedBy.username}` : '—'}
          </span>
        )}
      </td>
    </tr>
  );
}

export function AdminReportsSection() {
  const { t } = useI18n();
  const [filter, setFilter] = React.useState<string>('OPEN');

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.adminReports(filter === 'all' ? undefined : filter),
    queryFn: () => adminReportsApi.list(filter === 'all' ? undefined : filter),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'REVIEWED' | 'DISMISSED' }) =>
      adminReportsApi.patch(id, { status }),
    onSuccess: () => {
      toast.success(t.reportsSaved);
      void refetch();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-fg">
          <Flag className="h-5 w-5 text-accent-rose" />
          {t.reportsSectionTitle}
        </h2>
        <p className="mt-1 text-sm text-fg-subtle">{t.reportsSectionLead}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['OPEN', 'REVIEWED', 'DISMISSED', 'all'] as const).map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={filter === s ? 'default' : 'outline'}
            onClick={() => setFilter(s)}
          >
            {t[`reportsFilter_${s}` as keyof typeof t] as string}
          </Button>
        ))}
      </div>

      <GlassPanel className="overflow-x-auto p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-fg">{t.reportsLoading}</p>
        ) : data.length === 0 ? (
          <p className="p-6 text-sm text-muted-fg">{t.reportsEmpty}</p>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-white/8 bg-white/[0.02] text-xs uppercase tracking-wide text-muted-fg">
              <tr>
                <th className="px-3 py-2">{t.reportsColDate}</th>
                <th className="px-3 py-2">{t.reportsColReporter}</th>
                <th className="px-3 py-2">{t.reportsColReported}</th>
                <th className="px-3 py-2">{t.reportsColReason}</th>
                <th className="px-3 py-2">{t.reportsColDetails}</th>
                <th className="px-3 py-2">{t.reportsColContext}</th>
                <th className="px-3 py-2">{t.reportsColStatus}</th>
                <th className="px-3 py-2">{t.reportsColActions}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <ReportRow
                  key={row.id}
                  row={row}
                  t={t}
                  pending={patchMut.isPending}
                  onPatch={(status) => patchMut.mutate({ id: row.id, status })}
                />
              ))}
            </tbody>
          </table>
        )}
      </GlassPanel>
    </div>
  );
}
