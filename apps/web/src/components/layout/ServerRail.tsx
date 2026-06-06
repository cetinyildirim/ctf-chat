'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Hash, Plus, ShieldAlert, UserRound, Users } from 'lucide-react';
import { ChannelNotifyMode, Permission, type ChatServer } from '@sydt/shared';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/components/providers/LocaleProvider';
import { useServerStore } from '@/store/server';
import { serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { resolveServerIconSrc } from '@/lib/branding/logo-badges';
import { ServerContextMenu } from '@/components/servers/ServerContextMenu';
import { EditServerMemberDialog } from '@/components/servers/EditServerMemberDialog';
import { ServerSettingsDialog } from '@/components/servers/ServerSettingsDialog';
import { CreateServerDialog } from '@/components/servers/CreateServerDialog';
import { toast } from 'sonner';
import { unwrapApiError } from '@/lib/api/axios';

interface RailItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  match: (path: string) => boolean;
}

function ServerIcon({ server, active }: { server: ChatServer; active: boolean }) {
  const src = resolveServerIconSrc(server);
  return (
    <div
      className={cn(
        'relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border transition-all',
        active
          ? 'border-accent-cyan/50 bg-accent-cyan/10 shadow-glow-cyan'
          : 'border-transparent bg-white/[0.06] hover:rounded-xl hover:bg-white/10',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      {active ? (
        <span className="absolute -left-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-accent-cyan" />
      ) : null}
    </div>
  );
}

export function ServerRail() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const qc = useQueryClient();
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServerId = useServerStore((s) => s.setActiveServerId);

  const [editServer, setEditServer] = React.useState<ChatServer | null>(null);
  const settingsServerId = useServerStore((s) => s.settingsServerId);
  const setSettingsServerId = useServerStore((s) => s.setSettingsServerId);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data: servers = [] } = useQuery({
    queryKey: queryKeys.servers,
    queryFn: serversApi.list,
  });
  const settingsServer = servers.find((s) => s.id === settingsServerId) ?? null;

  const notifyMut = useMutation({
    mutationFn: ({ serverId, mode }: { serverId: string; mode: ChannelNotifyMode }) =>
      serversApi.setNotify(serverId, mode),
    onSuccess: () => toast.success(t.profileSavedToast),
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const deleteServerMut = useMutation({
    mutationFn: (serverId: string) => serversApi.remove(serverId),
    onSuccess: (_, serverId) => {
      void qc.invalidateQueries({ queryKey: queryKeys.servers });
      void qc.invalidateQueries({ queryKey: queryKeys.channelsAll });
      if (activeServerId === serverId) {
        const rest = servers.filter((s) => s.id !== serverId);
        if (rest[0]) setActiveServerId(rest[0].id);
        else setActiveServerId(null);
      }
      setSettingsServerId(null);
      toast.success(t.serverDeleted);
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const inviteMut = useMutation({
    mutationFn: (serverId: string) => serversApi.createInvite(serverId, {}),
    onSuccess: (inv) => {
      void navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.code}`);
      toast.success(t.serverInviteCopied);
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const pickServer = (server: ChatServer) => {
    setActiveServerId(server.id);
    router.push('/');
  };

  const canCreate = !!user?.permissions.includes(Permission.ADMIN_DASHBOARD);

  const navItems: RailItem[] = React.useMemo(
    () => [
      { href: '/friends', label: t.railFriends, icon: UserRound, match: (p) => p.startsWith('/friends') },
      { href: '/team', label: t.railTeam, icon: Users, match: (p) => p.startsWith('/team') },
      {
        href: '/admin',
        label: t.railAdmin,
        icon: ShieldAlert,
        permission: Permission.ADMIN_DASHBOARD,
        match: (p) => p.startsWith('/admin'),
      },
    ],
    [t],
  );

  return (
    <>
      <aside className="hidden h-full min-h-0 w-16 shrink-0 flex-col items-center gap-2 border-r border-white/5 bg-bg-deep/60 py-3 backdrop-blur-md sm:flex">
        <div className="flex max-h-[calc(100%-8rem)] flex-col items-center gap-2 overflow-y-auto px-1">
          {servers.map((server) => (
            <ServerContextMenu
              key={server.id}
              server={server}
              notifyBusy={notifyMut.isPending}
              onSetNotify={(mode) => notifyMut.mutate({ serverId: server.id, mode })}
              onEditAppearance={() => setEditServer(server)}
              onCreateInvite={() => inviteMut.mutate(server.id)}
              onServerSettings={() => setSettingsServerId(server.id)}
              onDeleteServer={() => {
                if (window.confirm(t.serverDeleteConfirm.replace('{{name}}', server.name))) {
                  deleteServerMut.mutate(server.id);
                }
              }}
            >
              <button type="button" onClick={() => pickServer(server)} className="rounded-2xl">
                <ServerIcon server={server} active={activeServerId === server.id} />
              </button>
            </ServerContextMenu>
          ))}

          {canCreate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="grid h-11 w-11 place-items-center rounded-2xl border border-dashed border-white/15 text-fg-subtle hover:border-accent-cyan/40 hover:text-accent-cyan"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{t.serverAdd}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        <div className="my-1 h-px w-8 bg-white/5" />

        <nav className="flex flex-col items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/"
                className={cn(
                  'grid h-11 w-11 place-items-center rounded-xl border transition-all',
                  pathname === '/' || pathname.startsWith('/channels')
                    ? 'border-accent-violet/40 bg-accent-violet/10 text-accent-violet'
                    : 'border-transparent bg-white/[0.03] text-fg-subtle hover:bg-white/8',
                )}
              >
                <Hash className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{t.railChat}</TooltipContent>
          </Tooltip>

          {navItems.map((item) => {
            if (item.permission && !user?.permissions.includes(item.permission)) return null;
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'grid h-11 w-11 place-items-center rounded-xl border transition-all',
                      active
                        ? 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan'
                        : 'border-transparent bg-white/[0.03] text-fg-subtle hover:bg-white/8',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </aside>

      {editServer ? (
        <EditServerMemberDialog server={editServer} open={!!editServer} onOpenChange={(o) => !o && setEditServer(null)} />
      ) : null}
      {settingsServer ? (
        <ServerSettingsDialog
          server={settingsServer}
          open={!!settingsServer}
          onOpenChange={(o) => !o && setSettingsServerId(null)}
          onDeleted={() => setSettingsServerId(null)}
        />
      ) : null}
      <CreateServerDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
