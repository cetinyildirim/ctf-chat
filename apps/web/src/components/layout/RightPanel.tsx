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
import { isStaff, type PublicUser } from '@sydt/shared';
import { UserProfileTrigger } from '@/components/users/UserProfileTrigger';
import { useI18n } from '@/components/providers/LocaleProvider';
import { cn } from '@/lib/utils';

type TeamSection = { key: string; name: string; color: string | null; logoUrl: string | null; users: PublicUser[] };

export function RightPanel({ slot }: { slot?: React.ReactNode }) {
  return (
    <aside className="hidden h-full min-h-0 w-72 shrink-0 overflow-hidden border-l border-white/5 bg-bg-deep/40 backdrop-blur-md xl:flex xl:flex-col">
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

  const teamSections = React.useMemo(() => {
    if (!activeServerId || !roleData) return [] as TeamSection[];
    const seen = new Set<string>();
    const online: PublicUser[] = [];
    for (const m of [...roleData.groups.flatMap((g) => g.members), ...roleData.unassigned]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      const live = onlineById.get(m.id);
      if (live) online.push(live);
    }

    const teams = new Map<string, TeamSection>();
    const staff: PublicUser[] = [];
    const noTeam: PublicUser[] = [];
    for (const u of online) {
      if (u.team) {
        let sec = teams.get(u.team.id);
        if (!sec) {
          sec = { key: u.team.id, name: u.team.name, color: u.team.color, logoUrl: u.team.logoUrl ?? null, users: [] };
          teams.set(u.team.id, sec);
        }
        sec.users.push(u);
      } else if (isStaff(u.role)) {
        staff.push(u);
      } else {
        noTeam.push(u);
      }
    }

    const byName = (a: PublicUser, b: PublicUser) => a.displayName.localeCompare(b.displayName);
    const out = [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));
    if (staff.length > 0) out.unshift({ key: 'staff', name: t.membersGroupStaff, color: null, logoUrl: null, users: staff });
    if (noTeam.length > 0) out.push({ key: 'no-team', name: t.membersGroupNoTeam, color: null, logoUrl: null, users: noTeam });
    for (const sec of out) sec.users.sort(byName);
    return out;
  }, [activeServerId, roleData, onlineById, t.membersGroupStaff, t.membersGroupNoTeam]);

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
        {teamSections.map((sec) => (
          <section key={sec.key} className="space-y-1.5">
            <TeamHeader section={sec} />
            <div className="space-y-0.5">
              {sec.users.map((u) => (
                <UserRow key={`${sec.key}-${u.id}`} user={u} />
              ))}
            </div>
          </section>
        ))}
        {teamSections.length === 0 ? <Empty /> : null}
      </div>
    </ScrollArea>
  );
}

function TeamHeader({ section }: { section: TeamSection }) {
  const { color } = section;
  const style: React.CSSProperties | undefined = color
    ? {
        color: `color-mix(in srgb, ${color} 72%, hsl(var(--fg)))`,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        borderLeftColor: color,
      }
    : undefined;
  return (
    <h3
      className={cn(
        'flex items-center gap-2 rounded-md border-l-[3px] px-2 py-1.5 text-[12px] font-bold uppercase tracking-wider',
        !color && 'border-l-white/20 bg-white/5 text-fg-subtle',
      )}
      style={style}
    >
      {section.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={section.logoUrl} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
      ) : color ? (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{section.name}</span>
      <span className="shrink-0 rounded-full bg-black/10 px-1.5 text-[10.5px] font-semibold tabular-nums opacity-80">
        {section.users.length}
      </span>
    </h3>
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
  const { t } = useI18n();
  return <div className="px-2 text-xs text-muted-fg">{t.rightPanelNoOneOnline}</div>;
}
