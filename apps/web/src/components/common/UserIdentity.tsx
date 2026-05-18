'use client';

import type { PublicUser } from '@sydt/shared';
import { Role, isAdmin } from '@sydt/shared';
import { cn } from '@/lib/utils';
import { RoleBadge } from '@/components/common/RoleBadge';
import { CaptainBadge } from '@/components/common/CaptainBadge';
import { TeamMark } from '@/components/common/TeamMark';

export function UserIdentity({
  user,
  showTeamMark = true,
  className,
  nameClassName,
  subClassName,
}: {
  user: Pick<PublicUser, 'username' | 'displayName' | 'role' | 'team'>;
  showTeamMark?: boolean;
  className?: string;
  nameClassName?: string;
  subClassName?: string;
}) {
  const teamColor = user.team?.color ?? undefined;

  return (
    <div className={cn('min-w-0', className)}>
      <div className={cn('flex flex-wrap items-center gap-1.5', nameClassName)}>
        {showTeamMark && user.team ? (
          <TeamMark team={user.team} size="xs" className="shrink-0" />
        ) : null}
        <span className="truncate font-semibold text-fg" style={{ color: teamColor }}>
          {user.displayName}
        </span>
        {user.role === Role.TEAM_CAPTAIN ? (
          <CaptainBadge />
        ) : isAdmin(user.role) ? (
          <RoleBadge role={user.role} />
        ) : (
          <RoleBadge role={user.role} iconOnly />
        )}
      </div>
      <div className={cn('truncate text-[11px] text-fg-subtle', subClassName)}>
        <span className="font-mono text-muted-fg">@{user.username}</span>
        {user.team ? (
          <>
            <span className="mx-1 text-muted-fg">·</span>
            <span style={{ color: teamColor }}>{user.team.name}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
