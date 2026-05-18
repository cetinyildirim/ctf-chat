'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, ChevronRight } from 'lucide-react';
import { ChannelNotifyMode, type Channel } from '@sydt/shared';
import { ChannelNotifyContextMenu } from '@/components/channels/ChannelNotifyContextMenu';
import { channelsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { RoleBadge } from '@/components/common/RoleBadge';
import { Avatar } from '@/components/ui/avatar';
import { StatusDot } from '@/components/common/StatusDot';
import { Skeleton } from '@/components/common/Skeleton';
import { useI18n } from '@/components/providers/LocaleProvider';
import { usePlatformBranding } from '@/components/providers/PlatformBrandingProvider';
import type { Category } from '@sydt/shared';
import { categoryHeaderBadgeDataUrl, channelCategoryBadgeDataUrl } from '@/lib/branding/logo-badges';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ChannelSidebar() {
  const pathname = usePathname() ?? '/';
  const params = useParams<{ id?: string }>();
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const branding = usePlatformBranding();
  const channelsDrawerOpen = useUIStore((s) => s.channelsDrawerOpen);
  const setChannelsDrawerOpen = useUIStore((s) => s.setChannelsDrawerOpen);
  const queryClient = useQueryClient();

  const notifyMut = useMutation({
    mutationFn: ({ channelId, mode }: { channelId: string; mode: ChannelNotifyMode }) =>
      channelsApi.setChannelNotify(channelId, mode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.channels }),
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.channels,
    queryFn: channelsApi.list,
    enabled: !!user,
    staleTime: 60_000,
  });

  const channelsByCategory = React.useMemo(() => {
    if (!data) return new Map<string | null, Channel[]>();
    const map = new Map<string | null, Channel[]>();
    for (const channel of data.channels) {
      const key = channel.categoryId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(channel);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    return map;
  }, [data]);

  const categoryMeta = React.useMemo(() => {
    const m = new Map<string, { name: string; logoUrl: string | null }>();
    for (const c of data?.categories ?? []) {
      m.set(c.id, { name: c.name, logoUrl: c.logoUrl ?? null });
    }
    return m;
  }, [data?.categories]);

  const orderedCategories = React.useMemo(() => {
    if (!data) return [] as Category[];
    return [...data.categories].sort((a, b) => a.position - b.position);
  }, [data]);

  const channelInRoom = pathname.startsWith('/channels/');
  const activeChannelId = channelInRoom ? params.id : null;

  const navBody = (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-fg">{branding.workspaceLabel}</div>
          <div className="font-semibold text-fg">{branding.workspaceTitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] uppercase text-fg-subtle">
            {t.liveBadge}
          </span>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/5 lg:hidden"
            onClick={() => setChannelsDrawerOpen(false)}
          >
            ×
          </button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 basis-0">
        <nav className="space-y-4 px-2 py-3 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : null}

          {orderedCategories.map((cat) => {
            const list = channelsByCategory.get(cat.id) ?? [];
            if (list.length === 0) return null;
            return (
              <CategoryGroup key={cat.id} name={cat.name} logoUrl={cat.logoUrl} categoryId={cat.id}>
                {list.map((channel) => {
                  const meta = channel.categoryId ? categoryMeta.get(channel.categoryId) : null;
                  const categoryLabel = meta?.name ?? t.uncategorized;
                  return (
                    <ChannelRow
                      key={channel.id}
                      channel={channel}
                      categoryLabel={categoryLabel}
                      active={activeChannelId === channel.id}
                      notifyBusy={notifyMut.isPending}
                      setNotify={(mode) =>
                        notifyMut.mutate({ channelId: channel.id, mode }, { onSuccess: () => setChannelsDrawerOpen(false) })
                      }
                      onPick={() => setChannelsDrawerOpen(false)}
                    />
                  );
                })}
              </CategoryGroup>
            );
          })}

          {channelsByCategory.get(null) && channelsByCategory.get(null)!.length > 0 ? (
            <CategoryGroup name={t.uncategorized} logoUrl={null} categoryId="uncategorized">
              {channelsByCategory.get(null)!.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  categoryLabel={t.uncategorized}
                  active={activeChannelId === channel.id}
                  notifyBusy={notifyMut.isPending}
                  setNotify={(mode) =>
                    notifyMut.mutate({ channelId: channel.id, mode }, { onSuccess: () => setChannelsDrawerOpen(false) })
                  }
                  onPick={() => setChannelsDrawerOpen(false)}
                />
              ))}
            </CategoryGroup>
          ) : null}
        </nav>
      </ScrollArea>

      <UserCard onNavigate={() => setChannelsDrawerOpen(false)} />
    </>
  );

  return (
    <div className="relative h-full min-h-0 w-0 shrink-0 overflow-hidden lg:w-64">
      {channelsDrawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          aria-label="Close sidebar"
          onClick={() => setChannelsDrawerOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          'flex h-full max-h-svh min-h-0 w-[min(20rem,calc(100vw-3rem))] shrink-0 flex-col overflow-hidden border-r border-white/5 bg-bg-deep/95',
          'fixed inset-y-0 left-0 z-50 transition-transform lg:static lg:z-0 lg:max-h-full lg:w-64 lg:translate-x-0',
          channelsDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {navBody}
      </aside>
    </div>
  );
}

function CategoryGroup({
  name,
  logoUrl,
  categoryId,
  children,
}: {
  name: string;
  logoUrl?: string | null;
  categoryId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);
  const badge = categoryHeaderBadgeDataUrl(name, categoryId);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-fg hover:text-fg-subtle"
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 transition-transform',
            open ? 'rotate-90' : '',
          )}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl ?? badge} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
        <span className="min-w-0 truncate">{name}</span>
      </button>
      {open ? <div className="space-y-0.5">{children}</div> : null}
    </div>
  );
}

function ChannelRow({
  channel,
  categoryLabel,
  active,
  notifyBusy,
  setNotify,
  onPick,
}: {
  channel: Channel;
  categoryLabel: string;
  active: boolean;
  notifyBusy: boolean;
  setNotify: (m: ChannelNotifyMode) => void;
  onPick: () => void;
}) {
  const { t } = useI18n();

  const fallback = channelCategoryBadgeDataUrl(categoryLabel, channel.categoryId ?? null);
  const src = channel.logoUrl ?? fallback;

  return (
    <ChannelNotifyContextMenu notifyBusy={notifyBusy} onSetNotify={setNotify}>
      <Link
        href={`/channels/${channel.id}`}
        onClick={onPick}
        className={cn(
          'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          active
            ? 'bg-accent-cyan/10 text-fg shadow-[inset_2px_0_0_0_rgba(34,211,238,0.7)]'
            : 'text-fg-subtle hover:bg-white/5 hover:text-fg',
          channel.isLocked && 'opacity-70',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
        <span className="truncate font-medium">{channel.name}</span>
        <span className="ml-auto flex items-center gap-1">
          {channel.isPrivate ? <Lock className="h-3 w-3 text-muted-fg" /> : null}
          {channel.isLocked ? (
            <span className="rounded bg-accent-rose/15 px-1 py-0.5 text-[9px] uppercase text-accent-rose">
              {t.channelLockedBadge}
            </span>
          ) : null}
        </span>
      </Link>
    </ChannelNotifyContextMenu>
  );
}

function UserCard({ onNavigate }: { onNavigate: () => void }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return (
    <Link
      href="/settings/profile"
      onClick={onNavigate}
      className="flex shrink-0 items-center gap-3 border-t border-white/5 bg-bg-elev/60 px-3 py-3 transition-colors hover:bg-bg-elev/80"
    >
      <div className="relative">
        <Avatar name={user.displayName} src={user.avatarUrl} size="md" />
        <span className="absolute -bottom-0.5 -right-0.5">
          <StatusDot status="ONLINE" />
        </span>
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-semibold text-fg">{user.displayName}</div>
        <div className="flex flex-wrap items-center gap-1.5 truncate text-[11px] text-fg-subtle">
          <RoleBadge role={user.role} />
          {user.team ? (
            <span className="truncate text-fg-subtle" style={{ color: user.team.color }}>
              {user.team.name}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
