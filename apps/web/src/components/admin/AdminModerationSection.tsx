'use client';

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ShieldBan, Search, Timer, Flag } from 'lucide-react';
import { AdminReportsSection } from '@/components/admin/AdminReportsSection';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  adminUsersApi,
  type AdminModerationUser,
  type ModerationBody,
  type MuteHistoryEntry,
} from '@/lib/api/endpoints';
import { formatModerationDuration } from '@/lib/moderation/messages';

const BAN_DURATIONS = [60, 1440, 4320, 10080, 43200] as const;
import { unwrapApiError } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';
import type { Dict } from '@/i18n/dict';
import { toast } from 'sonner';
import { fullTimestamp } from '@/lib/format/time';

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function useNowTick(active: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function MutedRow({
  u,
  now,
  t,
  onUnmute,
  pending,
}: {
  u: AdminModerationUser;
  now: number;
  t: Dict;
  onUnmute: () => void;
  pending: boolean;
}) {
  const until = new Date(u.mutedUntil!).getTime();
  const since = u.mutedSince ? new Date(u.mutedSince).getTime() : until - 60_000;
  const total = Math.max(1, until - since);
  const remaining = Math.max(0, until - now);
  if (remaining <= 0) return null;

  return (
    <li className="grid gap-2 border-b border-white/5 px-4 py-3 sm:grid-cols-[1fr_auto]">
      <div>
        <div className="font-semibold text-fg">{u.displayName}</div>
        <div className="font-mono text-xs text-muted-fg">@{u.username}</div>
        <div className="mt-1 text-sm text-fg-subtle">
          {t.modMutedTeam}:{' '}
          <span style={{ color: u.team?.color ?? undefined }}>{u.team?.name ?? '—'}</span>
        </div>
        <div className="mt-1 text-xs text-muted-fg">
          {t.modMutedSince} {fullTimestamp(u.mutedSince ?? u.mutedUntil!)}
        </div>
        <div className="text-xs text-muted-fg">
          {t.modMutedDuration}: {formatDuration(total)}
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="flex items-center gap-2 rounded-lg bg-accent-amber/10 px-3 py-2 font-mono text-lg tabular-nums text-accent-amber">
          <Timer className="h-4 w-4 shrink-0" />
          {formatDuration(remaining)}
        </div>
        <span className="text-[11px] text-muted-fg">{t.modMutedRemaining}</span>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onUnmute}>
          {t.modUnmuteBtn}
        </Button>
      </div>
    </li>
  );
}

function actionLabel(kind: MuteHistoryEntry['kind'], t: Dict): string {
  const map: Record<MuteHistoryEntry['kind'], string> = {
    mute: t.modHistActionMute,
    unmute: t.modHistActionUnmute,
    ban: t.modHistActionBan,
    unban: t.modHistActionUnban,
    other: t.modHistActionOther,
  };
  return map[kind] ?? kind;
}

function MuteHistoryTable({ entries, t, now }: { entries: MuteHistoryEntry[]; t: Dict; now: number }) {
  return (
    <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
      <thead>
        <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-semibold uppercase tracking-wide text-muted-fg">
          <th className="px-3 py-2.5">{t.modHistColTime}</th>
          <th className="px-3 py-2.5">{t.modHistColUser}</th>
          <th className="px-3 py-2.5">{t.modHistColTeam}</th>
          <th className="px-3 py-2.5">{t.modHistColAction}</th>
          <th className="px-3 py-2.5">{t.modHistColDuration}</th>
          <th className="px-3 py-2.5">{t.modHistColSince}</th>
          <th className="px-3 py-2.5">{t.modHistColUntil}</th>
          <th className="px-3 py-2.5">{t.modHistColBy}</th>
          <th className="px-3 py-2.5">{t.modHistColStatus}</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((row) => {
          const untilMs = row.mutedUntil ? new Date(row.mutedUntil).getTime() : 0;
          const liveActive = row.kind === 'mute' && untilMs > now;
          return (
            <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
              <td className="whitespace-nowrap px-3 py-2.5 text-fg-subtle">{fullTimestamp(row.at)}</td>
              <td className="px-3 py-2.5">
                <div className="font-medium text-fg">{row.displayName}</div>
                <div className="font-mono text-[11px] text-muted-fg">@{row.username}</div>
              </td>
              <td className="px-3 py-2.5 text-fg-subtle">{row.teamName ?? '—'}</td>
              <td className="px-3 py-2.5">
                <span
                  className={
                    row.kind === 'mute'
                      ? 'rounded bg-accent-amber/15 px-1.5 py-0.5 text-accent-amber'
                      : 'rounded bg-white/5 px-1.5 py-0.5 text-fg-subtle'
                  }
                >
                  {actionLabel(row.kind, t)}
                </span>
              </td>
              <td className="px-3 py-2.5 tabular-nums">{row.muteMinutes ?? '—'}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-fg-subtle">
                {row.mutedSince ? fullTimestamp(row.mutedSince) : '—'}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-fg-subtle">
                {row.mutedUntil ? fullTimestamp(row.mutedUntil) : '—'}
              </td>
              <td className="px-3 py-2.5 text-fg-subtle">
                {row.actor ? (
                  <>
                    {row.actor.displayName}
                    <span className="block font-mono text-[11px] text-muted-fg">@{row.actor.username}</span>
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2.5">
                {liveActive ? (
                  <span className="rounded bg-accent-amber/15 px-1.5 py-0.5 text-accent-amber">
                    {t.modHistStatusActive}
                  </span>
                ) : row.status === 'ended' || row.kind === 'unmute' ? (
                  <span className="text-fg-subtle">{t.modHistStatusEnded}</span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function AdminModerationSection() {
  const { t } = useI18n();
  const [panel, setPanel] = React.useState<'search' | 'muted' | 'reports'>('search');
  const [q, setQ] = React.useState('');
  const [applied, setApplied] = React.useState('');
  const [muteMinutes, setMuteMinutes] = React.useState('60');
  const [banMinutes, setBanMinutes] = React.useState<string>('1440');
  const [reason, setReason] = React.useState('');
  const now = useNowTick(panel === 'muted');

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['admin', 'users', applied] as const,
    queryFn: () => adminUsersApi.search(applied || undefined),
    enabled: panel === 'search' && applied.length > 0,
  });

  const {
    data: mutedRaw = [],
    isLoading: mutedLoading,
    refetch: refetchMuted,
  } = useQuery({
    queryKey: ['admin', 'users', 'muted'] as const,
    queryFn: adminUsersApi.listMuted,
    enabled: panel === 'muted',
    refetchInterval: panel === 'muted' ? 15_000 : false,
  });

  const {
    data: history = [],
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['admin', 'users', 'mutes-history'] as const,
    queryFn: adminUsersApi.muteHistory,
    enabled: panel === 'muted',
  });

  const muted = mutedRaw.filter((u) => u.mutedUntil && new Date(u.mutedUntil).getTime() > now);

  const modMut = useMutation({
    mutationFn: (args: { id: string; body: ModerationBody }) => adminUsersApi.setModeration(args.id, args.body),
    onSuccess: () => {
      toast.success(t.modSaved);
      void refetch();
      void refetchMuted();
      void refetchHistory();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  return (
    <div className="admin-page w-full space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
          <ShieldBan className="h-5 w-5 text-accent-rose" />
          {t.adminMenuModeration}
        </h1>
        <p className="mt-1 text-[15px] text-fg-subtle">{t.modLead}</p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={panel === 'search' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPanel('search')}
        >
          {t.modTabSearch}
        </Button>
        <Button
          type="button"
          variant={panel === 'muted' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPanel('muted')}
        >
          {t.modTabMuted}
          {muted.length > 0 ? ` (${muted.length})` : ''}
        </Button>
        <Button
          type="button"
          variant={panel === 'reports' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPanel('reports')}
        >
          <Flag className="mr-1 inline h-3.5 w-3.5" />
          {t.modTabReports}
        </Button>
      </div>

      {panel === 'reports' ? <AdminReportsSection /> : null}

      {panel === 'search' ? (
        <>
          <GlassPanel className="space-y-3 p-6">
            <Label>{t.modSearchLabel}</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-md text-[15px]"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.modSearchPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setApplied(q.trim());
                }}
              />
              <Button type="button" onClick={() => setApplied(q.trim())}>
                <Search className="mr-1 h-4 w-4" />
                {t.modSearchBtn}
              </Button>
            </div>
            <div className="grid gap-3 border-t border-white/5 pt-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1">
                <Label className="text-[11px]">{t.modReasonLabel}</Label>
                <Input
                  className="text-[15px]"
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t.modReasonPlaceholder}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">{t.modBanDuration}</Label>
                <select
                  className="h-10 rounded-md border border-white/10 bg-bg-deep/60 px-2 text-sm text-fg"
                  value={banMinutes}
                  onChange={(e) => setBanMinutes(e.target.value)}
                >
                  {BAN_DURATIONS.map((m) => (
                    <option key={m} value={String(m)}>
                      {formatModerationDuration(m, t)}
                    </option>
                  ))}
                  <option value="">{t.modBanIndefinite}</option>
                </select>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="divide-y divide-border/40 p-0">
            {isLoading ? <div className="p-6 text-fg-subtle">{t.loading}</div> : null}
            {!isLoading && applied && users.length === 0 ? (
              <div className="p-6 text-fg-subtle">{t.modEmpty}</div>
            ) : null}
            {users.map((u) => {
              const mutedActive =
                u.mutedUntil !== null && new Date(u.mutedUntil).getTime() > Date.now();
              return (
                <div key={u.id} className="flex flex-wrap items-start gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-fg">{u.displayName}</div>
                    <div className="font-mono text-xs text-muted-fg">@{u.username}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {u.isBanned ? (
                        <span className="rounded bg-accent-rose/15 px-1.5 py-0.5 text-accent-rose">
                          {t.modBanned}
                          {' · '}
                          {u.bannedUntil
                            ? t.modBannedUntil.replace('{{until}}', new Date(u.bannedUntil).toLocaleString(t.dateLocale))
                            : t.modBanIndefinite}
                          {u.banReason ? ` · ${u.banReason}` : ''}
                        </span>
                      ) : null}
                      {mutedActive ? (
                        <span className="rounded bg-accent-amber/15 px-1.5 py-0.5 text-accent-amber">
                          {t.modMutedUntil} {new Date(u.mutedUntil!).toLocaleString(t.dateLocale)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">{t.modMuteMinutes}</Label>
                      <Input
                        type="number"
                        min={1}
                        className="h-9 w-24"
                        value={muteMinutes}
                        onChange={(e) => setMuteMinutes(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={modMut.isPending}
                      onClick={() =>
                        modMut.mutate({
                          id: u.id,
                          body: { muteMinutes: parseInt(muteMinutes, 10) || 60, reason: reason.trim() || null },
                        })
                      }
                    >
                      {t.modMuteBtn}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={modMut.isPending}
                      onClick={() => modMut.mutate({ id: u.id, body: { mutedUntil: null } })}
                    >
                      {t.modUnmuteBtn}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={u.isBanned ? 'outline' : 'destructive'}
                      disabled={modMut.isPending}
                      onClick={() =>
                        modMut.mutate({
                          id: u.id,
                          body: u.isBanned
                            ? { isBanned: false }
                            : {
                                isBanned: true,
                                banMinutes: banMinutes ? Number(banMinutes) : null,
                                reason: reason.trim() || null,
                              },
                        })
                      }
                    >
                      {u.isBanned ? t.modUnbanBtn : t.modBanBtn}
                    </Button>
                  </div>
                </div>
              );
            })}
          </GlassPanel>
        </>
      ) : (
        <div className="space-y-6">
          <GlassPanel className="p-0">
            <div className="border-b border-white/5 px-4 py-3 text-sm font-semibold text-fg">
              {t.modTabMuted}
            </div>
            {mutedLoading ? <p className="p-6 text-fg-subtle">{t.loading}</p> : null}
            {!mutedLoading && muted.length === 0 ? (
              <p className="p-6 text-fg-subtle">{t.modMutedEmpty}</p>
            ) : (
              <ul>
                {muted.map((u) => (
                  <MutedRow
                    key={u.id}
                    u={u}
                    now={now}
                    t={t}
                    pending={modMut.isPending}
                    onUnmute={() => modMut.mutate({ id: u.id, body: { mutedUntil: null } })}
                  />
                ))}
              </ul>
            )}
          </GlassPanel>

          <GlassPanel className="p-0">
            <div className="border-b border-white/5 px-4 py-3 text-sm font-semibold text-fg">
              {t.modMuteHistoryTitle}
            </div>
            {historyLoading ? <p className="p-6 text-fg-subtle">{t.loading}</p> : null}
            {!historyLoading && history.length === 0 ? (
              <p className="p-6 text-fg-subtle">{t.modMuteHistoryEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <MuteHistoryTable entries={history} t={t} now={now} />
              </div>
            )}
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

