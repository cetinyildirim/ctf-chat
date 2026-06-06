'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi, serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AvatarWithStatus } from '@/components/common/AvatarWithStatus';
import { UserIdentity } from '@/components/common/UserIdentity';
import { useLivePresence } from '@/lib/presence/use-live-presence';
import { useAuthStore } from '@/store/auth';
import { useServerStore } from '@/store/server';
import type { PublicUser } from '@sydt/shared';
import { Section } from '@/components/common/Section';
import { UserProfileTrigger } from '@/components/users/UserProfileTrigger';
import { useI18n } from '@/components/providers/LocaleProvider';

type RoleSection = { roleId: string; name: string; color: string; users: PublicUser[] };

export function RightPanel({ slot }: { slot?: React.ReactNode }) {
  return (
    <aside className="hidden h-full w-72 shrink-0 border-l border-white/5 bg-bg-deep/40 backdrop-blur-md xl:flex xl:flex-col">
      {slot ?? <MembersPanel />}
    </aside>
  );
}

export function MembersPanel() {
  const { t } = useI18n();
  const me = useAuthStore((s) => s.user);
  const activeServerId = useServerStore((s) => s.activeServerId);

  const { data: onlineData } = useQuery({
    queryKey: queryKeys.usersOnline,
    queryFn: usersApi.online,
    refetchInterval: 20_000,
    enabled: !!me,
  });

  const { data: roleData } = useQuery({
    queryKey: queryKeys.serverMemberRoleGroups(activeServerId ?? ''),
    queryFn: () => serversApi.getMemberRoleGroups(activeServerId!),
    enabled: !!me && !!activeServerId,
  });

  const onlineById = React.useMemo(() => {
    const map = new Map<string, PublicUser>();
    for (const u of onlineData?.users ?? []) map.set(u.id, u);
    return map;
  }, [onlineData]);

  const { roleSections, unassigned } = React.useMemo(() => {
    if (!activeServerId || !roleData) {
      return { roleSections: [] as RoleSection[], unassigned: [] as PublicUser[] };
    }
    const out: RoleSection[] = [];
    for (const g of roleData.groups) {
      const users: PublicUser[] = [];
      for (const m of g.members) {
        const live = onlineById.get(m.id);
        if (live) users.push(live);
      }
      users.sort((a, b) => a.displayName.localeCompare(b.displayName));
      if (users.length > 0) {
        out.push({ roleId: g.role.id, name: g.role.name, color: g.role.color, users });
      }
    }
    const loose: PublicUser[] = [];
    for (const m of roleData.unassigned) {
      const live = onlineById.get(m.id);
      if (live) loose.push(live);
    }
    loose.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return { roleSections: out, unassigned: loose };
  }, [activeServerId, roleData, onlineById]);

  if (!activeServerId) {
    return (
      <ScrollArea className="h-full">
        <div className="p-3 text-xs text-muted-fg">{t.adminOverviewNoServer}</div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-3">
        {roleSections.map((sec) => (
          <Section
            key={sec.roleId}
            title={
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: sec.color }} />
                <span style={{ color: sec.color }}>{sec.name}</span>
                <span className="text-muted-fg">· {sec.users.length}</span>
              </span>
            }
          >
            <div className="space-y-1">
              {sec.users.map((u) => (
                <UserRow key={`${sec.roleId}-${u.id}`} user={u} />
              ))}
            </div>
          </Section>
        ))}
        {unassigned.length > 0 ? (
          <Section title={`${t.membersOnlineUnassigned} · ${unassigned.length}`}>
            <div className="space-y-1">
              {unassigned.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
            </div>
          </Section>
        ) : null}
        {roleSections.length === 0 && unassigned.length === 0 ? <Empty /> : null}
      </div>
    </ScrollArea>
  );
}

function UserRow({ user }: { user: PublicUser }) {
  const status = useLivePresence(user.id, 'ONLINE');
  return (
    <UserProfileTrigger userId={user.id} className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/5">
      <AvatarWithStatus
        name={user.displayName}
        src={user.avatarUrl}
        status={status}
        size="sm"
        teamColor={user.team?.color}
      />
      <UserIdentity user={user} className="flex-1" />
    </UserProfileTrigger>
  );
}

function Empty() {
  return <div className="px-2 text-xs text-muted-fg">No one online.</div>;
}
