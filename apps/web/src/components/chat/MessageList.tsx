'use client';

import * as React from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Message } from '@sydt/shared';
import { messagesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { MessageItem } from './MessageItem';
import { TypingIndicator } from './TypingIndicator';
import { SkeletonRows } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';
import { unwrapApiError } from '@/lib/api/axios';

interface Props {
  channelId: string;
  onReply: (msg: Message) => void;
}

function shouldGroup(prev: Message | undefined, curr: Message): boolean {
  if (!prev) return false;
  if (prev.authorId !== curr.authorId) return false;
  const delta = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return delta < 5 * 60_000;
}

export function MessageList({ channelId, onReply }: Props) {
  const ref = React.useRef<VirtuosoHandle | null>(null);
  const atBottomRef = React.useRef(true);

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
      toast.success('Pinned.');
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
}
