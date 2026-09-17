'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon } from 'lucide-react';
import { type Incident, IncidentSeverity, IncidentStatus, Permission, schemas } from '@sydt/shared';
import type { z } from 'zod';
import { incidentsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { SeverityPill } from '@/components/common/SeverityPill';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { MessageMarkdown } from '@/components/chat/MessageMarkdown';
import { relative } from '@/lib/format/time';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/components/providers/LocaleProvider';

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'border-accent-rose/40 bg-accent-rose/10 text-accent-rose',
  INVESTIGATING: 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber',
  MITIGATED: 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan',
  RESOLVED: 'border-accent-emerald/40 bg-accent-emerald/10 text-accent-emerald',
  POSTMORTEM: 'border-accent-violet/40 bg-accent-violet/10 text-accent-violet',
};

const severityOptions = Object.values(IncidentSeverity);
const statusOptions = Object.values(IncidentStatus);

export default function IncidentDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { t } = useI18n();
  const me = useAuthStore((s) => s.user);
  const canView = !!me?.permissions.includes(Permission.INCIDENT_VIEW);
  const canManage = !!me?.permissions.includes(Permission.INCIDENT_MANAGE);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.incident(id),
    queryFn: () => incidentsApi.get(id),
    enabled: canView && !!id,
    retry: false,
  });

  const [severity, setSeverity] = React.useState<string>(IncidentSeverity.MEDIUM);
  const [status, setStatus] = React.useState<string>(IncidentStatus.OPEN);
  const [description, setDescription] = React.useState('');

  React.useEffect(() => {
    if (!data) return;
    setSeverity(data.severity);
    setStatus(data.status);
    setDescription(data.description);
  }, [data]);

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error('No incident');
      const patch: z.infer<typeof schemas.updateIncidentSchema> = {};
      if (severity !== data.severity) {
        patch.severity = severity as (typeof IncidentSeverity)[keyof typeof IncidentSeverity];
      }
      if (status !== data.status) {
        patch.status = status as (typeof IncidentStatus)[keyof typeof IncidentStatus];
      }
      const nextDesc = description.trim();
      const prevDesc = data.description.trim();
      if (nextDesc !== prevDesc) patch.description = nextDesc;
      if (Object.keys(patch).length === 0) return data;
      const updated = await incidentsApi.update(id, patch);
      return updated;
    },
    onSuccess: (updated) => {
      toast.success(t.incidentUpdatedToast);
      qc.setQueryData(queryKeys.incident(id), updated);
      void qc.invalidateQueries({ queryKey: ['incidents'] });
    },
    onError: (err: unknown) => {
      toast.error(unwrapApiError(err).message ?? 'Error');
    },
  });

  if (!canView) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title={t.incidentsPageTitle} />
        <EmptyState icon={AlertOctagon} title={t.incidentsStaffOnlyTitle} description={t.incidentsStaffOnlyDesc} />
      </div>
    );
  }

  if (!id) {
    router.replace('/incidents');
    return null;
  }

  if (error || (!isLoading && !data)) {
    return (
      <div className="flex h-full flex-col">
        <TopBar
          title={<span>{t.incidentsPageTitle}</span>}
          subtitle={t.incidentNotFound}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          <p className="text-sm text-fg-subtle">{error ? t.incidentLoadFailed : t.incidentNotFound}</p>
          <Link href="/incidents" className="text-sm text-accent-cyan hover:underline">
            {t.incidentsBackToList}
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title={t.loading} />
        <div className="space-y-3 p-4">
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const descTrim = description.trim();
  const descChanged = descTrim !== data.description.trim();
  const descInvalid = descChanged && descTrim.length < 10;
  const dirtyFields =
    severity !== data.severity || status !== data.status || descChanged;
  const canSaveManage = canManage && dirtyFields && !descInvalid;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        title={
          <div className="flex min-w-0 items-center gap-2">
            <AlertOctagon className="h-4 w-4 shrink-0 text-accent-rose" />
            <span className="truncate">{data.title}</span>
            <SeverityPill severity={(canManage ? severity : data.severity) as Incident['severity']} dot />
          </div>
        }
        subtitle={<span>{t.incidentDetailSubtitle}</span>}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-center gap-3 text-xs">
          <Link href="/incidents" className="font-medium text-accent-cyan hover:underline">
            {t.incidentsBackToList}
          </Link>
        </div>

        <GlassPanel
          className="mb-6 p-6"
          tone={
            (canManage ? severity : data.severity) === 'CRITICAL' ||
            (canManage ? severity : data.severity) === 'HIGH'
              ? 'rose'
              : 'amber'
          }
        >
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-semibold uppercase tracking-wider',
                STATUS_COLOR[canManage ? status : data.status] ??
                  'border-white/10 bg-white/5 text-fg-subtle',
              )}
            >
              {canManage ? status : data.status}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
            <Avatar name={data.openedBy.displayName} src={data.openedBy.avatarUrl} size="xs" />
            <span>{t.incidentOpenedBy}: {data.openedBy.displayName}</span>
            <span>· {relative(data.createdAt)}</span>
            {data.resolvedAt ? <span>· {relative(data.resolvedAt)}</span> : null}
          </div>
          <div className="mt-2 text-[11px] text-fg-subtle">
            {data.assignedTo ? (
              <span className="inline-flex items-center gap-2">
                {t.incidentAssigned}:
                <Avatar name={data.assignedTo.displayName} src={data.assignedTo.avatarUrl} size="xs" />{' '}
                {data.assignedTo.displayName}
              </span>
            ) : (
              <span>{t.incidentAssigned}: —</span>
            )}
          </div>
          <div className="mt-4">
            <MessageMarkdown content={description} />
          </div>
        </GlassPanel>

        {canManage ? (
          <GlassPanel className="space-y-4 p-6">
            <h2 className="text-sm font-semibold text-fg">{t.incidentUpdateSection}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t.incidentSeverity}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-white/10 bg-bg-deep px-3 text-sm text-fg"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                >
                  {severityOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t.incidentStatus}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-white/10 bg-bg-deep px-3 text-sm text-fg"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.incidentDescription}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[140px]"
              />
              {descInvalid ? (
                <p className="text-[11px] text-accent-amber/90">{t.incidentDescriptionTooShort}</p>
              ) : null}
            </div>
            <Button
              type="button"
              disabled={!canSaveManage || updateMut.isPending}
              onClick={() => updateMut.mutate()}
            >
              {updateMut.isPending ? t.loading : t.save}
            </Button>
          </GlassPanel>
        ) : null}
      </div>
    </div>
  );
}
