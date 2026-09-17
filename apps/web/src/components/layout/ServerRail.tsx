'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Hash, LifeBuoy, Plus, ShieldAlert, Trophy, UserRound, Users } from 'lucide-react';
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
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  permission?: Permission;
  match: (path: string) => boolean;
  tone: RailNavTone;
}

type RailNavTone = 'violet' | 'emerald' | 'cyan' | 'amber' | 'rose';

const railNavToneStyles: Record<
  RailNavTone,
  { idle: string; active: string; indicator: string }
> = {
  violet: {
    idle: 'border-accent-violet/25 bg-accent-violet/12 text-accent-violet hover:border-accent-violet/40 hover:bg-accent-violet/18',
    active: 'border-accent-violet/55 bg-accent-violet/22 text-accent-violet shadow-glow-violet',
    indicator: 'bg-accent-violet',
  },
  emerald: {
    idle: 'border-accent-emerald/25 bg-accent-emerald/12 text-accent-emerald hover:border-accent-emerald/40 hover:bg-accent-emerald/18',
    active: 'border-accent-emerald/55 bg-accent-emerald/22 text-accent-emerald shadow-glow-emerald',
    indicator: 'bg-accent-emerald',
  },
  cyan: {
    idle: 'border-accent-cyan/25 bg-accent-cyan/12 text-accent-cyan hover:border-accent-cyan/40 hover:bg-accent-cyan/18',
    active: 'border-accent-cyan/55 bg-accent-cyan/22 text-accent-cyan shadow-glow-cyan',
    indicator: 'bg-accent-cyan',
  },
  amber: {
    idle: 'border-accent-amber/25 bg-accent-amber/12 text-accent-amber hover:border-accent-amber/40 hover:bg-accent-amber/18',
    active: 'border-accent-amber/55 bg-accent-amber/22 text-accent-amber shadow-glow-amber',
    indicator: 'bg-accent-amber',
  },
  rose: {
    idle: 'border-accent-rose/25 bg-accent-rose/12 text-accent-rose hover:border-accent-rose/40 hover:bg-accent-rose/18',
    active: 'border-accent-rose/55 bg-accent-rose/22 text-accent-rose shadow-glow-rose',
    indicator: 'bg-accent-rose',
  },
};

function RailNavLink({
  href,
  label,
  icon: Icon,
  active,
  tone,
}: {
  href: string;
  label: string;
  icon: RailItem['icon'];
  active: boolean;
  tone: RailNavTone;
}) {
  const styles = railNavToneStyles[tone];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className={cn(
            'relative grid h-11 w-11 place-items-center rounded-xl border transition-all',
            active ? styles.active : styles.idle,
          )}
        >
          {active ? (
            <span
              className={cn(
                'absolute -left-3 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full',
                styles.indicator,
              )}
            />
          ) : null}
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
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
      { href: '/friends', label: t.railFriends, icon: UserRound, tone: 'emerald', match: (p) => p.startsWith('/friends') },
      { href: '/team', label: t.railTeam, icon: Users, tone: 'cyan', match: (p) => p.startsWith('/team') },
      { href: '/scoreboard', label: t.railScoreboard, icon: Trophy, tone: 'amber', match: (p) => p.startsWith('/scoreboard') },
      {
        href: '/tickets',
        label: t.railTickets,
        icon: LifeBuoy,
        tone: 'rose',
        permission: Permission.TICKET_VIEW_OWN,
        match: (p) => p.startsWith('/tickets'),
      },
      {
        href: '/admin',
        label: t.railAdmin,
        icon: ShieldAlert,
        tone: 'violet',
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
          <RailNavLink
            href="/"
            label={t.railChat}
            icon={Hash}
            tone="violet"
            active={pathname === '/' || pathname.startsWith('/channels')}
          />

          {navItems.map((item) => {
            if (item.permission && !user?.permissions.includes(item.permission)) return null;
            return (
              <RailNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                tone={item.tone}
                active={item.match(pathname)}
              />
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
