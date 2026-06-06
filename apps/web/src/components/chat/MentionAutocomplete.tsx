'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PublicUser } from '@sydt/shared';
import { Avatar } from '@/components/ui/avatar';
import { messagesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { cn } from '@/lib/utils';

export type MentionRange = { start: number; query: string };

export function getMentionRange(text: string, caret: number): MentionRange | null {
  const before = text.slice(0, caret);
  const match = before.match(/@([a-z0-9_.-]*)$/i);
  if (!match) return null;
  return { start: caret - match[0].length, query: match[1] ?? '' };
}

export function MentionAutocomplete({
  channelId,
  range,
  activeIndex,
  onPick,
  onCountChange,
}: {
  channelId: string;
  range: MentionRange;
  activeIndex: number;
  onPick: (user: PublicUser) => void;
  onCountChange?: (count: number) => void;
}) {
  const { data: users = [], isFetching } = useQuery({
    queryKey: queryKeys.channelMentionSuggest(channelId, range.query),
    queryFn: () => messagesApi.mentionSuggest(channelId, range.query),
    enabled: !!channelId,
    staleTime: 10_000,
  });

  React.useEffect(() => {
    onCountChange?.(users.length);
  }, [users.length, onCountChange]);

  if (isFetching && users.length === 0) {
    return (
      <div className="absolute bottom-full left-0 z-30 mb-1 w-64 rounded-lg border border-white/10 bg-[#1e1f22] p-2 text-xs text-muted-fg shadow-xl">
        …
      </div>
    );
  }

  if (users.length === 0) return null;

  return (
    <ul className="absolute bottom-full left-0 z-30 mb-1 max-h-48 w-72 overflow-y-auto rounded-lg border border-white/10 bg-[#1e1f22] py-1 shadow-xl">
      {users.map((u, i) => (
        <li key={u.id}>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
              i === activeIndex ? 'bg-accent-cyan/15 text-fg' : 'text-fg-subtle hover:bg-white/8',
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(u)}
          >
            <Avatar name={u.displayName} src={u.avatarUrl} size="sm" teamColor={u.team?.color} />
            <span className="min-w-0 truncate">
              <span className="font-medium text-fg">{u.displayName}</span>
              <span className="ml-1.5 font-mono text-xs text-muted-fg">@{u.username}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
