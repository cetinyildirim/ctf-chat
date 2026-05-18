'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePresenceStore } from '@/store/presence';
import { useAuthStore } from '@/store/auth';
import { usersApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';

export function TypingIndicator({ channelId }: { channelId: string }) {
  const me = useAuthStore((s) => s.user);
  const typing = usePresenceStore((s) => s.typingByChannel[channelId]);
  const ids = React.useMemo(() => Array.from(typing ?? []).filter((id) => id !== me?.id), [typing, me?.id]);

  const { data } = useQuery({
    queryKey: queryKeys.usersOnline,
    queryFn: usersApi.online,
  });

  if (ids.length === 0) return <div className="h-5" />;
  const names = ids
    .map((id) => data?.users.find((u) => u.id === id)?.displayName ?? 'Someone')
    .slice(0, 3);

  const summary =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing`
      : `${names[0]}, ${names[1]} and ${ids.length - 2} more are typing`;

  return (
    <div className="pointer-events-none absolute bottom-1 left-4 flex items-center gap-2 text-xs text-fg-subtle">
      <span className="inline-flex gap-0.5">
        <span className="h-1 w-1 animate-bounce rounded-full bg-accent-cyan [animation-delay:-200ms]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-accent-cyan [animation-delay:-100ms]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-accent-cyan" />
      </span>
      <span>{summary}…</span>
    </div>
  );
}
