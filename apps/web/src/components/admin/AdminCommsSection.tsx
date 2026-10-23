'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, MessageSquare } from 'lucide-react';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IncidentSeverity } from '@sydt/shared';
import { adminBroadcastsApi, type AdminBroadcastRow } from '@/lib/api/endpoints';
import { unwrapApiError } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';
import { toast } from 'sonner';
import { fullTimestamp } from '@/lib/format/time';

function kindLabel(kind: string, t: { commsKindMassDm: string; commsKindAnnouncement: string }) {
  if (kind === 'MASS_DM') return t.commsKindMassDm;
  if (kind === 'PLATFORM_ANNOUNCEMENT') return t.commsKindAnnouncement;
  return kind;
}

export function AdminCommsSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [severity, setSeverity] = React.useState<string>(IncidentSeverity.INFO);
  const [requireAck, setRequireAck] = React.useState(false);

  const severityOptions = React.useMemo(
    () => [
      { value: IncidentSeverity.INFO, label: t.commsSeverityInfo },
      { value: IncidentSeverity.LOW, label: t.commsSeverityLow },
      { value: IncidentSeverity.MEDIUM, label: t.commsSeverityMedium },
      { value: IncidentSeverity.HIGH, label: t.commsSeverityHigh },
      { value: IncidentSeverity.CRITICAL, label: t.commsSeverityCritical },
    ],
    [t],
  );

  function validateAnnouncement(): string | null {
    const titleTrim = title.trim();
    const bodyTrim = body.trim();
    if (titleTrim.length < 4) return t.commsAnnounceErrTitle;
    if (bodyTrim.length < 10) return t.commsAnnounceErrBody;
    if (!Object.values(IncidentSeverity).includes(severity as IncidentSeverity)) {
      return t.commsAnnounceErrSeverity;
    }
    return null;
  }

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['admin', 'broadcasts'] as const,
    queryFn: adminBroadcastsApi.history,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'broadcasts'] });

  const massMut = useMutation({
    mutationFn: () => adminBroadcastsApi.massDm({ title, body }),
    onSuccess: () => {
      toast.success(t.commsMassDmOk);
      setTitle('');
      setBody('');
      void invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const annMut = useMutation({
    mutationFn: () =>
      adminBroadcastsApi.announcement({
        title: title.trim(),
        body: body.trim(),
        severity: severity as IncidentSeverity,
        requireAck,
      }),
    onSuccess: () => {
      toast.success(t.commsAnnouncementOk);
      setTitle('');
      setBody('');
      setRequireAck(false);
      void invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  return (
    <div className="admin-page w-full space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
          <Megaphone className="h-5 w-5 text-accent-amber" />
          {t.adminMenuComms}
        </h1>
        <p className="mt-1 text-[15px] text-fg-subtle">{t.commsLead}</p>
      </div>

      <GlassPanel className="space-y-4 p-6">
        <Label>{t.commsTitle}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        <Label>{t.commsBody}</Label>
        <textarea
          className="min-h-[120px] w-full rounded-md border border-white/10 bg-bg-deep/60 px-3 py-2 text-[15px] text-fg"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="text-[12px] text-fg-subtle">{t.commsAnnounceRules}</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            className="accent-accent-cyan"
            checked={requireAck}
            onChange={(e) => setRequireAck(e.target.checked)}
          />
          {t.announcementRequireAck}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={massMut.isPending || !title.trim() || !body.trim()}
            onClick={() => massMut.mutate()}
          >
            <MessageSquare className="mr-1 h-4 w-4" />
            {t.commsSendMassDm}
          </Button>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">{t.commsSeverity}</Label>
              <select
                className="h-9 rounded-md border border-white/10 bg-bg-deep/60 px-2 text-sm"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                {severityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              disabled={annMut.isPending || !title.trim() || !body.trim()}
              onClick={() => {
                const err = validateAnnouncement();
                if (err) {
                  toast.error(err);
                  return;
                }
                annMut.mutate();
              }}
            >
              {t.commsSendAnnouncement}
            </Button>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="p-0">
        <div className="border-b border-white/5 px-4 py-3 font-semibold text-fg">{t.commsHistory}</div>
        {isLoading ? <p className="p-4 text-fg-subtle">{t.loading}</p> : null}
        {!isLoading && history.length === 0 ? (
          <p className="p-4 text-fg-subtle">{t.commsHistoryEmpty}</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {history.map((row: AdminBroadcastRow) => (
              <li key={row.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded bg-white/5 px-2 py-0.5 text-xs font-medium">
                    {kindLabel(row.kind, t)}
                  </span>
                  <span className="font-semibold text-fg">{row.title}</span>
                  <span className="text-xs text-muted-fg">
                    {t.commsRecipients.replace('{{count}}', String(row.recipientCount))}
                  </span>
                  <span className="ml-auto text-xs text-muted-fg">{fullTimestamp(row.createdAt)}</span>
                </div>
                <p className="line-clamp-2 text-sm text-fg-subtle">{row.body}</p>
                {row.createdBy ? (
                  <p className="text-xs text-muted-fg">
                    {row.createdBy.displayName} (@{row.createdBy.username})
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
