'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Lock,
  ChevronRight,
  Plus,
  Star,
  LayoutList,
  ChevronsUpDown,
  ChevronsDownUp,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { ChannelNotifyMode, type Channel } from '@sydt/shared';
import { ChannelNotifyContextMenu } from '@/components/channels/ChannelNotifyContextMenu';
import { channelsApi, serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useServerStore } from '@/store/server';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useChannelUnreadStore } from '@/store/channel-unread';
import { RoleBadge } from '@/components/common/RoleBadge';
import { Avatar } from '@/components/ui/avatar';
import { StatusDot } from '@/components/common/StatusDot';
import { Skeleton } from '@/components/common/Skeleton';
import { useI18n } from '@/components/providers/LocaleProvider';
import { usePlatformBranding } from '@/components/providers/PlatformBrandingProvider';
import type { Category } from '@sydt/shared';
import { categoryHeaderBadgeDataUrl, channelCategoryBadgeDataUrl } from '@/lib/branding/logo-badges';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { useChannelFavoritesStore, useUserFavorites, type FavoriteKind } from '@/store/channel-favorites';
import { CHANNEL_SIDEBAR_MAX, CHANNEL_SIDEBAR_MIN, useSidebarLayoutStore } from '@/store/sidebar-layout';

const FAVORITE_CHANNELS_GROUP = 'favorite-channels';

export function ChannelSidebar() {
  const pathname = usePathname() ?? '/';
  const params = useParams<{ id?: string }>();
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const branding = usePlatformBranding();
  const channelsDrawerOpen = useUIStore((s) => s.channelsDrawerOpen);
  const setChannelsDrawerOpen = useUIStore((s) => s.setChannelsDrawerOpen);
  const queryClient = useQueryClient();
  const activeServerId = useServerStore((s) => s.activeServerId);
  const sidebarWidth = useSidebarLayoutStore((s) => s.width);
  const sidebarCollapsed = useSidebarLayoutStore((s) => s.collapsed);
  const setSidebarCollapsed = useSidebarLayoutStore((s) => s.setCollapsed);

  const notifyMut = useMutation({
    mutationFn: ({ channelId, mode }: { channelId: string; mode: ChannelNotifyMode }) =>
      channelsApi.setChannelNotify(channelId, mode),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.channelsAll }),
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.channels(activeServerId ?? ''),
    queryFn: () => channelsApi.list(activeServerId!),
    enabled: !!user && !!activeServerId,
    staleTime: 60_000,
  });

  const { data: myTeam } = useQuery({
    queryKey: queryKeys.serverMyTeam(activeServerId ?? ''),
    queryFn: () => serversApi.getMyTeam(activeServerId!),
    enabled: !!user && !!activeServerId,
  });

  const createTeamChannelMut = useMutation({
    mutationFn: (input: { categoryId: string; name: string }) => channelsApi.createTeamChannel(input),
    onSuccess: () => {
      toast.success(t.teamChannelCreatedOk);
      void queryClient.invalidateQueries({ queryKey: queryKeys.channels(activeServerId ?? '') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.channelsAll });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
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

  const visibleCategoryIds = React.useMemo(() => {
    const ids: string[] = [];
    for (const cat of orderedCategories) {
      const list = channelsByCategory.get(cat.id) ?? [];
      if (list.length === 0 && !cat.teamId) continue;
      ids.push(cat.id);
    }
    if ((channelsByCategory.get(null) ?? []).length > 0) ids.push('uncategorized');
    return ids;
  }, [orderedCategories, channelsByCategory]);

  const [collapsedIds, setCollapsedIds] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setCollapsedIds(new Set());
  }, [activeServerId]);

  const favorites = useUserFavorites(user?.id);
  const toggleFavoriteStore = useChannelFavoritesStore((s) => s.toggle);
  const toggleFavorite = (kind: FavoriteKind, id: string) => {
    if (user) toggleFavoriteStore(user.id, kind, id);
  };
  const favoriteCategorySet = React.useMemo(() => new Set(favorites.categories), [favorites.categories]);
  const favoriteChannelSet = React.useMemo(() => new Set(favorites.channels), [favorites.channels]);
  const [sidebarTab, setSidebarTab] = React.useState<'all' | 'favorites'>('all');

  const favoriteCategories = React.useMemo(
    () => orderedCategories.filter((c) => favoriteCategorySet.has(c.id)),
    [orderedCategories, favoriteCategorySet],
  );

  const favoriteLooseChannels = React.useMemo(() => {
    if (!data) return [] as Channel[];
    const catPos = new Map(orderedCategories.map((c, i) => [c.id, i]));
    return data.channels
      .filter((ch) => favoriteChannelSet.has(ch.id) && !(ch.categoryId && favoriteCategorySet.has(ch.categoryId)))
      .sort(
        (a, b) =>
          (catPos.get(a.categoryId ?? '') ?? Number.MAX_SAFE_INTEGER) -
            (catPos.get(b.categoryId ?? '') ?? Number.MAX_SAFE_INTEGER) ||
          a.position - b.position ||
          a.name.localeCompare(b.name),
      );
  }, [data, orderedCategories, favoriteChannelSet, favoriteCategorySet]);

  const favoritesCount = favoriteCategories.length + favoriteLooseChannels.length;

  const expandAllCategories = () => setCollapsedIds(new Set());
  const collapseAllCategories = () => setCollapsedIds(new Set([...visibleCategoryIds, FAVORITE_CHANNELS_GROUP]));
  const toggleCategory = (categoryId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const channelInRoom = pathname.startsWith('/channels/');
  const activeChannelId = channelInRoom ? params.id : null;
  const myTeamId = myTeam?.id ?? null;
  const unreadByChannel = useChannelUnreadStore((s) => s.unreadByChannel);
  const markRead = useChannelUnreadStore((s) => s.markRead);
  const setUnreadUserId = useChannelUnreadStore((s) => s.setUserId);

  React.useEffect(() => {
    setUnreadUserId(user?.id ?? null);
  }, [user?.id, setUnreadUserId]);

  React.useEffect(() => {
    if (activeChannelId) markRead(activeChannelId);
  }, [activeChannelId, markRead]);

  const renderChannel = (channel: Channel) => {
    const meta = channel.categoryId ? categoryMeta.get(channel.categoryId) : null;
    return (
      <ChannelRow
        key={channel.id}
        channel={channel}
        categoryLabel={meta?.name ?? t.uncategorized}
        active={activeChannelId === channel.id}
        unread={!!unreadByChannel[channel.id]}
        favorite={favoriteChannelSet.has(channel.id)}
        onToggleFavorite={() => toggleFavorite('channel', channel.id)}
        notifyBusy={notifyMut.isPending}
        setNotify={(mode) =>
          notifyMut.mutate({ channelId: channel.id, mode }, { onSuccess: () => setChannelsDrawerOpen(false) })
        }
        onPick={() => setChannelsDrawerOpen(false)}
      />
    );
  };

  const renderCategory = (cat: Category) => {
    const list = channelsByCategory.get(cat.id) ?? [];
    if (list.length === 0 && !cat.teamId) return null;
    const canAddTeamChannel = !!cat.teamId && !!myTeamId && cat.teamId === myTeamId;
    return (
      <CategoryGroup
        key={cat.id}
        name={cat.name}
        logoUrl={cat.logoUrl}
        categoryId={cat.id}
        open={!collapsedIds.has(cat.id)}
        onToggle={() => toggleCategory(cat.id)}
        unread={list.some((ch) => !!unreadByChannel[ch.id])}
        favorite={favoriteCategorySet.has(cat.id)}
        onToggleFavorite={() => toggleFavorite('category', cat.id)}
        footer={
          canAddTeamChannel ? (
            <TeamChannelComposer
              busy={createTeamChannelMut.isPending}
              onCreate={(name) => createTeamChannelMut.mutate({ categoryId: cat.id, name })}
            />
          ) : null
        }
      >
        {list.map((channel) => renderChannel(channel))}
      </CategoryGroup>
    );
  };

  const navBody = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 py-3 pl-4 pr-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-muted-fg">{branding.workspaceLabel}</div>
          <div className="truncate font-semibold text-fg">{branding.workspaceTitle}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] uppercase text-fg-subtle">
            {t.liveBadge}
          </span>
          <SidebarIconButton label={t.channelsExpandAll} onClick={expandAllCategories}>
            <ChevronsUpDown className="h-4 w-4" />
          </SidebarIconButton>
          <SidebarIconButton label={t.channelsCollapseAll} onClick={collapseAllCategories}>
            <ChevronsDownUp className="h-4 w-4" />
          </SidebarIconButton>
          <SidebarIconButton
            label={t.channelsSidebarHide}
            onClick={() => setSidebarCollapsed(true)}
            className="hidden lg:grid"
          >
            <PanelLeftClose className="h-4 w-4" />
          </SidebarIconButton>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/5 lg:hidden"
            onClick={() => setChannelsDrawerOpen(false)}
          >
            ×
          </button>
        </div>
      </div>

      {!isLoading ? (
        <div className="shrink-0 border-b border-white/5 px-2 py-2">
          <div
            role="tablist"
            aria-label={t.channelsTabsLabel}
            className="grid grid-cols-2 gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-0.5"
          >
            <SidebarTab active={sidebarTab === 'all'} onClick={() => setSidebarTab('all')}>
              <LayoutList className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.channelsTabAll}</span>
            </SidebarTab>
            <SidebarTab active={sidebarTab === 'favorites'} onClick={() => setSidebarTab('favorites')}>
              <Star className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.channelsTabFavorites}</span>
              {favoritesCount > 0 ? (
                <span className="rounded-full bg-accent-amber/20 px-1.5 text-[10px] font-bold leading-4 text-accent-amber">
                  {favoritesCount}
                </span>
              ) : null}
            </SidebarTab>
          </div>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1 basis-0">
        <nav className="space-y-4 px-2 py-3 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : null}

          {!isLoading && sidebarTab === 'all' ? (
            <>
              {orderedCategories.map((cat) => renderCategory(cat))}
              {(channelsByCategory.get(null) ?? []).length > 0 ? (
                <CategoryGroup
                  name={t.uncategorized}
                  logoUrl={null}
                  categoryId="uncategorized"
                  open={!collapsedIds.has('uncategorized')}
                  onToggle={() => toggleCategory('uncategorized')}
                  unread={channelsByCategory.get(null)!.some((ch) => !!unreadByChannel[ch.id])}
                >
                  {channelsByCategory.get(null)!.map((channel) => renderChannel(channel))}
                </CategoryGroup>
              ) : null}
            </>
          ) : null}

          {!isLoading && sidebarTab === 'favorites' ? (
            favoritesCount === 0 ? (
              <div className="mx-1 rounded-lg border border-dashed border-white/15 px-3 py-6 text-center">
                <Star className="mx-auto mb-2 h-5 w-5 text-accent-amber" />
                <p className="text-[13px] leading-relaxed text-fg-subtle">{t.channelsFavoritesEmpty}</p>
              </div>
            ) : (
              <>
                {favoriteLooseChannels.length > 0 ? (
                  <CategoryGroup
                    name={t.channelsFavoriteChannels}
                    icon={<Star className="h-4 w-4 fill-current text-accent-amber" />}
                    categoryId={FAVORITE_CHANNELS_GROUP}
                    open={!collapsedIds.has(FAVORITE_CHANNELS_GROUP)}
                    onToggle={() => toggleCategory(FAVORITE_CHANNELS_GROUP)}
                    unread={favoriteLooseChannels.some((ch) => !!unreadByChannel[ch.id])}
                  >
                    {favoriteLooseChannels.map((channel) => renderChannel(channel))}
                  </CategoryGroup>
                ) : null}
                {favoriteCategories.map((cat) => renderCategory(cat))}
              </>
            )
          ) : null}
        </nav>
      </ScrollArea>

      <UserCard onNavigate={() => setChannelsDrawerOpen(false)} />
    </>
  );

  const hasUnread = Object.keys(unreadByChannel).length > 0;

  return (
    <div
      className={cn(
        'relative h-full min-h-0 w-0 shrink-0 overflow-hidden',
        sidebarCollapsed ? 'lg:w-11' : 'lg:w-[var(--channel-sidebar-w)]',
      )}
      style={{ '--channel-sidebar-w': `${sidebarWidth}px` } as React.CSSProperties}
    >
      {channelsDrawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          aria-label={t.sidebarClose}
          onClick={() => setChannelsDrawerOpen(false)}
        />
      ) : null}
      {sidebarCollapsed ? (
        <div className="hidden h-full flex-col items-center gap-2 border-r border-white/5 bg-bg-deep/95 py-3 lg:flex">
          <SidebarIconButton label={t.channelsSidebarShow} onClick={() => setSidebarCollapsed(false)} className="relative">
            <PanelLeftOpen className="h-4 w-4" />
            {hasUnread ? (
              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-accent-cyan ring-2 ring-bg-deep" />
            ) : null}
          </SidebarIconButton>
        </div>
      ) : null}
      <aside
        className={cn(
          'flex h-full max-h-svh min-h-0 w-[min(20rem,calc(100vw-3rem))] shrink-0 flex-col overflow-hidden border-r border-white/5 bg-bg-deep/95',
          'fixed inset-y-0 left-0 z-50 transition-transform lg:static lg:z-0 lg:max-h-full lg:w-[var(--channel-sidebar-w)] lg:translate-x-0',
          channelsDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          sidebarCollapsed && 'lg:hidden',
        )}
      >
        {navBody}
        <SidebarResizeHandle />
      </aside>
    </div>
  );
}

function SidebarResizeHandle() {
  const { t } = useI18n();
  const width = useSidebarLayoutStore((s) => s.width);
  const setWidth = useSidebarLayoutStore((s) => s.setWidth);
  const resetWidth = useSidebarLayoutStore((s) => s.resetWidth);
  const [dragging, setDragging] = React.useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    setDragging(true);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: PointerEvent) => setWidth(startWidth + ev.clientX - startX);
    const onUp = () => {
      setDragging(false);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') setWidth(width - 16);
    else if (e.key === 'ArrowRight') setWidth(width + 16);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t.channelsSidebarResize}
      aria-valuemin={CHANNEL_SIDEBAR_MIN}
      aria-valuemax={CHANNEL_SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title={t.channelsSidebarResize}
      onPointerDown={onPointerDown}
      onDoubleClick={resetWidth}
      onKeyDown={onKeyDown}
      className="group/resize absolute inset-y-0 right-0 z-10 hidden w-2 cursor-col-resize lg:block"
    >
      <span
        className={cn(
          'absolute inset-y-0 right-0 w-0.5 transition-colors',
          dragging ? 'bg-accent-cyan' : 'bg-transparent group-hover/resize:bg-accent-cyan/60 group-focus-visible/resize:bg-accent-cyan/60',
        )}
      />
    </div>
  );
}

function SidebarIconButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'grid h-7 w-7 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-white/10 hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  );
}

function SidebarTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold transition-colors',
        active
          ? 'bg-accent-cyan/15 text-accent-cyan shadow-[inset_0_0_0_1px_hsl(var(--accent-cyan)/0.35)]'
          : 'text-fg-subtle hover:bg-white/10 hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

function FavoriteToggle({
  favorite,
  onToggle,
  className,
}: {
  favorite: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const label = favorite ? t.channelsFavoriteRemove : t.channelsFavoriteAdd;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      title={label}
      aria-label={label}
      aria-pressed={favorite}
      className={cn(
        'grid h-7 w-7 shrink-0 place-items-center rounded-md transition-[opacity,colors] hover:bg-white/10 focus-visible:opacity-100',
        favorite ? 'text-accent-amber opacity-100' : 'text-muted-fg opacity-0 hover:text-accent-amber group-hover/fav:opacity-100',
        className,
      )}
    >
      <Star className={cn('h-3.5 w-3.5', favorite && 'fill-current')} />
    </button>
  );
}

function CategoryGroup({
  name,
  logoUrl,
  icon,
  categoryId,
  open,
  onToggle,
  children,
  footer,
  unread = false,
  favorite,
  onToggleFavorite,
}: {
  name: string;
  logoUrl?: string | null;
  icon?: React.ReactNode;
  categoryId: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  unread?: boolean;
  favorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const badge = categoryHeaderBadgeDataUrl(name, categoryId);
  return (
    <div className="space-y-1">
      <div className="group/fav flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          title={name}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 px-2 text-[13px] uppercase tracking-[0.06em] hover:text-fg',
            unread ? 'font-bold text-fg' : 'font-semibold text-muted-fg',
          )}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open ? 'rotate-90' : '')} />
          {icon ? (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-amber/12">{icon}</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl ?? badge} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
          )}
          <span className="min-w-0 truncate">{name}</span>
        </button>
        {onToggleFavorite ? <FavoriteToggle favorite={!!favorite} onToggle={onToggleFavorite} /> : null}
      </div>
      {open ? (
        <div className="space-y-0.5">
          {children}
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function TeamChannelComposer({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (name: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-fg hover:bg-white/5 hover:text-fg"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>{t.teamChannelAdd}</span>
      </button>
    );
  }

  return (
    <form
      className="mt-0.5 space-y-1.5 rounded-md border border-white/10 bg-white/[0.03] p-2"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (trimmed.length < 2 || busy) return;
        onCreate(trimmed);
        setName('');
        setOpen(false);
      }}
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.teamChannelName}
        aria-label={t.teamChannelName}
        className="h-8 text-sm"
      />
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" disabled={busy || name.trim().length < 2} className="h-7 px-2 text-xs">
          {t.teamChannelCreate}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => {
            setOpen(false);
            setName('');
          }}
        >
          ×
        </Button>
      </div>
    </form>
  );
}

function ChannelRow({
  channel,
  categoryLabel,
  active,
  unread,
  favorite,
  onToggleFavorite,
  notifyBusy,
  setNotify,
  onPick,
}: {
  channel: Channel;
  categoryLabel: string;
  active: boolean;
  unread: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
  notifyBusy: boolean;
  setNotify: (m: ChannelNotifyMode) => void;
  onPick: () => void;
}) {
  const { t } = useI18n();

  const fallback = channelCategoryBadgeDataUrl(categoryLabel, channel.categoryId ?? null);
  const src = channel.logoUrl ?? fallback;

  return (
    <ChannelNotifyContextMenu notifyBusy={notifyBusy} onSetNotify={setNotify}>
      <div className="group/fav relative">
        <Link
          href={`/channels/${channel.id}`}
          onClick={onPick}
          title={channel.name}
          className={cn(
            'group flex items-center gap-2 rounded-md py-1.5 pl-2 pr-9 text-[15px] transition-colors',
            active
              ? 'bg-accent-cyan/12 text-fg shadow-[inset_3px_0_0_0_hsl(var(--accent-cyan))]'
              : unread
                ? 'font-bold text-fg hover:bg-white/5'
                : 'font-medium text-fg-subtle hover:bg-white/5 hover:text-fg',
            channel.isLocked && 'opacity-70',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
          <span className={cn('truncate', unread || active ? 'font-bold' : 'font-medium')}>{channel.name}</span>
          <span className="ml-auto flex items-center gap-1">
            {channel.isPrivate ? <Lock className={cn('h-3.5 w-3.5', unread ? 'text-fg/70' : 'text-muted-fg')} /> : null}
            {channel.isLocked ? (
              <span className="rounded bg-accent-rose/15 px-1 py-0.5 text-[9px] uppercase text-accent-rose">
                {t.channelLockedBadge}
              </span>
            ) : null}
          </span>
        </Link>
        <FavoriteToggle
          favorite={favorite}
          onToggle={onToggleFavorite}
          className="absolute right-1 top-1/2 -translate-y-1/2"
        />
      </div>
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
