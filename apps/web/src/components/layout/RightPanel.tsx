'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { StatusDot } from '@/components/common/StatusDot';
import { UserIdentity } from '@/components/common/UserIdentity';
import { useLivePresence } from '@/lib/presence/use-live-presence';
import { useAuthStore } from '@/store/auth';
import type { PublicUser, Role } from '@sydt/shared';
import { ROLE_RANK } from '@sydt/shared';
import { Section } from '@/components/common/Section';
import { UserProfileTrigger } from '@/components/users/UserProfileTrigger';

export function RightPanel({ slot }: { slot?: React.ReactNode }) {
  return (
    <aside className="hidden h-full w-72 shrink-0 border-l border-white/5 bg-bg-deep/40 backdrop-blur-md xl:flex xl:flex-col">
      {slot ?? <MembersPanel />}
    </aside>
  );
}

export function MembersPanel() {
  const me = useAuthStore((s) => s.user);
  const { data } = useQuery({
    queryKey: queryKeys.usersOnline,
    queryFn: usersApi.online,
    refetchInterval: 20_000,
    enabled: !!me,
  });
  const grouped = React.useMemo(() => {
    const users = data?.users ?? [];
    const staff: PublicUser[] = [];
    const others: PublicUser[] = [];
    for (const u of users) {
      if (ROLE_RANK[u.role as Role] >= ROLE_RANK.MODERATOR) staff.push(u);
      else others.push(u);
    }
    const sorter = (a: PublicUser, b: PublicUser) =>
      ROLE_RANK[b.role as Role] - ROLE_RANK[a.role as Role] || a.displayName.localeCompare(b.displayName);
    staff.sort(sorter);
    others.sort(sorter);
    return { staff, others };
  }, [data]);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-3">
        <Section
          title={`Staff online · ${grouped.staff.length}`}
          description="Moderators &amp; organizers reachable now"
        >
          <div className="space-y-1">
            {grouped.staff.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
            {grouped.staff.length === 0 ? <Empty /> : null}
          </div>
        </Section>
        <Section title={`Operators online · ${grouped.others.length}`}>
          <div className="space-y-1">
            {grouped.others.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
            {grouped.others.length === 0 ? <Empty /> : null}
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}

function UserRow({ user }: { user: PublicUser }) {
  const status = useLivePresence(user.id, 'ONLINE');
  return (
    <UserProfileTrigger userId={user.id} className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/5">
      <div className="relative shrink-0">
        <Avatar name={user.displayName} src={user.avatarUrl} size="sm" teamColor={user.team?.color} />
        <span className="absolute -bottom-0.5 -right-0.5">
          <StatusDot status={status} />
        </span>
      </div>
      <UserIdentity user={user} className="flex-1" />
    </UserProfileTrigger>
  );
}

function Empty() {
  return <div className="px-2 text-xs text-muted-fg">No one online.</div>;
}
