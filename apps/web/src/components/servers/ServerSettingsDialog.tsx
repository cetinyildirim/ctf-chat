'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  Flag,
  FolderTree,
  Hash,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  Smile,
  Trash2,
  Plug,
  Upload,
  Users,
  UserPlus,
  X,
} from 'lucide-react';
import type { ChatServer } from '@sydt/shared';
import { Permission } from '@sydt/shared';
import { serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { resolveServerIconSrc } from '@/lib/branding/logo-badges';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { UserIdentity } from '@/components/common/UserIdentity';
import { fullTimestamp } from '@/lib/format/time';
import { ServerSettingsCategoriesPanel } from '@/components/servers/ServerSettingsCategoriesPanel';
import { ServerSettingsRolesPanel } from '@/components/servers/ServerSettingsRolesPanel';
import { ServerSettingsEmojisPanel } from '@/components/servers/ServerSettingsEmojisPanel';
import { ServerSettingsBannedPanel } from '@/components/servers/ServerSettingsBannedPanel';
import { ServerSettingsIntegrationsPanel } from '@/components/servers/ServerSettingsIntegrationsPanel';
import { ServerSettingsChannelsPanel } from '@/components/servers/ServerSettingsChannelsPanel';
import { ServerSettingsImportPanel } from '@/components/servers/ServerSettingsImportPanel';
import { ServerSettingsTicketsPanel } from '@/components/servers/ServerSettingsTicketsPanel';
import { TeamsAdminPanel } from '@/components/admin/AdminDashboard';
import { ServerSettingsMembersPanel } from '@/components/servers/ServerSettingsMembersPanel';
import { useServerStore } from '@/store/server';
import { Switch } from '@/components/ui/switch';
import { useAuthStore } from '@/store/auth';

type Tab =
  | 'overview'
  | 'categories'
  | 'channels'
  | 'import'
  | 'roles'
  | 'emojis'
  | 'members'
  | 'invites'
  | 'banned'
  | 'teams'
  | 'tickets'
  | 'integrations';

const NAV: { id: Tab; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', icon: LayoutDashboard },
  { id: 'categories', icon: FolderTree },
  { id: 'channels', icon: Hash },
  { id: 'import', icon: Upload },
  { id: 'roles', icon: Flag },
  { id: 'emojis', icon: Smile },
  { id: 'members', icon: Users },
  { id: 'teams', icon: UserPlus },
  { id: 'invites', icon: ClipboardList },
  { id: 'banned', icon: Users },
  { id: 'tickets', icon: LifeBuoy },
  { id: 'integrations', icon: Plug },
];

export function ServerSettingsDialog({
  server: serverProp,
  open,
  onOpenChange,
  onDeleted,
}: {
  server: ChatServer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServerId = useServerStore((s) => s.setActiveServerId);
  const me = useAuthStore((s) => s.user);
  const canManageServer = !!me?.permissions.includes(Permission.ADMIN_DASHBOARD);

  const { data: servers = [] } = useQuery({
    queryKey: queryKeys.servers,
    queryFn: serversApi.list,
    enabled: open,
  });
  const server = servers.find((s) => s.id === serverProp.id) ?? serverProp;

  const [tab, setTab] = React.useState<Tab>('overview');
  const [name, setName] = React.useState(server.name);
  const [description, setDescription] = React.useState(server.description ?? '');
  const [requirePasswordChange, setRequirePasswordChange] = React.useState(
    server.requirePasswordChangeOnJoin ?? false,
  );

  React.useEffect(() => {
    setName(server.name);
    setDescription(server.description ?? '');
    setRequirePasswordChange(server.requirePasswordChangeOnJoin ?? false);
    if (!open) setTab('overview');
  }, [server, open]);

  const saveMut = useMutation({
    mutationFn: () =>
      serversApi.update(server.id, {
        name: name.trim(),
        description,
        requirePasswordChangeOnJoin: requirePasswordChange,
      }),
    onSuccess: () => {
      toast.success(t.profileSavedToast);
      void qc.invalidateQueries({ queryKey: queryKeys.servers });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const pwdPolicyMut = useMutation({
    mutationFn: (value: boolean) =>
      serversApi.update(server.id, { requirePasswordChangeOnJoin: value }),
    onSuccess: () => {
      toast.success(t.profileSavedToast);
      void qc.invalidateQueries({ queryKey: queryKeys.servers });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const deleteMut = useMutation({
    mutationFn: () => serversApi.remove(server.id),
    onSuccess: () => {
      toast.success(t.serverDeleted);
      void qc.invalidateQueries({ queryKey: queryKeys.servers });
      void qc.invalidateQueries({ queryKey: queryKeys.channelsAll });
      if (activeServerId === server.id) {
        const rest = servers.filter((s) => s.id !== server.id);
        if (rest[0]) setActiveServerId(rest[0].id);
      }
      onOpenChange(false);
      onDeleted?.();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const logoRef = React.useRef<HTMLInputElement>(null);
  const logoMut = useMutation({
    mutationFn: (file: File) => serversApi.uploadLogo(server.id, file),
    onSuccess: () => {
      toast.success(t.profileSavedToast);
      void qc.invalidateQueries({ queryKey: queryKeys.servers });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const clearLogoMut = useMutation({
    mutationFn: () => serversApi.clearLogo(server.id),
    onSuccess: () => {
      toast.success(t.profileSavedToast);
      void qc.invalidateQueries({ queryKey: queryKeys.servers });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const { data: invites = [] } = useQuery({
    queryKey: queryKeys.serverInvites(server.id),
    queryFn: () => serversApi.listInvites(server.id),
    enabled: open && tab === 'invites',
  });

  const inviteMut = useMutation({
    mutationFn: () => serversApi.createInvite(server.id, {}),
    onSuccess: (inv) => {
      toast.success(t.serverInviteCreated);
      void navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.code}`);
      void qc.invalidateQueries({ queryKey: queryKeys.serverInvites(server.id) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const revokeInviteMut = useMutation({
    mutationFn: (inviteId: string) => serversApi.deleteInvite(server.id, inviteId),
    onSuccess: () => {
      toast.success(t.serverInviteRevoked);
      void qc.invalidateQueries({ queryKey: queryKeys.serverInvites(server.id) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const iconSrc = resolveServerIconSrc(server);

  const confirmDelete = () => {
    if (!window.confirm(t.serverDeleteConfirm.replace('{{name}}', server.name))) return;
    deleteMut.mutate();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[88] bg-black/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-3 z-[89] flex overflow-hidden rounded-xl border border-white/10 bg-[#1e1f22] shadow-2xl outline-none md:inset-6 lg:inset-8">
          <Dialog.Title className="sr-only">{t.serverSettingsTitle}</Dialog.Title>
          <div className="flex w-56 shrink-0 flex-col border-r border-white/8 bg-[#161719]">
            <div className="border-b border-white/8 px-4 py-3 text-sm font-semibold text-fg">{server.name}</div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
              {NAV.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                    tab === id ? 'bg-white/10 text-fg' : 'text-fg-subtle hover:bg-white/5',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t[`serverTab_${id}` as keyof typeof t] as string}
                </button>
              ))}
            </nav>
            <button
              type="button"
              className="m-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-accent-rose hover:bg-accent-rose/10"
              disabled={deleteMut.isPending}
              onClick={confirmDelete}
            >
              <Trash2 className="h-4 w-4" />
              {t.serverDeleteBtn}
            </button>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
              <h2 className="text-lg font-semibold text-fg">{t[`serverTab_${tab}` as keyof typeof t] as string}</h2>
              <Dialog.Close asChild>
                <button type="button" className="rounded-full border border-white/10 p-2 text-muted-fg hover:bg-white/5">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6 lg:px-10 lg:py-8">
              <div className="mx-auto w-full max-w-7xl">
              {tab === 'overview' ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-6">
                    <div className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={iconSrc} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" />
                      <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) logoMut.mutate(f); }} />
                      <button type="button" className="mt-2 text-xs text-accent-cyan hover:underline" onClick={() => logoRef.current?.click()}>
                        {t.profileAvatarUpload}
                      </button>
                      {server.iconUrl ? (
                        <button type="button" className="mt-1 block w-full text-xs text-muted-fg hover:text-fg" disabled={clearLogoMut.isPending} onClick={() => clearLogoMut.mutate()}>
                          {t.profileAvatarRemove}
                        </button>
                      ) : null}
                      <p className="text-[10px] text-muted-fg">{t.serverLogoMax}</p>
                    </div>
                    <div className="min-w-[12rem] flex-1 space-y-3">
                      <div>
                        <Label className="text-[10px] uppercase text-muted-fg">{t.serverNameLabel}</Label>
                        <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-muted-fg">{t.serverDescLabel}</Label>
                        <Textarea className="mt-1" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t.serverDescPlaceholder} />
                      </div>
                    </div>
                  </div>
                  {canManageServer ? (
                    <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4">
                      <div className="min-w-0 flex-1">
                        <Label htmlFor="require-pwd-change" className="text-sm font-medium text-fg">
                          {t.serverRequirePasswordChange}
                        </Label>
                        <p className="mt-1 text-xs text-fg-subtle">{t.serverRequirePasswordChangeHint}</p>
                      </div>
                      <Switch
                        id="require-pwd-change"
                        checked={requirePasswordChange}
                        disabled={pwdPolicyMut.isPending}
                        onCheckedChange={(checked) => {
                          setRequirePasswordChange(checked);
                          pwdPolicyMut.mutate(checked);
                        }}
                      />
                    </div>
                  ) : null}
                  <Button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                    {t.save}
                  </Button>
                </div>
              ) : null}

              {tab === 'categories' ? <ServerSettingsCategoriesPanel serverId={server.id} /> : null}
              {tab === 'channels' ? <ServerSettingsChannelsPanel serverId={server.id} /> : null}
              {tab === 'import' ? <ServerSettingsImportPanel serverId={server.id} /> : null}
              {tab === 'roles' ? <ServerSettingsRolesPanel serverId={server.id} /> : null}
              {tab === 'emojis' ? <ServerSettingsEmojisPanel serverId={server.id} /> : null}
              {tab === 'banned' ? <ServerSettingsBannedPanel serverId={server.id} /> : null}
              {tab === 'teams' ? <TeamsAdminPanel serverId={server.id} /> : null}
              {tab === 'tickets' ? <ServerSettingsTicketsPanel serverId={server.id} /> : null}
              {tab === 'integrations' ? <ServerSettingsIntegrationsPanel serverId={server.id} /> : null}

              {tab === 'members' ? <ServerSettingsMembersPanel serverId={server.id} /> : null}

              {tab === 'invites' ? (
                <div className="space-y-4">
                  <Button type="button" size="sm" disabled={inviteMut.isPending} onClick={() => inviteMut.mutate()}>
                    {t.serverCreateInvite}
                  </Button>
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-muted-fg">
                      <tr>
                        <th className="py-2">{t.serverInviteCode}</th>
                        <th>{t.serverInviteInviter}</th>
                        <th>{t.serverInviteChannel}</th>
                        <th>{t.serverInviteUses}</th>
                        <th>{t.serverInviteExpires}</th>
                        <th>{t.reportsColDate}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((inv) => (
                        <tr key={inv.id} className="border-t border-white/5">
                          <td className="py-2 font-mono">{inv.code}</td>
                          <td>@{inv.creator.username}</td>
                          <td className="text-muted-fg">{inv.channelName ? `#${inv.channelName}` : '—'}</td>
                          <td className="text-muted-fg">
                            {inv.maxUses != null ? `${inv.uses}/${inv.maxUses}` : inv.uses}
                          </td>
                          <td className="text-muted-fg">
                            {inv.expiresAt ? fullTimestamp(inv.expiresAt) : '—'}
                          </td>
                          <td className="text-muted-fg">{fullTimestamp(inv.createdAt)}</td>
                          <td className="text-right">
                            <Button type="button" size="sm" variant="ghost" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.code}`); toast.success(t.serverInviteCopied); }}>
                              {t.serverInviteCopy}
                            </Button>
                            <Button type="button" size="sm" variant="ghost" className="text-accent-rose" disabled={revokeInviteMut.isPending} onClick={() => revokeInviteMut.mutate(inv.id)}>
                              {t.serverInviteRevoke}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {invites.length === 0 ? <p className="text-sm text-fg-subtle">{t.serverInvitesEmpty}</p> : null}
                </div>
              ) : null}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
