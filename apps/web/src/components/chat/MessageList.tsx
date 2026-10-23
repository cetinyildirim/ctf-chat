'use client';

import * as React from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/client';
import { useI18n } from '@/components/providers/LocaleProvider';
import type { Message } from '@sydt/shared';
import { messagesApi, serversApi } from '@/lib/api/endpoints';
import { MessageItem } from './MessageItem';
import { TypingIndicator } from './TypingIndicator';
import { SkeletonRows } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';
import { unwrapApiError } from '@/lib/api/axios';
import { useAuthStore } from '@/store/auth';

interface Props {
  channelId: string;
  serverId?: string;
  onReply: (msg: Message) => void;
}

export type MessageListHandle = {
  scrollToMessage: (messageId: string) => void;
};

type ListContext = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
};

const START_INDEX = 1_000_000;

function shouldGroup(prev: Message | undefined, curr: Message): boolean {
  if (!prev) return false;
  if (prev.authorId !== curr.authorId) return false;
  const delta = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return delta < 5 * 60_000;
}

/**
 * Stable scroller: always reserve scrollbar gutter so width (and markdown wrap)
 * does not toggle when overflow appears — that toggle feeds remasure loops.
 */
const Scroller = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function MessageListScroller({ style, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        style={{
          ...style,
          overflowAnchor: 'none',
          overflowY: 'scroll',
          scrollbarGutter: 'stable',
        }}
      />
    );
  },
);

/**
 * Short lists stick to the bottom via flex — without Virtuoso alignToBottom,
 * which remasures scrollTop whenever item heights change (the tremble loop).
 */
const List = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function MessageListRoot({ style, children, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        style={{
          ...style,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          minHeight: '100%',
        }}
      >
        {children}
      </div>
    );
  },
);

function MessageListHeader({ context }: { context?: ListContext }) {
  const hasNextPage = context?.hasNextPage;
  const isFetchingNextPage = context?.isFetchingNextPage;
  const { t } = useI18n();
  return (
    <div className="flex h-10 items-center justify-center px-4 text-center text-xs text-muted-fg">
      {hasNextPage
        ? isFetchingNextPage
          ? t.msgLoadingEarlier
          : t.msgScrollForEarlier
        : t.msgStartOfChannel}
    </div>
  );
}

function MessageListFooter() {
  return <div className="h-6 shrink-0" />;
}

const VIRTUOSO_COMPONENTS = {
  Header: MessageListHeader,
  Footer: MessageListFooter,
  Scroller,
  List,
};

export const MessageList = React.forwardRef<MessageListHandle, Props>(function MessageList(
  { channelId, serverId, onReply },
  forwardedRef,
) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const ref = React.useRef<VirtuosoHandle | null>(null);
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  const [firstItemIndex, setFirstItemIndex] = React.useState(START_INDEX);
  const isAtBottomRef = React.useRef(true);
  const prevIdsRef = React.useRef<string[]>([]);
  const allowOlderLoadRef = React.useRef(false);
  /** Freeze initial bottom index so prepends don't rewrite initialTopMostItemIndex. */
  const initialIndexRef = React.useRef<number | null>(null);
  const lastSeenIdRef = React.useRef<string | null>(null);
  const me = useAuthStore((s) => s.user);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: queryKeys.messages(channelId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => messagesApi.list(channelId, pageParam),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined),
  });

  const { data: serverPerms } = useQuery({
    queryKey: queryKeys.serverMyPermissions(serverId ?? ''),
    queryFn: () => serversApi.myPermissions(serverId!),
    enabled: !!serverId,
    staleTime: 60_000,
  });
  const canModerate = !!serverPerms?.includes('manageMessages');

  const messages = React.useMemo<Message[]>(() => {
    if (!data) return [];
    const all: Message[] = [];
    const pages = [...data.pages].reverse();
    for (const page of pages) {
      for (const m of page.messages) all.push(m);
    }
    const seen = new Set<string>();
    const out: Message[] = [];
    for (const m of all) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    return out;
  }, [data]);

  React.useEffect(() => {
    const prevIds = prevIdsRef.current;
    const nextIds = messages.map((m) => m.id);

    if (prevIds.length > 0 && nextIds.length > prevIds.length) {
      const oldFirst = prevIds[0];
      const newFirst = nextIds[0];
      if (oldFirst && newFirst && oldFirst !== newFirst && nextIds.includes(oldFirst)) {
        const prepended = nextIds.indexOf(oldFirst);
        if (prepended > 0) {
          setFirstItemIndex((idx) => idx - prepended);
        }
      }
    }

    prevIdsRef.current = nextIds;
  }, [messages]);

  React.useEffect(() => {
    setFirstItemIndex(START_INDEX);
    prevIdsRef.current = [];
    isAtBottomRef.current = true;
    allowOlderLoadRef.current = false;
    initialIndexRef.current = null;
    lastSeenIdRef.current = null;
    setHighlightId(null);
  }, [channelId]);

  React.useEffect(() => {
    if (messages.length === 0) return;
    if (initialIndexRef.current === null) {
      initialIndexRef.current = START_INDEX + messages.length - 1;
    }
    allowOlderLoadRef.current = false;
    const timer = window.setTimeout(() => {
      allowOlderLoadRef.current = true;
    }, 800);
    return () => window.clearTimeout(timer);
  }, [channelId, messages.length]);

  // Stick to newest message: always for my own sends; otherwise only if already near bottom.
  React.useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (lastSeenIdRef.current === last.id) return;
    const prevId = lastSeenIdRef.current;
    lastSeenIdRef.current = last.id;
    if (prevId === null) return; // initial hydrate — Virtuoso initialTopMostItemIndex handles it

    const mine = !!me?.id && last.authorId === me.id;
    if (!mine && !isAtBottomRef.current) return;

    const absoluteIndex = firstItemIndex + messages.length - 1;
    const frame = window.requestAnimationFrame(() => {
      ref.current?.scrollToIndex({ index: absoluteIndex, align: 'end', behavior: 'auto' });
      isAtBottomRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [firstItemIndex, me?.id, messages]);

  const handleReact = React.useCallback(async (id: string, emoji: string) => {
    try {
      await messagesApi.react(id, emoji);
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    }
  }, []);

  const handleEdit = React.useCallback(async (id: string, content: string) => {
    try {
      await messagesApi.edit(id, content);
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    }
  }, []);

  const handleDelete = React.useCallback(async (id: string) => {
    try {
      await messagesApi.remove(id);
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    }
  }, []);

  const handlePin = React.useCallback(
    async (id: string) => {
      try {
        await messagesApi.pin(id);
        void qc.invalidateQueries({ queryKey: queryKeys.pins(channelId) });
        if (serverId) void qc.invalidateQueries({ queryKey: queryKeys.serverPinsByCategory(serverId) });
        qc.setQueryData(
          queryKeys.messages(channelId),
          (old: { pages: { messages: Message[] }[]; pageParams: unknown[] } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                messages: page.messages.map((m) => (m.id === id ? { ...m, pinned: true } : m)),
              })),
            };
          },
        );
        toast.success(t.messagePinnedToast);
      } catch (err) {
        toast.error(unwrapApiError(err).message);
      }
    },
    [channelId, qc, serverId, t.messagePinnedToast],
  );

  const scrollToMessage = React.useCallback(
    (messageId: string) => {
      const dataIndex = messages.findIndex((m) => m.id === messageId);
      if (dataIndex < 0) {
        toast.error(t.messageJumpNotFound);
        return;
      }
      ref.current?.scrollToIndex({
        index: firstItemIndex + dataIndex,
        align: 'center',
        behavior: 'smooth',
      });
      setHighlightId(messageId);
      window.setTimeout(() => setHighlightId((cur) => (cur === messageId ? null : cur)), 2500);
    },
    [firstItemIndex, messages, t],
  );

  React.useImperativeHandle(forwardedRef, () => ({ scrollToMessage }), [scrollToMessage]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || messages.length === 0) return;
    const match = window.location.hash.match(/^#message-(.+)$/);
    if (!match?.[1]) return;
    const id = window.setTimeout(() => scrollToMessage(match[1]!), 400);
    return () => window.clearTimeout(id);
  }, [channelId, messages.length, scrollToMessage]);

  const itemContent = React.useCallback(
    (absoluteIndex: number, message: Message) => {
      const dataIndex = absoluteIndex - firstItemIndex;
      return (
        <MessageItem
          message={message}
          grouped={shouldGroup(messages[dataIndex - 1], message)}
          highlighted={highlightId === message.id}
          onReact={(e) => handleReact(message.id, e)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPin={handlePin}
          onReply={() => onReply(message)}
          canModerate={canModerate}
        />
      );
    },
    [canModerate, firstItemIndex, handleDelete, handleEdit, handlePin, handleReact, highlightId, messages, onReply],
  );

  const followOutput = React.useCallback((atBottom: boolean) => {
    if (atBottom) isAtBottomRef.current = true;
    // Follow when Virtuoso says we're at bottom, or we still believe we are
    // (grouped short messages often flip atBottom=false for one frame).
    return atBottom || isAtBottomRef.current ? 'auto' : false;
  }, []);

  const onAtBottomStateChange = React.useCallback((atBottom: boolean) => {
    isAtBottomRef.current = atBottom;
  }, []);

  const onStartReached = React.useCallback(() => {
    if (!allowOlderLoadRef.current) return;
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const listContext = React.useMemo<ListContext>(
    () => ({ hasNextPage: !!hasNextPage, isFetchingNextPage }),
    [hasNextPage, isFetchingNextPage],
  );

  const initialTopMostItemIndex = React.useMemo(() => {
    const index =
      initialIndexRef.current ??
      firstItemIndex + Math.max(0, messages.length - 1);
    return { index, align: 'end' as const };
  }, [firstItemIndex, messages.length]);

  if (isLoading) return <SkeletonRows count={10} />;
  if (isError) {
    return (
      <EmptyState
        icon={MessageSquareWarning}
        title={t.msgLoadFailedTitle}
        description={t.msgLoadFailedDesc}
      />
    );
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareWarning}
        title={t.msgEmptyTitle}
        description={t.msgEmptyDesc}
      />
    );
  }

  return (
    <div className="relative h-full">
      <Virtuoso
        key={channelId}
        ref={ref}
        data={messages}
        firstItemIndex={firstItemIndex}
        computeItemKey={(_, message) => message.id}
        defaultItemHeight={56}
        followOutput={followOutput}
        atBottomThreshold={200}
        atBottomStateChange={onAtBottomStateChange}
        increaseViewportBy={{ top: 200, bottom: 100 }}
        startReached={onStartReached}
        initialTopMostItemIndex={initialTopMostItemIndex}
        components={VIRTUOSO_COMPONENTS}
        context={listContext}
        itemContent={itemContent}
      />
      <TypingIndicator channelId={channelId} />
    </div>
  );
});
