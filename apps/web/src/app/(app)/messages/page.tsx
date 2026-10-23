'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquarePlus, MessagesSquare, Paperclip, Search, X } from 'lucide-react';
import type { Message, PublicUser } from '@sydt/shared';
import { AvatarWithStatus } from '@/components/common/AvatarWithStatus';
import { MemberUserSuggest } from '@/components/common/MemberUserSuggest';
import { MessageList } from '@/components/chat/MessageList';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { UserProfileTrigger } from '@/components/users/UserProfileTrigger';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/providers/LocaleProvider';
import { useAuthStore } from '@/store/auth';
import { useServerStore } from '@/store/server';
import { useNotificationStore } from '@/store/notifications';
import { channelsApi, directApi, type DirectConversation } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { getSocket } from '@/lib/socket/client';
import { directConversationHref } from '@/lib/chat/viewing';
import { useLivePresence } from '@/lib/presence/use-live-presence';
import { smartDate } from '@/lib/format/time';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Filter = 'all' | 'unread';

export default function MessagesPage() {
  return (
    <React.Suspense fallback={null}>
      <MessagesInbox />
    </React.Suspense>
  );
}

function MessagesInbox() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('c');
  const me = useAuthStore((s) => s.user);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const queryClient = useQueryClient();
  const [filter, setFilter] = React.useState<Filter>('all');
  const [search, setSearch] = React.useState('');
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [recipient, setRecipient] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.directConversations,
    queryFn: directApi.conversations,
    enabled: !!me,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const openMut = useMutation({
    mutationFn: (userId: string) => directApi.open(userId),
    onSuccess: (res) => {
      setComposeOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.channelsAll });
      router.push(directConversationHref(res.channel.id));
    },
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  const all = React.useMemo(() => data?.conversations ?? [], [data?.conversations]);
  const conversations = React.useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return all.filter((c) => {
      if (filter === 'unread' && c.unreadCount === 0 && c.channelId !== selectedId) return false;
      if (!q) return true;
      return (
        c.peer.displayName.toLocaleLowerCase().includes(q) ||
        c.peer.username.toLocaleLowerCase().includes(q) ||
        c.lastMessage.preview.toLocaleLowerCase().includes(q)
      );
    });
  }, [all, filter, search, selectedId]);

  if (!me) return null;

  const totalUnread = data?.totalUnread ?? 0;
  const unreadConversations = all.filter((c) => c.unreadCount > 0).length;

  return (
    <div className="flex h-full min-h-0 min-w-0">
      <aside
        className={cn(
          'min-h-0 w-full shrink-0 flex-col border-r border-white/5 bg-bg-deep/40 md:flex md:w-80 xl:w-96',
          selectedId ? 'hidden' : 'flex',
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-fg">{t.dmInboxTitle}</h1>
            <p className="truncate text-xs text-fg-subtle">{t.dmInboxSubtitle}</p>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant={composeOpen ? 'outline' : 'default'}
            onClick={() => setComposeOpen((v) => !v)}
            title={t.dmInboxNew}
            aria-label={t.dmInboxNew}
          >
            {composeOpen ? <X className="h-4 w-4" /> : <MessageSquarePlus className="h-4 w-4" />}
          </Button>
        </div>

        <div className="relative z-20 shrink-0 space-y-2 border-b border-white/5 p-3">
          {composeOpen ? (
            <div className="space-y-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
              <p className="text-xs text-fg-subtle">{t.dmInboxNewLead}</p>
              {activeServerId ? (
                <MemberUserSuggest
                  serverId={activeServerId}
                  className="w-full"
                  value={recipient}
                  onChange={setRecipient}
                  onPick={setRecipient}
                  onSelectUser={(u: PublicUser) => {
                    if (u.id === me.id) return;
                    setRecipient('');
                    openMut.mutate(u.id);
                  }}
                  placeholder={t.dmInboxNewPlaceholder}
                  disabled={openMut.isPending}
                />
              ) : (
                <p className="text-sm text-fg-subtle">{t.adminOverviewNoServer}</p>
              )}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-0.5" role="tablist">
            <FilterTab active={filter === 'all'} onClick={() => setFilter('all')} label={t.dmInboxFilterAll} count={totalUnread} />
            <FilterTab
              active={filter === 'unread'}
              onClick={() => setFilter('unread')}
              label={t.dmInboxFilterUnread}
              count={unreadConversations}
            />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.dmInboxSearch}
              aria-label={t.dmInboxSearch}
              className="h-9 pl-8"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {isLoading ? <p className="p-2 text-sm text-muted-fg">{t.loading}</p> : null}
          {!isLoading && conversations.length === 0 ? (
            <p className="p-4 text-center text-sm text-fg-subtle">
              {search.trim() || filter === 'unread' ? t.dmInboxNoMatch : t.dmInboxEmpty}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {conversations.map((c) => (
              <ConversationRow key={c.channelId} conversation={c} meId={me.id} active={c.channelId === selectedId} />
            ))}
          </ul>
        </div>
      </aside>

      <section className={cn('min-h-0 min-w-0 flex-1 flex-col', selectedId ? 'flex' : 'hidden md:flex')}>
        {selectedId ? (
          <ConversationPane key={selectedId} channelId={selectedId} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <MessagesSquare className="mx-auto mb-3 h-12 w-12 text-muted-fg" />
              <p className="text-sm text-fg-subtle">{t.dmInboxPickConversation}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold transition-colors',
        active ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-fg-subtle hover:bg-white/10 hover:text-fg',
      )}
    >
      <span className="truncate">{label}</span>
      {count > 0 ? <CountBadge count={count} /> : null}
    </button>
  );
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        'flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent-rose px-1 text-[10px] font-bold leading-none text-white',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function ConversationRow({
  conversation: c,
  meId,
  active,
}: {
  conversation: DirectConversation;
  meId: string;
  active: boolean;
}) {
  const { t } = useI18n();
  // Live presence only tracks connected users; the stored status can be stale.
  const status = useLivePresence(c.peer.id, 'OFFLINE');
  const unread = c.unreadCount > 0 && !active;
  const mine = c.lastMessage.authorId === meId;
  const preview = c.lastMessage.preview || (c.lastMessage.attachmentCount > 0 ? t.dmInboxAttachment : '');

  return (
    <li>
      <Link
        href={directConversationHref(c.channelId)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors',
          active
            ? 'bg-accent-cyan/12 shadow-[inset_3px_0_0_0_hsl(var(--accent-cyan))]'
            : unread
              ? 'bg-accent-cyan/[0.06] hover:bg-white/5'
              : 'hover:bg-white/5',
        )}
      >
        <div className="relative shrink-0">
          <AvatarWithStatus name={c.peer.displayName} src={c.peer.avatarUrl} status={status} size="md" />
          {unread ? <CountBadge count={c.unreadCount} className="absolute -right-1.5 -top-1.5 ring-2 ring-bg-deep" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn('truncate text-sm text-fg', unread ? 'font-bold' : 'font-semibold')}>
              {c.peer.displayName}
            </span>
            <span className={cn('ml-auto shrink-0 text-[11px]', unread ? 'font-semibold text-accent-cyan' : 'text-muted-fg')}>
              {smartDate(c.lastMessage.createdAt)}
            </span>
          </div>
          {c.peer.team ? (
            <div className="truncate text-[11px] font-medium" style={{ color: c.peer.team.color }}>
              {c.peer.team.name}
            </div>
          ) : null}
          <p className={cn('truncate text-[13px]', unread ? 'font-medium text-fg' : 'text-fg-subtle')}>
            {mine ? <span className="text-muted-fg">{t.dmInboxYouPrefix} </span> : null}
            {c.lastMessage.attachmentCount > 0 ? <Paperclip className="mr-1 inline h-3 w-3" /> : null}
            {preview}
          </p>
        </div>
      </Link>
    </li>
  );
}

function ConversationPane({ channelId }: { channelId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [replyTo, setReplyTo] = React.useState<Message | null>(null);

  const { data: channel, isLoading, isError } = useQuery({
    queryKey: queryKeys.channel(channelId),
    queryFn: () => channelsApi.get(channelId),
  });
  const peer = channel?.dmPeer ?? null;
  const status = useLivePresence(peer?.id, 'OFFLINE');

  React.useEffect(() => {
    const socket = getSocket();
    const join = () => socket.emit('channel:join', channelId);
    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
    };
  }, [channelId]);

  const isDirect = channel?.type === 'DIRECT_MESSAGE';
  React.useEffect(() => {
    if (!isDirect) return;
    void directApi
      .markRead(channelId)
      .then(() => {
        useNotificationStore.getState().markReadByRef(channelId);
        return queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      })
      .catch(() => undefined);
  }, [isDirect, channelId, queryClient]);

  if (isError || (channel && !isDirect)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-fg-subtle">{t.dmInboxNotFound}</div>
    );
  }
  if (isLoading || !channel) {
    return <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-fg">{t.loading}</div>;
  }

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 border-b border-white/5 bg-bg-deep/40 px-3 py-2.5 md:px-4">
        <Link
          href="/messages"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-white/10 hover:text-fg md:hidden"
          aria-label={t.dmInboxBack}
          title={t.dmInboxBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {peer ? (
          <UserProfileTrigger userId={peer.id} className="flex min-w-0 items-center gap-3 rounded-md px-1 py-0.5 hover:bg-white/5">
            <AvatarWithStatus name={peer.displayName} src={peer.avatarUrl} status={status} size="md" />
            <div className="min-w-0 text-left">
              <div className="truncate font-semibold text-fg">{peer.displayName}</div>
              <div className="truncate text-xs text-fg-subtle">
                @{peer.username}
                {peer.team ? (
                  <span style={{ color: peer.team.color }}> · {peer.team.name}</span>
                ) : null}
              </div>
            </div>
          </UserProfileTrigger>
        ) : (
          <div className="truncate font-semibold text-fg">{channel.name}</div>
        )}
      </header>
      <div className="min-h-0 flex-1">
        <MessageList key={channelId} channelId={channelId} onReply={setReplyTo} />
      </div>
      <MessageComposer channelId={channelId} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
    </>
  );
}
