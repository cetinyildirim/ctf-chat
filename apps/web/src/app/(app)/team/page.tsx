'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, Droplet, Flag, ImageIcon, ExternalLink, BarChart3 } from 'lucide-react';
import { teamsApi, serversApi, authApi } from '@/lib/api/endpoints';
import { normalizeSessionUser } from '@/lib/auth/session-normalize';
import { queryKeys } from '@/lib/query/client';
import { useAuthStore } from '@/store/auth';
import { useServerStore } from '@/store/server';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { MetricCard } from '@/components/common/MetricCard';
import { Section } from '@/components/common/Section';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColorPalettePicker } from '@/components/common/ColorPalettePicker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/common/Skeleton';
import { RoleBadge } from '@/components/common/RoleBadge';
import { StatusDot } from '@/components/common/StatusDot';
import { usePresenceStore } from '@/store/presence';
import { useI18n } from '@/components/providers/LocaleProvider';
import { resolveUserAvatarSrc } from '@/lib/branding/user-avatar';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { TeamMark } from '@/components/common/TeamMark';

export default function TeamPage() {
  const me = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { t } = useI18n();
  const qc = useQueryClient();
  const activeServerId = useServerStore((s) => s.activeServerId);
  const { data: myTeam } = useQuery({
    queryKey: queryKeys.serverMyTeam(activeServerId ?? ''),
    queryFn: () => serversApi.getMyTeam(activeServerId!),
    enabled: !!activeServerId,
  });
  const teamId = myTeam?.id;
  const presences = usePresenceStore((s) => s.presences);

  const [name, setName] = React.useState('');
  const [tagline, setTagline] = React.useState('');
  const [color, setColor] = React.useState('#22d3ee');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.team(teamId ?? 'none'),
    queryFn: () => teamsApi.get(teamId!),
    enabled: !!teamId,
    refetchInterval: 30_000,
  });

  const { data: ctfd } = useQuery({
    queryKey: queryKeys.teamCtfd(teamId ?? 'none'),
    queryFn: () => teamsApi.getCtfd(teamId!),
    enabled: !!teamId,
    refetchInterval: 60_000,
    staleTime: 45_000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      teamsApi.createMy({
        serverId: activeServerId!,
        name,
        tagline: tagline || undefined,
        color,
      }),
    onSuccess: async (res) => {
      setUser(normalizeSessionUser(res.me));
      try {
        const refreshed = await authApi.refresh();
        setUser(normalizeSessionUser(refreshed));
      } catch {
        /* session refresh optional */
      }
      toast.success(t.teamCreatedOwnOk);
      void qc.invalidateQueries({ queryKey: queryKeys.channelsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.serverMyTeam(activeServerId!) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const logoMut = useMutation({
    mutationFn: (file: File) => teamsApi.uploadMyLogo(file),
    onSuccess: () => {
      toast.success(t.teamLogoUpload);
      void qc.invalidateQueries({ queryKey: queryKeys.team(teamId!) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const leaveMut = useMutation({
    mutationFn: () => teamsApi.leaveServer(activeServerId!),
    onSuccess: async (me) => {
      setUser(normalizeSessionUser(me));
      try {
        const refreshed = await authApi.refresh();
        setUser(normalizeSessionUser(refreshed));
      } catch {
        /* ignore */
      }
      toast.success(t.teamLeaveSuccess);
      void qc.invalidateQueries({ queryKey: queryKeys.serverMyTeam(activeServerId!) });
      void qc.invalidateQueries({ queryKey: queryKeys.channelsAll });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const clearLogoMut = useMutation({
    mutationFn: () => teamsApi.clearMyLogo(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.team(teamId!) }),
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  if (!activeServerId) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title={t.teamCreateOwnTitle} />
        <div className="p-4 text-sm text-fg-subtle">{t.teamsAdminPickServer}</div>
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title={t.teamCreateOwnTitle} />
        <div className="p-4">
          <GlassPanel className="mx-auto max-w-lg space-y-4 p-6">
            <p className="text-[15px] text-fg-subtle">{t.teamCreateOwnLead}</p>
            <div className="space-y-2">
              <Label>{t.teamFieldName}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t.teamFieldTagline}</Label>
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t.teamFieldColor}</Label>
              <ColorPalettePicker value={color} onChange={setColor} />
            </div>
            <Button
              type="button"
              disabled={createMut.isPending || name.trim().length < 2}
              onClick={() => createMut.mutate()}
            >
              {t.teamCreateOwnSubmit}
            </Button>
          </GlassPanel>
        </div>
      </div>
    );
  }

  const team = data?.team;
  const isCaptain = !!me && !!team && team.captainId === me.id;
  const statsHint =
    data?.scoreboard &&
    t.teamStatsLiveHint
      .replace('{{challenges}}', String(data.scoreboard.totalChallenges))
      .replace('{{teams}}', String(data.scoreboard.totalTeams));

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        title={
          <div className="flex items-center gap-2">
            {team ? <TeamMark team={team} size="sm" /> : null}
            <span>{team?.name ?? t.teamPageTitle}</span>
          </div>
        }
        subtitle={team?.tagline ?? undefined}
        right={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={leaveMut.isPending}
            onClick={() => {
              if (window.confirm(t.teamLeaveConfirm)) leaveMut.mutate();
            }}
          >
            {leaveMut.isPending ? '…' : t.teamLeaveServer}
          </Button>
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {isLoading || !data ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              {isCaptain ? (
                <GlassPanel className="flex flex-wrap items-center gap-4 p-4">
                  <div>
                    <div className="text-sm font-semibold text-fg">{t.teamLogoCaptain}</div>
                    <div className="mt-2">
                      <TeamMark team={data.team} size="md" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>
                          <ImageIcon className="mr-1 h-4 w-4" />
                          {t.teamLogoUpload}
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) logoMut.mutate(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {data.team.logoUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={clearLogoMut.isPending}
                        onClick={() => clearLogoMut.mutate()}
                      >
                        {t.teamLogoRemove}
                      </Button>
                    ) : null}
                  </div>
                </GlassPanel>
              ) : null}

              <GlassPanel className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Section title={t.teamStatsSection} />
                  <Link
                    href="/scoreboard"
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent-cyan hover:underline"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    {t.teamOpenScoreboard}
                  </Link>
                </div>
                {statsHint ? <p className="text-[11px] text-fg-subtle">{statsHint}</p> : null}
                <div className="grid gap-3 sm:grid-cols-4">
                  <MetricCard
                    label={t.teamMetricRank}
                    value={data.team.rank > 0 ? `#${data.team.rank}` : '—'}
                    icon={Trophy}
                    tone="amber"
                  />
                  <MetricCard label={t.teamMetricScore} value={data.team.score} icon={Flag} tone="cyan" />
                  <MetricCard label={t.teamMetricSolves} value={data.team.solveCount} icon={Flag} tone="emerald" />
                  <MetricCard label={t.teamMetricBloods} value={data.team.bloodCount} icon={Droplet} tone="rose" />
                </div>
              </GlassPanel>

              <GlassPanel className="space-y-3 p-4">
                <Section title={t.teamCtfdSection} />
                {!ctfd?.configured ? (
                  <p className="text-sm text-fg-subtle">{t.teamCtfdNotConfigured}</p>
                ) : !ctfd.linked || !ctfd.stats ? (
                  <p className="text-sm text-fg-subtle">{t.teamCtfdNotLinked}</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricCard
                      label={t.teamCtfdPlace}
                      value={ctfd.stats.place != null ? `#${ctfd.stats.place}` : '—'}
                      icon={Trophy}
                      tone="violet"
                    />
                    <MetricCard label={t.teamCtfdScore} value={ctfd.stats.score} icon={Flag} tone="cyan" />
                  </div>
                )}
                {ctfd?.scoreboardUrl ? (
                  <a
                    href={ctfd.scoreboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent-cyan hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t.teamCtfdOpenBoard}
                  </a>
                ) : null}
              </GlassPanel>

              <GlassPanel className="p-4">
                <Section
                  title={`${t.teamRosterTitle} · ${t.teamRosterCount.replace('{{count}}', String(data.members.length))}`}
                />
                <ul className="grid gap-1 sm:grid-cols-2">
                  {data.members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/5"
                    >
                      <div className="relative">
                        <Avatar
                          name={m.displayName}
                          src={resolveUserAvatarSrc(m)}
                          size="md"
                          teamColor={m.team?.color}
                          teamName={m.team?.name}
                        />
                        <span className="absolute -bottom-0.5 -right-0.5">
                          <StatusDot status={presences[m.id]?.status ?? 'OFFLINE'} />
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-fg">{m.displayName}</div>
                        <div className="truncate font-mono text-[11px] text-muted-fg">@{m.username}</div>
                      </div>
                      <RoleBadge role={m.role} />
                    </li>
                  ))}
                </ul>
              </GlassPanel>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
