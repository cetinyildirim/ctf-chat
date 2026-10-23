'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseBackup, Download, Loader2, Play, Trash2 } from 'lucide-react';
import {
  adminBackupsApi,
  type BackupFrequency,
  type BackupSettings,
} from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SELECT_CLASS = 'h-10 rounded-md border border-white/10 bg-bg-deep/60 px-2 text-sm text-fg';

function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function AdminBackupsSection() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.adminBackups,
    queryFn: adminBackupsApi.overview,
    refetchInterval: (q) => (q.state.data?.running ? 2_000 : 30_000),
  });

  const [form, setForm] = React.useState<BackupSettings | null>(null);
  React.useEffect(() => {
    if (data && !form) setForm(data.settings);
  }, [data, form]);

  const wasRunning = React.useRef(false);
  React.useEffect(() => {
    if (!data) return;
    if (wasRunning.current && !data.running) {
      if (data.lastRun?.status === 'OK') toast.success(t.backupDoneOk);
      else toast.error(`${t.backupDoneFail}${data.lastRun?.error ? `: ${data.lastRun.error}` : ''}`);
    }
    wasRunning.current = !!data.running;
  }, [data, t]);

  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.adminBackups });

  const saveMut = useMutation({
    mutationFn: (patch: BackupSettings) => adminBackupsApi.updateSettings(patch),
    onSuccess: () => {
      toast.success(t.backupSettingsSaved);
      void refresh();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const runMut = useMutation({
    mutationFn: adminBackupsApi.run,
    onSuccess: () => {
      wasRunning.current = true;
      toast(t.backupStarted);
      void refresh();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const deleteMut = useMutation({
    mutationFn: (name: string) => adminBackupsApi.remove(name),
    onSuccess: () => void refresh(),
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const fmtDate = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  const weekdays = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: 'long' }),
      ),
    [locale],
  );

  const frequencyOptions: { value: BackupFrequency; label: string }[] = [
    { value: 'EVERY_6H', label: t.backupFreq6h },
    { value: 'EVERY_12H', label: t.backupFreq12h },
    { value: 'DAILY', label: t.backupFreqDaily },
    { value: 'WEEKLY', label: t.backupFreqWeekly },
  ];

  if (isLoading || (!form && !error)) return <div className="text-fg-subtle">{t.loading}</div>;
  if (error || !data || !form) {
    return <div className="text-accent-rose">{unwrapApiError(error).message}</div>;
  }

  const set = <K extends keyof BackupSettings>(key: K, value: BackupSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));
  const dirty = JSON.stringify(form) !== JSON.stringify(data.settings);
  const running = data.running;

  return (
    <div className="admin-page w-full space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
          <DatabaseBackup className="h-5 w-5 text-accent-cyan" />
          {t.adminMenuBackups}
        </h1>
        <p className="mt-1 text-[15px] text-fg-subtle">{t.backupLead}</p>
      </div>

      <GlassPanel className="space-y-5 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-fg">{t.backupScheduleTitle}</h2>
            <p className="mt-0.5 text-xs text-fg-subtle">{t.backupScheduleHint}</p>
          </div>
          <Switch checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} />
        </div>

        <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', !form.enabled && 'opacity-60')}>
          <div className="space-y-1.5">
            <Label>{t.backupFrequency}</Label>
            <select
              className={cn(SELECT_CLASS, 'w-full')}
              value={form.frequency}
              onChange={(e) => set('frequency', e.target.value as BackupFrequency)}
            >
              {frequencyOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {form.frequency === 'WEEKLY' ? (
            <div className="space-y-1.5">
              <Label>{t.backupWeekday}</Label>
              <select
                className={cn(SELECT_CLASS, 'w-full')}
                value={form.weekday}
                onChange={(e) => set('weekday', Number(e.target.value))}
              >
                {weekdays.map((name, i) => (
                  <option key={i} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>{form.frequency.startsWith('EVERY_') ? t.backupStartHour : t.backupHour}</Label>
            <select
              className={cn(SELECT_CLASS, 'w-full')}
              value={form.hour}
              onChange={(e) => set('hour', Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.backupRetention}</Label>
            <Input
              type="number"
              min={1}
              max={90}
              className="h-10"
              value={form.retention}
              onChange={(e) => set('retention', Math.min(90, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            className="accent-accent-cyan"
            checked={form.includeUploads}
            onChange={(e) => set('includeUploads', e.target.checked)}
          />
          {t.backupIncludeUploads}
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
          <p className="text-xs text-fg-subtle">
            {t.backupNextRun}: <span className="text-fg">{data.nextRunAt ? fmtDate(data.nextRunAt) : t.backupNextRunOff}</span>
            {' · '}
            {t.backupServerTime}: {fmtDate(data.serverTime)}
          </p>
          <Button type="button" disabled={!dirty || saveMut.isPending} onClick={() => saveMut.mutate(form)}>
            {t.backupSave}
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-fg">{t.backupStatusTitle}</h2>
          <Button type="button" disabled={!!running || runMut.isPending} onClick={() => runMut.mutate()}>
            {running ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
            {running ? t.backupRunning : t.backupRunNow}
          </Button>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label={t.backupLastRun}
            value={data.lastRun ? fmtDate(data.lastRun.at) : t.backupNever}
            tone={data.lastRun?.status === 'FAILED' ? 'bad' : data.lastRun?.status === 'OK' ? 'good' : undefined}
            hint={
              data.lastRun
                ? data.lastRun.status === 'OK'
                  ? `${t.backupStatusOk} · ${formatBytes(data.lastRun.sizeBytes)} · ${Math.round((data.lastRun.durationMs ?? 0) / 100) / 10}s`
                  : `${t.backupStatusFailed}${data.lastRun.error ? `: ${data.lastRun.error}` : ''}`
                : undefined
            }
          />
          <Stat label={t.backupCount} value={String(data.backups.length)} />
          <Stat label={t.backupDiskFree} value={formatBytes(data.diskFreeBytes)} />
          <Stat label={t.backupDir} value={data.backupDir} mono />
        </dl>
      </GlassPanel>

      <GlassPanel className="p-0">
        <div className="border-b border-white/5 px-6 py-4">
          <h2 className="text-sm font-semibold text-fg">{t.backupListTitle}</h2>
        </div>
        {data.backups.length === 0 ? (
          <p className="px-6 py-6 text-sm text-fg-subtle">{t.backupListEmpty}</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {data.backups.map((b) => (
              <li key={b.name} className="flex flex-wrap items-center gap-3 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px] text-fg">{b.name}</p>
                  <p className="text-xs text-fg-subtle">
                    {fmtDate(b.createdAt)} · {formatBytes(b.sizeBytes)}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px]',
                    b.trigger === 'manual'
                      ? 'border-accent-amber/30 text-accent-amber'
                      : 'border-accent-cyan/30 text-accent-cyan',
                  )}
                >
                  {b.trigger === 'manual' ? t.backupTypeManual : t.backupTypeAuto}
                </span>
                <Button asChild size="sm" variant="outline">
                  <a href={adminBackupsApi.downloadUrl(b.name)} download={b.name}>
                    <Download className="mr-1 h-4 w-4" />
                    {t.backupDownload}
                  </a>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-accent-rose hover:text-accent-rose"
                  disabled={deleteMut.isPending}
                  onClick={() => {
                    if (window.confirm(t.backupDeleteConfirm.replace('{{name}}', b.name))) deleteMut.mutate(b.name);
                  }}
                  aria-label={t.backupDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-white/5 px-6 py-3 text-xs text-fg-subtle">{t.backupRetentionNote}</p>
      </GlassPanel>

      <GlassPanel className="space-y-3 p-6">
        <h2 className="text-sm font-semibold text-fg">{t.backupRestoreTitle}</h2>
        <p className="text-sm text-fg-subtle">{t.backupRestoreLead}</p>
        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-bg-deep/70 p-4 font-mono text-[12.5px] leading-relaxed text-fg">
{`sudo systemctl stop sydt-api
mkdir -p /tmp/sydt-restore && tar -xzf <yedek>.tar.gz -C /tmp/sydt-restore
# database.db → DATABASE_URL dosyasının yerine kopyalayın
sudo -u sydt cp /tmp/sydt-restore/database.db <DATABASE_URL yolu>
# uploads/ → UPLOAD_DIR (${data.uploadDir})
sudo -u sydt cp -a /tmp/sydt-restore/uploads/. <UPLOAD_DIR yolu>/
sudo systemctl start sydt-api`}
        </pre>
        <p className="text-xs text-fg-subtle">{t.backupSecurityNote}</p>
      </GlassPanel>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
  mono,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'bad';
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className={cn('mt-1 break-all text-fg', mono && 'font-mono text-xs')}>{value}</dd>
      {hint ? (
        <dd
          className={cn(
            'mt-0.5 text-xs',
            tone === 'bad' ? 'text-accent-rose' : tone === 'good' ? 'text-accent-emerald' : 'text-fg-subtle',
          )}
        >
          {hint}
        </dd>
      ) : null}
    </div>
  );
}
