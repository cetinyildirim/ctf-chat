'use client';

import * as React from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/client';
import { useI18n } from '@/components/providers/LocaleProvider';
import type { Message } from '@sydt/shared';
import { messagesApi } from '@/lib/api/endpoints';
import { MessageItem } from './MessageItem';
import { TypingIndicator } from './TypingIndicator';
import { SkeletonRows } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';
import { unwrapApiError } from '@/lib/api/axios';

interface Props {
  channelId: string;
  serverId?: string;
  onReply: (msg: Message) => void;
}

export type MessageListHandle = {
  scrollToMessage: (messageId: string) => void;
};

function shouldGroup(prev: Message | undefined, curr: Message): boolean {
  if (!prev) return false;
  if (prev.authorId !== curr.authorId) return false;
  const delta = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return delta < 5 * 60_000;
}

export const MessageList = React.forwardRef<MessageListHandle, Props>(function MessageList(
  { channelId, serverId, onReply },
  forwardedRef,
) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const ref = React.useRef<VirtuosoHandle | null>(null);
  const atBottomRef = React.useRef(true);
  const [highlightId, setHighlightId] = React.useState<string | null>(null);

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

  const scrollToMessage = React.useCallback(
    (messageId: string) => {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index < 0) {
        toast.error(t.messageJumpNotFound);
        return;
      }
      ref.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
      setHighlightId(messageId);
      window.setTimeout(() => setHighlightId((cur) => (cur === messageId ? null : cur)), 2500);
    },
    [messages, t],
  );

  React.useImperativeHandle(forwardedRef, () => ({ scrollToMessage }), [scrollToMessage]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || messages.length === 0) return;
    const match = window.location.hash.match(/^#message-(.+)$/);
    if (!match?.[1]) return;
    const id = window.setTimeout(() => scrollToMessage(match[1]!), 400);
    return () => window.clearTimeout(id);
  }, [channelId, messages.length, scrollToMessage]);

  const lastIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.id !== lastIdRef.current) {
      lastIdRef.current = last.id;
      if (atBottomRef.current) {
        requestAnimationFrame(() => {
          ref.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
        });
      }
    }
  }, [messages]);

  const handleReact = async (id: string, emoji: string) => {
    try {
      await messagesApi.react(id, emoji);
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    }
  };

  const handleEdit = async (id: string, content: string) => {
    try {
      await messagesApi.edit(id, content);
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await messagesApi.remove(id);
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    }
  };

  const handlePin = async (id: string) => {
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
  };

  if (isLoading) return <SkeletonRows count={10} />;
  if (isError) {
    return (
      <EmptyState
        icon={MessageSquareWarning}
        title="Could not load messages"
        description="Check your connection or try a different channel."
      />
    );
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareWarning}
        title="No messages yet"
        description="Be the first one to break radio silence."
      />
    );
  }

  return (
    <div className="relative h-full">
      <Virtuoso
        ref={ref}
        data={messages}
        followOutput={(isAtBottom) => (isAtBottom ? 'smooth' : false)}
        atBottomStateChange={(b) => {
          atBottomRef.current = b;
        }}
        startReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        initialTopMostItemIndex={Math.max(0, messages.length - 1)}
        components={{
          Header: () => (
            <div className="px-4 py-3 text-center text-xs text-muted-fg">
              {hasNextPage
                ? isFetchingNextPage
                  ? 'Loading earlier messages…'
                  : 'Scroll up to load earlier messages'
                : '— start of channel —'}
            </div>
          ),
          Footer: () => <div className="h-3" />,
        }}
        itemContent={(index, message) => (
          <MessageItem
            message={message}
            grouped={shouldGroup(messages[index - 1], message)}
            highlighted={highlightId === message.id}
            onReact={(e) => handleReact(message.id, e)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPin={handlePin}
            onReply={() => onReply(message)}
          />
        )}
      />
      <TypingIndicator channelId={channelId} />
    </div>
  );
});
