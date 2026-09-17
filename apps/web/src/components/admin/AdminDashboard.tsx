'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Permission } from '@sydt/shared';
import {
  LayoutDashboard,
  Settings2,
  ShieldAlert,
  ImageIcon,
  ChevronUp,
  ChevronDown,
  Trash2,
  Users,
  Copy,
  ScrollText,
  ClipboardList,
  Pencil,
  ShieldBan,
  Megaphone,
  Palette,
  FileText,
} from 'lucide-react';
import { ColorPalettePicker } from '@/components/common/ColorPalettePicker';
import { MemberUserSuggest } from '@/components/common/MemberUserSuggest';
import { AdminModerationSection } from '@/components/admin/AdminModerationSection';
import { AdminBrandingSection } from '@/components/admin/AdminBrandingSection';
import { AdminCommsSection } from '@/components/admin/AdminCommsSection';
import { usePlatformBranding } from '@/components/providers/PlatformBrandingProvider';
import { AdminAuditSection } from '@/components/admin/AdminAuditSection';
import { AdminSurveysSection } from '@/components/admin/AdminSurveysSection';
import { AdminPagesSection } from '@/components/admin/AdminPagesSection';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuthStore } from '@/store/auth';
import { channelsApi, serversApi, adminApi, adminTeamsApi, type AdminRuntimeInfo } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useServerStore } from '@/store/server';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { useI18n } from '@/components/providers/LocaleProvider';
import { cn } from '@/lib/utils';
import { AdminServerSwitcher } from '@/components/admin/AdminServerSwitcher';

const VALID_TABS = new Set([
  'overview',
  'system',
  'teams',
  'audit',
  'surveys',
  'pages',
  'moderation',
  'branding',
  'comms',
]);

export function AdminDashboard() {
  const me = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const branding = usePlatformBranding();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab') ?? 'overview';
  const tab = VALID_TABS.has(rawTab) ? rawTab : 'overview';

  const allowed =
    !!me?.permissions.includes(Permission.ADMIN_DASHBOARD) ||
    !!me?.permissions.includes(Permission.CATEGORY_MANAGE) ||
    !!me?.permissions.includes(Permission.CHANNEL_CREATE) ||
    !!me?.permissions.includes(Permission.TEAM_MANAGE);

  const canDash = !!me?.permissions.includes(Permission.ADMIN_DASHBOARD);
  const canTeams = !!me?.permissions.includes(Permission.TEAM_MANAGE);
  const canAudit = !!me?.permissions.includes(Permission.AUDIT_LOG_VIEW);
  const canModerate =
    !!me?.permissions.includes(Permission.USER_BAN) ||
    !!me?.permissions.includes(Permission.USER_MUTE) ||
    !!me?.permissions.includes(Permission.USER_VIEW_ALL);

  const setTab = React.useCallback(
    (next: string) => {
      const u = new URLSearchParams(searchParams.toString());
      u.set('tab', next);
      router.replace(`/admin?${u.toString()}`);
    },
    [router, searchParams],
  );

  React.useEffect(() => {
    if (!allowed) return;
    if (tab === 'system' && !canDash) setTab('overview');
    else if (tab === 'teams' && !canTeams) setTab('overview');
    else if (tab === 'audit' && !canAudit) setTab('overview');
    else if (tab === 'moderation' && !canModerate) setTab('overview');
    else if ((tab === 'branding' || tab === 'comms' || tab === 'pages') && !canDash) setTab('overview');
  }, [allowed, tab, canDash, canTeams, canAudit, canModerate, setTab]);

  if (!allowed) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title={t.railAdmin} />
        <EmptyState icon={ShieldAlert} title={t.importNeedAdmin} description="" />
      </div>
    );
  }

  const nav = [
    { id: 'overview' as const, label: t.adminMenuOverview, icon: LayoutDashboard, show: true },
    { id: 'teams' as const, label: t.adminMenuTeams, icon: Users, show: canTeams },
    { id: 'system' as const, label: t.adminMenuSystem, icon: Settings2, show: canDash },
    { id: 'branding' as const, label: t.adminMenuBranding, icon: Palette, show: canDash },
    { id: 'comms' as const, label: t.adminMenuComms, icon: Megaphone, show: canDash },
    { id: 'surveys' as const, label: t.adminMenuSurveys, icon: ClipboardList, show: canDash },
    { id: 'pages' as const, label: t.adminMenuPages, icon: FileText, show: canDash },
    { id: 'moderation' as const, label: t.adminMenuModeration, icon: ShieldBan, show: canModerate },
    { id: 'audit' as const, label: t.adminMenuAudit, icon: ScrollText, show: canAudit },
  ].filter((x) => x.show);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <TopBar title={branding.adminPanelTitle} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav className="shrink-0 border-b border-white/5 bg-bg-deep/30 px-2 py-3 lg:w-56 lg:border-b-0 lg:border-r lg:px-0 lg:py-4">
          <AdminServerSwitcher />
          <ul className="mt-2 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {nav.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    tab === id
                      ? 'bg-accent-cyan/12 text-fg shadow-glow-cyan/20 border border-accent-cyan/25'
                      : 'border border-transparent text-fg-subtle hover:bg-white/5 hover:text-fg',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === 'overview' ? <OverviewSection /> : null}
          {tab === 'teams' && canTeams ? <TeamsAdminPanel /> : null}
          {tab === 'system' && canDash ? <SystemSection /> : null}
          {tab === 'branding' && canDash ? <AdminBrandingSection /> : null}
          {tab === 'comms' && canDash ? <AdminCommsSection /> : null}
          {tab === 'surveys' && canDash ? <AdminSurveysSection /> : null}
          {tab === 'pages' && canDash ? <AdminPagesSection /> : null}
          {tab === 'moderation' && canModerate ? <AdminModerationSection /> : null}
          {tab === 'audit' && canAudit ? <AdminAuditSection /> : null}
        </div>
      </div>
    </div>
  );
}

function OverviewSection() {
  const { t } = useI18n();
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setSettingsServerId = useServerStore((s) => s.setSettingsServerId);

  const { data: servers = [] } = useQuery({
    queryKey: queryKeys.servers,
    queryFn: serversApi.list,
  });
  const activeServer = servers.find((s) => s.id === activeServerId) ?? servers[0];
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.channels(activeServerId ?? ''),
    queryFn: () => channelsApi.list(activeServerId!),
    enabled: !!activeServerId,
  });
  const catCount = data?.categories.length ?? 0;
  const chCount = data?.channels.length ?? 0;

  return (
    <div className="admin-page w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-fg">{t.adminOverviewHeading}</h1>
        <p className="mt-1 text-sm text-fg-subtle">{t.adminOverviewLeadPlatform}</p>
      </div>

      <GlassPanel className="space-y-4 p-5">
        <p className="text-sm font-medium text-fg">{t.adminOverviewServerBlockTitle}</p>
        <p className="text-sm text-fg-subtle">{t.adminOverviewServerHint}</p>
        {activeServer ? (
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="font-mono text-lg font-bold text-accent-cyan">{isLoading ? '…' : catCount}</div>
              <div className="text-xs text-fg-subtle">{t.structureCategories}</div>
            </div>
            <div>
              <div className="font-mono text-lg font-bold text-accent-violet">{isLoading ? '…' : chCount}</div>
              <div className="text-xs text-fg-subtle">{t.structureChannels}</div>
            </div>
            <Button type="button" size="sm" onClick={() => setSettingsServerId(activeServer.id)}>
              {t.adminOpenServerSettings}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-fg-subtle">{t.adminOverviewNoServer}</p>
        )}
      </GlassPanel>

      <GlassPanel className="p-5 text-sm text-fg-subtle">
        <p className="font-medium text-fg">{t.adminOverviewHintTitle}</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>{t.adminOverviewHintPlatform}</li>
        </ul>
      </GlassPanel>
    </div>
  );
}

export function TeamsAdminPanel({ serverId: serverIdProp }: { serverId?: string | null }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const activeServerId = useServerStore((s) => s.activeServerId);
  const serverId = serverIdProp ?? activeServerId;
  const [name, setName] = React.useState('');
  const [tagline, setTagline] = React.useState('');
  const [color, setColor] = React.useState('#22d3ee');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState({ name: '', tagline: '', color: '' });
  const [addMemberIdByTeam, setAddMemberIdByTeam] = React.useState<Record<string, string>>({});

  const { data: teams = [], isLoading } = useQuery({
    queryKey: queryKeys.adminTeams(serverId ?? ''),
    queryFn: () => adminTeamsApi.list(serverId!),
    enabled: !!serverId,
  });

  const invalidate = React.useCallback(() => {
    if (serverId) void qc.invalidateQueries({ queryKey: queryKeys.adminTeams(serverId) });
  }, [qc, serverId]);

  const { data: members = [], isFetching: membersFetching } = useQuery({
    queryKey: ['admin', 'team-members', expandedId] as const,
    queryFn: () => adminTeamsApi.members(expandedId!),
    enabled: !!expandedId,
    staleTime: 15_000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      adminTeamsApi.create(serverId!, {
        name: name.trim(),
        ...(tagline.trim() ? { tagline: tagline.trim() } : {}),
        ...(/^#[0-9a-fA-F]{6}$/.test(color.trim()) ? { color: color.trim() } : {}),
      }),
    onSuccess: () => {
      setName('');
      setTagline('');
      toast.success(t.teamCreatedOk);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminTeamsApi.remove(id),
    onSuccess: (_, id) => {
      toast.success(t.teamDeletedOk);
      if (expandedId === id) setExpandedId(null);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const regenInviteMut = useMutation({
    mutationFn: (id: string) => adminTeamsApi.regenerateInvite(id),
    onSuccess: async (data) => {
      toast.success(t.teamInviteUpdated);
      try {
        await navigator.clipboard.writeText(data.inviteCode);
        toast.success(t.teamInviteCopied);
      } catch {
        /* clipboard optional */
      }
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const assignMut = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      adminTeamsApi.assignMember(teamId, userId),
    onSuccess: (_, { teamId }) => {
      setAddMemberIdByTeam((m) => ({ ...m, [teamId]: '' }));
      void qc.invalidateQueries({ queryKey: ['admin', 'team-members', teamId] });
      toast.success(t.teamMemberAddedOk);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const removeMut = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      adminTeamsApi.removeMember(teamId, userId),
    onSuccess: (_, { teamId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'team-members', teamId] });
      toast.success(t.teamMemberRemovedOk);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; tagline?: string | null; color?: string } }) =>
      adminTeamsApi.update(id, body),
    onSuccess: () => {
      toast.success(t.teamUpdatedOk);
      setEditingId(null);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const captainMut = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string | null }) =>
      adminTeamsApi.setCaptain(teamId, userId),
    onSuccess: (_, { teamId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'team-members', teamId] });
      toast.success(t.teamCaptainSaved);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const copyInvite = async (teamId: string) => {
    try {
      const inviteCode = await adminTeamsApi.getInvite(teamId);
      await navigator.clipboard.writeText(inviteCode);
      toast.success(t.teamInviteCopied);
    } catch (err) {
      toast.error(unwrapApiError(err).message || t.teamInviteCopyFail);
    }
  };

  if (!serverId) {
    return <p className="text-sm text-fg-subtle">{t.teamsAdminPickServer}</p>;
  }

  if (isLoading) return <div className="text-fg-subtle">{t.loading}</div>;

  return (
    <div className="admin-page w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-fg">{t.adminMenuTeams}</h1>
        <p className="mt-1 text-sm text-fg-subtle">{t.teamsAdminHintServer}</p>
      </div>

      <GlassPanel className="space-y-3 p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{t.teamFieldName}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.teamFieldTagline}</Label>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <ColorPalettePicker value={color} onChange={setColor} label={t.teamFieldColor} />
          </div>
        </div>
        <Button
          type="button"
          disabled={!name.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {createMut.isPending ? '…' : t.teamCreateSubmit}
        </Button>
      </GlassPanel>

      <GlassPanel className="divide-y divide-white/10 p-0">
        {!teams.length ? (
          <div className="p-6 text-sm text-fg-subtle">{t.teamsAdminEmpty}</div>
        ) : null}
        {teams.map((team) => {
          const expanded = expandedId === team.id;
          const editing = editingId === team.id;
          const addMid = addMemberIdByTeam[team.id] ?? '';
          const onCaptainChange = async (teamId: string, value: string) => {
            if (value === '__none') await captainMut.mutateAsync({ teamId, userId: null });
            else await captainMut.mutateAsync({ teamId, userId: value });
          };
          const busyCaptain = captainMut.isPending;

          return (
            <div key={team.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="mt-0.5 h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                <div className="min-w-0 flex-1 space-y-1">
                  {editing ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Input
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        placeholder={t.teamFieldName}
                      />
                      <Input
                        value={editDraft.tagline}
                        onChange={(e) => setEditDraft((d) => ({ ...d, tagline: e.target.value }))}
                        placeholder={t.teamFieldTagline}
                      />
                      <ColorPalettePicker value={editDraft.color} onChange={(c) => setEditDraft((d) => ({ ...d, color: c }))} label={t.teamFieldColor} />
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-fg">{team.name}</span>
                        <span className="text-xs text-muted-fg">
                          {team.memberCount} · {team.slug}
                        </span>
                      </div>
                      {team.tagline ? <p className="text-sm text-fg-subtle">{team.tagline}</p> : null}
                    </>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 px-2"
                      onClick={() => void copyInvite(team.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t.teamInviteCopyBtn}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editing ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!editDraft.name.trim() || updateMut.isPending}
                        onClick={() =>
                          updateMut.mutate({
                            id: team.id,
                            body: {
                              name: editDraft.name.trim(),
                              tagline: editDraft.tagline.trim() || null,
                              ...( /^#[0-9a-fA-F]{6}$/.test(editDraft.color.trim())
                                ? { color: editDraft.color.trim() }
                                : {}),
                            },
                          })
                        }
                      >
                        {t.teamSave}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        {t.teamCancelEdit}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setEditingId(team.id);
                        setEditDraft({
                          name: team.name,
                          tagline: team.tagline ?? '',
                          color: team.color,
                        });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t.teamEdit}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedId((prev) => (prev === team.id ? null : team.id))}
                  >
                    {expanded ? '∧ ' : '> '}
                    {t.teamMembersTitle}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={regenInviteMut.isPending || busyCaptain || removeMut.isPending}
                    onClick={() => regenInviteMut.mutate(team.id)}
                  >
                    {t.teamInviteRegen}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    disabled={deleteMut.isPending || busyCaptain || removeMut.isPending}
                    onClick={() => {
                      if (window.confirm(t.teamConfirmDelete)) deleteMut.mutate(team.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> {t.teamDelete}
                  </Button>
                </div>
              </div>
              {expanded ? (
                <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
                  {membersFetching ? <div className="text-xs text-muted-fg">{t.loading}</div> : null}

                  <div className="flex flex-wrap items-end gap-2">
                    {serverId ? (
                      <MemberUserSuggest
                        serverId={serverId}
                        className="max-w-md flex-1"
                        value={addMid}
                        onChange={(v) =>
                          setAddMemberIdByTeam((m) => ({
                            ...m,
                            [team.id]: v,
                          }))
                        }
                        onPick={(username) =>
                          setAddMemberIdByTeam((m) => ({
                            ...m,
                            [team.id]: username,
                          }))
                        }
                        placeholder={t.teamAddMemberHint}
                      />
                    ) : (
                      <Input
                        placeholder={t.teamAddMemberHint}
                        className="max-w-md"
                        value={addMid}
                        onChange={(e) =>
                          setAddMemberIdByTeam((m) => ({
                            ...m,
                            [team.id]: e.target.value,
                          }))
                        }
                      />
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={!addMid.trim() || assignMut.isPending}
                      onClick={() => assignMut.mutate({ teamId: team.id, userId: addMid.trim() })}
                    >
                      {t.teamAddMemberSubmit}
                    </Button>
                  </div>

                  {!membersFetching ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-fg">{t.teamCaptainLabel}</span>
                      <select
                        className="flex h-9 max-w-[18rem] rounded-md border border-white/10 bg-bg-deep px-2 text-xs text-fg"
                        value={team.captainId ?? '__none'}
                        disabled={busyCaptain || members.length === 0}
                        onChange={(e) => void onCaptainChange(team.id, e.target.value)}
                      >
                        <option value="__none">{t.teamCaptainNone}</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {!membersFetching && members.length === 0 ? (
                      <p className="text-sm text-fg-subtle">{t.teamMembersEmpty}</p>
                    ) : null}
                    {members.map((u) => (
                          <div
                            key={u.id}
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-fg">{u.displayName}</div>
                              <div className="truncate font-mono text-[11px] text-muted-fg">{u.id}</div>
                              {team.captainId === u.id ? (
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-accent-cyan">
                                  {t.teamCaptainBadge}
                                </div>
                              ) : null}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={
                                removeMut.isPending ||
                                busyCaptain ||
                                (team.captainId !== null && u.id === team.captainId)
                              }
                              onClick={() =>
                                removeMut.mutate({ teamId: team.id, userId: u.id })
                              }
                            >
                              {t.teamRemoveMember}
                            </Button>
                          </div>
                        ))}
                  </div>
                  <p className="text-[11px] text-fg-muted">{t.teamCaptainHint}</p>
                </div>
              ) : null}
            </div>
          );
        })}
      </GlassPanel>
    </div>
  );
}

function SystemSection() {
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'runtime'],
    queryFn: adminApi.runtime,
  });
  const { data: sys } = useQuery({
    queryKey: queryKeys.adminSystem,
    queryFn: adminApi.system,
  });

  if (isLoading) return <div className="text-fg-subtle">{t.loading}</div>;
  if (error || !data) return <div className="text-accent-rose">{t.adminSystemLoadError}</div>;

  return (
    <div className="admin-page w-full space-y-6">
      <h1 className="text-xl font-semibold text-fg">{t.adminSystemTitle}</h1>
      <p className="text-[15px] text-fg-subtle">{t.adminSystemLead}</p>

      {sys ? (
        <GlassPanel className="space-y-4 p-6">
          <h2 className="text-sm font-semibold text-fg">{t.adminSystemStats}</h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RuntimeRow label={t.adminStatUsers} value={String(sys.userCount)} />
            <RuntimeRow label={t.adminStatOnline} value={String(sys.onlineUsers)} />
            <RuntimeRow label={t.adminStatBanned} value={String(sys.bannedCount)} />
            <RuntimeRow label={t.adminStatTeams} value={String(sys.teamCount)} />
            <RuntimeRow label={t.adminStatChannels} value={String(sys.channelCount)} />
            <RuntimeRow label={t.adminStatMessages} value={String(sys.messageCount)} />
            <RuntimeRow label={t.adminStatAudit} value={String(sys.auditCount)} />
            <RuntimeRow label={t.adminStatSurveys} value={String(sys.activeSurveys)} />
          </dl>
        </GlassPanel>
      ) : null}

      <UploadMaxPanel initialMb={data.uploadMaxMb} />
      <RegistrationServerPanel />

      <GlassPanel className="space-y-3 p-6">
        <h2 className="text-sm font-semibold text-fg">{t.adminSystemSecurity}</h2>
        <ul className="list-inside list-disc space-y-2 text-[15px] text-fg-subtle">
          <li>{t.adminSecuritySession}</li>
          <li>{t.adminSecurityRbac}</li>
          <li>{t.adminSecurityAudit}</li>
          <li>{t.adminSecurityUpload}</li>
        </ul>
      </GlassPanel>

      <GlassPanel className="space-y-4 p-6">
        <h2 className="text-sm font-semibold text-fg">{t.adminSystemRuntime}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <RuntimeRow label="NODE_ENV" value={data.nodeEnv} />
          <RuntimeRow label={t.adminUploadDir} value={data.uploadDir} />
          <RuntimeRow label={t.adminUploadMax} value={`${data.uploadMaxMb} MB`} />
          <RuntimeRow label={t.adminAccessTtl} value={`${data.accessTokenTtlSec}s`} />
          <RuntimeRow label={t.adminRefreshTtl} value={`${data.refreshTokenTtlSec}s`} />
          <RuntimeRow label={t.adminCookieSecure} value={data.cookieSecure ? 'true' : 'false'} />
          <RuntimeRow label="CORS" value={data.corsOrigin} className="sm:col-span-2" />
        </dl>
      </GlassPanel>

      <GlassPanel className="space-y-3 p-6">
        <h2 className="text-sm font-semibold text-fg">{t.adminSystemOps}</h2>
        <ul className="list-inside list-disc space-y-2 text-sm text-fg-subtle">
          <li>{t.adminSystemOpsRealtime}</li>
          <li>{t.adminSystemOpsRbac}</li>
          <li>{t.adminSystemOpsFiles}</li>
        </ul>
      </GlassPanel>

      <GlassPanel className="space-y-3 border-dashed border-amber-400/30 p-6">
        <div className="flex items-center gap-2 text-amber-200/90">
          <ImageIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{t.adminSystemFuture}</span>
        </div>
        <p className="text-sm text-fg-subtle">{t.adminSystemFutureBody}</p>
      </GlassPanel>
    </div>
  );
}

function UploadMaxPanel({ initialMb }: { initialMb: number }) {
  const { t } = useI18n();
  const [mb, setMb] = React.useState(String(initialMb));
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setMb(String(initialMb));
  }, [initialMb]);

  return (
    <GlassPanel className="space-y-3 p-6">
      <h2 className="text-sm font-semibold text-fg">{t.adminUploadMaxLabel}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          type="number"
          min={1}
          max={500}
          className="h-10 w-28"
          value={mb}
          onChange={(e) => setMb(e.target.value)}
        />
        <Button
          type="button"
          disabled={busy}
          onClick={async () => {
            const n = parseInt(mb, 10);
            if (!Number.isFinite(n) || n < 1) return;
            setBusy(true);
            try {
              const next = await adminApi.setUploadMaxMb(n);
              setMb(String(next));
              toast.success(t.adminUploadMaxSaved);
            } catch (err) {
              toast.error(unwrapApiError(err).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.adminUploadMaxSave}
        </Button>
      </div>
    </GlassPanel>
  );
}

function RegistrationServerPanel() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'registration-settings'],
    queryFn: adminApi.getRegistrationSettings,
  });
  const { data: servers = [] } = useQuery({
    queryKey: [...queryKeys.servers, 'manageable'] as const,
    queryFn: serversApi.listManageable,
  });

  const saveMut = useMutation({
    mutationFn: (defaultRegistrationServerId: string | null) =>
      adminApi.setRegistrationSettings({ defaultRegistrationServerId }),
    onSuccess: () => {
      toast.success(t.adminRegistrationSaved);
      void qc.invalidateQueries({ queryKey: ['admin', 'registration-settings'] });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const selected = settings?.defaultRegistrationServerId ?? '';

  return (
    <GlassPanel className="space-y-3 p-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-fg">{t.adminRegistrationTitle}</h2>
        <p className="text-[13px] text-fg-subtle">{t.adminRegistrationLead}</p>
      </div>
      {isLoading ? (
        <div className="text-sm text-fg-subtle">{t.loading}</div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[16rem] flex-1 space-y-1 text-xs">
            <span className="text-muted-fg">{t.adminRegistrationServer}</span>
            <select
              className="flex h-10 w-full rounded-md border border-white/10 bg-bg-deep px-3 text-sm text-fg outline-none focus:border-accent-cyan/50"
              value={selected}
              disabled={saveMut.isPending}
              onChange={(e) => {
                const value = e.target.value || null;
                saveMut.mutate(value);
              }}
            >
              <option value="">{t.adminRegistrationAuto}</option>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {settings?.effectiveServerName ? (
        <p className="text-[12px] text-muted-fg">
          {t.adminRegistrationEffective.replace('{{name}}', settings.effectiveServerName)}
        </p>
      ) : null}
    </GlassPanel>
  );
}

function RuntimeRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-md border border-white/8 bg-white/[0.03] px-3 py-2', className)}>
      <div className="text-[10px] uppercase tracking-wider text-muted-fg">{label}</div>
      <div className="mt-0.5 break-all font-mono text-xs text-fg">{value}</div>
    </div>
  );
}
