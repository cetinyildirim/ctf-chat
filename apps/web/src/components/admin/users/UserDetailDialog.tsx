'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@sydt/shared';
import { KeyRound, LogOut, Plus, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoleBadge, roleLabel } from '@/components/common/RoleBadge';
import { useI18n } from '@/components/providers/LocaleProvider';
import { useAuthStore } from '@/store/auth';
import { adminUserManageApi, type ManagedServer } from '@/lib/api/endpoints';
import { unwrapApiError } from '@/lib/api/axios';
import { fullTimestamp } from '@/lib/format/time';
import {
  ServerRoleSelect,
  StatusBadge,
  TempPasswordBox,
  assignableRoles,
  canManageTarget,
  fill,
  selectClass,
  usersManageKey,
} from './shared';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-white/8 bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

export function UserDetailDialog({
  userId,
  servers,
  onOpenChange,
}: {
  userId: string | null;
  servers: ManagedServer[];
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const actorRole = me?.role as Role | undefined;

  const detailKey = [...usersManageKey, 'detail', userId] as const;
  const { data, isLoading } = useQuery({
    queryKey: detailKey,
    queryFn: () => adminUserManageApi.detail(userId!),
    enabled: !!userId,
  });

  const [profile, setProfile] = React.useState({ displayName: '', username: '', email: '' });
  const [role, setRole] = React.useState<Role | ''>('');
  const [password, setPassword] = React.useState('');
  const [mustChange, setMustChange] = React.useState(true);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);
  const [disableReason, setDisableReason] = React.useState('');
  const [addServerId, setAddServerId] = React.useState('');
  const [addRoleId, setAddRoleId] = React.useState('');

  const user = data?.user;
  React.useEffect(() => {
    if (!user) return;
    setProfile({ displayName: user.displayName, username: user.username, email: user.email });
    setRole(user.role);
  }, [user]);

  React.useEffect(() => {
    setPassword('');
    setTempPassword(null);
    setDisableReason('');
    setAddServerId('');
    setAddRoleId('');
  }, [userId]);

  const refresh = () => void qc.invalidateQueries({ queryKey: usersManageKey });
  const onError = (err: unknown) => toast.error(unwrapApiError(err).message);

  const profileMut = useMutation({
    mutationFn: () => {
      const body: { displayName?: string; username?: string; email?: string } = {};
      if (profile.displayName.trim() !== user!.displayName) body.displayName = profile.displayName.trim();
      if (profile.username.trim().toLowerCase() !== user!.username) body.username = profile.username.trim();
      if (profile.email.trim().toLowerCase() !== user!.email) body.email = profile.email.trim();
      return adminUserManageApi.updateProfile(user!.id, body);
    },
    onSuccess: () => {
      toast.success(t.umProfileSaved);
      refresh();
    },
    onError,
  });

  const roleMut = useMutation({
    mutationFn: (next: Role) => adminUserManageApi.setRole(user!.id, next),
    onSuccess: () => {
      toast.success(t.umRoleSaved);
      refresh();
    },
    onError,
  });

  const setPasswordMut = useMutation({
    mutationFn: () => adminUserManageApi.setPassword(user!.id, password, mustChange),
    onSuccess: () => {
      setPassword('');
      toast.success(t.umPasswordSetOk);
      refresh();
    },
    onError,
  });

  const resetPasswordMut = useMutation({
    mutationFn: () => adminUserManageApi.resetPassword(user!.id),
    onSuccess: (pwd) => {
      setTempPassword(pwd);
      refresh();
    },
    onError,
  });

  const statusMut = useMutation({
    mutationFn: (disabled: boolean) => adminUserManageApi.setDisabled(user!.id, disabled, disableReason.trim() || null),
    onSuccess: (_, disabled) => {
      toast.success(disabled ? t.umDisabledOk : t.umEnabledOk);
      setDisableReason('');
      refresh();
    },
    onError,
  });

  const revokeMut = useMutation({
    mutationFn: () => adminUserManageApi.revokeSessions(user!.id),
    onSuccess: () => {
      toast.success(t.umSessionsRevoked);
      refresh();
    },
    onError,
  });

  const addServerMut = useMutation({
    mutationFn: () => adminUserManageApi.addToServer(user!.id, addServerId, addRoleId || null),
    onSuccess: () => {
      toast.success(t.umServerAdded);
      setAddServerId('');
      setAddRoleId('');
      refresh();
    },
    onError,
  });

  const removeServerMut = useMutation({
    mutationFn: (serverId: string) => adminUserManageApi.removeFromServer(user!.id, serverId),
    onSuccess: () => {
      toast.success(t.umServerRemoved);
      refresh();
    },
    onError,
  });

  const isSelf = !!user && user.id === me?.id;
  const manageable = !!user && canManageTarget(actorRole, user.role, isSelf);
  const roles = assignableRoles(actorRole);
  const profileDirty =
    !!user &&
    (profile.displayName.trim() !== user.displayName ||
      profile.username.trim().toLowerCase() !== user.username ||
      profile.email.trim().toLowerCase() !== user.email);
  const memberServerIds = new Set(data?.servers.map((s) => s.serverId) ?? []);
  const addableServers = servers.filter((s) => !memberServerIds.has(s.id));

  return (
    <Dialog open={!!userId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.umDetailTitle}</DialogTitle>
          {user ? (
            <DialogDescription className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-fg">{user.displayName}</span>
              <span className="font-mono text-xs">@{user.username}</span>
              <RoleBadge role={user.role} />
              {user.disabledAt ? <StatusBadge tone="rose">{t.umStatusDisabled}</StatusBadge> : null}
              {user.isBanned ? <StatusBadge tone="rose">{t.umStatusBanned}</StatusBadge> : null}
              {user.mustChangePassword ? <StatusBadge tone="amber">{t.umStatusMustChange}</StatusBadge> : null}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {isLoading || !user ? (
          <div className="text-sm text-fg-subtle">{t.loading}</div>
        ) : (
          <div className="space-y-4">
            {!manageable ? (
              <p className="rounded-md border border-accent-rose/30 bg-accent-rose/10 p-3 text-xs text-accent-rose">
                {t.umTooHighNote}
              </p>
            ) : null}
            {isSelf ? <p className="text-xs text-fg-subtle">{t.umSelfNote}</p> : null}

            <Section title={t.umSectionProfile}>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{t.umFieldDisplayName}</Label>
                  <Input
                    value={profile.displayName}
                    disabled={!manageable}
                    onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.umFieldUsername}</Label>
                  <Input
                    value={profile.username}
                    disabled={!manageable}
                    onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.umFieldEmail}</Label>
                  <Input
                    type="email"
                    value={profile.email}
                    disabled={!manageable}
                    onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!manageable || !profileDirty || profileMut.isPending}
                onClick={() => profileMut.mutate()}
              >
                {t.umSave}
              </Button>

              <div className="space-y-1.5 border-t border-white/8 pt-3">
                <Label>{t.umFieldRole}</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={`${selectClass} max-w-xs`}
                    value={role}
                    disabled={!manageable || isSelf || roleMut.isPending}
                    onChange={(e) => setRole(e.target.value as Role)}
                  >
                    {!roles.includes(user.role) ? <option value={user.role}>{roleLabel(user.role, t)}</option> : null}
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r, t)}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!manageable || isSelf || !role || role === user.role || roleMut.isPending}
                    onClick={() => role && roleMut.mutate(role)}
                  >
                    {t.umSave}
                  </Button>
                </div>
                <p className="text-[11px] text-fg-muted">{t.umRoleHint}</p>
              </div>
            </Section>

            <Section title={t.umSectionPassword}>
              {tempPassword ? <TempPasswordBox password={tempPassword} /> : null}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[14rem] flex-1 space-y-1.5">
                  <Label>{t.umPasswordNew}</Label>
                  <Input
                    type="text"
                    autoComplete="new-password"
                    value={password}
                    disabled={!manageable}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  disabled={!manageable || password.length < 8 || setPasswordMut.isPending}
                  onClick={() => setPasswordMut.mutate()}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {t.umPasswordSet}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-xs text-fg-subtle">
                <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
                {t.umPasswordMustChange}
              </label>
              <p className="text-[11px] text-fg-muted">{t.umPasswordRule}</p>
              <div className="border-t border-white/8 pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!manageable || resetPasswordMut.isPending}
                  onClick={() => {
                    if (window.confirm(t.umPasswordResetConfirm)) resetPasswordMut.mutate();
                  }}
                >
                  {t.umPasswordReset}
                </Button>
              </div>
            </Section>

            <Section title={t.umSectionAccount}>
              <dl className="grid gap-2 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-muted-fg">{t.umCreatedAt}</dt>
                  <dd className="text-fg">{fullTimestamp(user.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-fg">{t.umLastSeen}</dt>
                  <dd className="text-fg">{user.lastSeenAt ? fullTimestamp(user.lastSeenAt) : t.umNever}</dd>
                </div>
                <div>
                  <dt className="text-muted-fg">{t.umActiveSessions}</dt>
                  <dd className="text-fg">{data.activeSessions}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!manageable || revokeMut.isPending}
                  onClick={() => revokeMut.mutate()}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t.umRevokeSessions}
                </Button>
              </div>
              <div className="space-y-2 border-t border-white/8 pt-3">
                {user.disabledAt ? (
                  <>
                    <p className="text-xs text-accent-rose">
                      {fill(t.umDisabledSince, { date: fullTimestamp(user.disabledAt) })}
                      {user.disabledReason ? ` — ${user.disabledReason}` : ''}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={!manageable || isSelf || statusMut.isPending}
                      onClick={() => statusMut.mutate(false)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {t.umEnable}
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-wrap items-end gap-2">
                    <Input
                      className="min-w-[14rem] flex-1"
                      placeholder={t.umDisableReason}
                      value={disableReason}
                      disabled={!manageable || isSelf}
                      onChange={(e) => setDisableReason(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      disabled={!manageable || isSelf || statusMut.isPending}
                      onClick={() => {
                        if (window.confirm(t.umDisableConfirm)) statusMut.mutate(true);
                      }}
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                      {t.umDisable}
                    </Button>
                  </div>
                )}
              </div>
            </Section>

            <Section title={t.umSectionServers}>
              {data.servers.length === 0 ? <p className="text-xs text-fg-subtle">{t.umNoServers}</p> : null}
              <ul className="space-y-2">
                {data.servers.map((s) => (
                  <li
                    key={s.serverId}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-fg">{s.name}</span>
                        {s.bannedAt ? <StatusBadge tone="rose">{t.umServerBanned}</StatusBadge> : null}
                        {s.team ? (
                          <span className="text-xs" style={{ color: s.team.color }}>
                            {s.team.name}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.roles.map((r) => (
                          <span
                            key={r.id}
                            className="rounded border px-1.5 py-0.5 text-[10px]"
                            style={{ borderColor: `${r.color}66`, color: r.color }}
                          >
                            {r.name}
                          </span>
                        ))}
                        <span className="text-[11px] text-muted-fg">
                          {fill(t.umServerJoined, { date: fullTimestamp(s.joinedAt) })}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-accent-rose"
                      disabled={!manageable || removeServerMut.isPending}
                      onClick={() => {
                        if (window.confirm(fill(t.umServerRemoveConfirm, { name: s.name }))) {
                          removeServerMut.mutate(s.serverId);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t.umServerRemove}
                    </Button>
                  </li>
                ))}
              </ul>
              {addableServers.length > 0 ? (
                <div className="grid gap-2 border-t border-white/8 pt-3 sm:grid-cols-[1fr_1fr_auto]">
                  <select
                    className={selectClass}
                    value={addServerId}
                    disabled={!manageable}
                    onChange={(e) => {
                      setAddServerId(e.target.value);
                      setAddRoleId('');
                    }}
                  >
                    <option value="">{t.umPickServer}</option>
                    {addableServers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <ServerRoleSelect
                    server={servers.find((s) => s.id === addServerId)}
                    value={addRoleId}
                    onChange={setAddRoleId}
                    emptyLabel={t.umDefaultRole}
                    disabled={!manageable}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 gap-1.5"
                    disabled={!manageable || !addServerId || addServerMut.isPending}
                    onClick={() => addServerMut.mutate()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t.umServerAdd}
                  </Button>
                </div>
              ) : null}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
