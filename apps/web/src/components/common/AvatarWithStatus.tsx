'use client';

import type { UserStatus } from '@sydt/shared';
import { Avatar } from '@/components/ui/avatar';
import { StatusDot } from '@/components/common/StatusDot';
import { TeamMark } from '@/components/common/TeamMark';
import { cn } from '@/lib/utils';

const boxSize = {
  xs: 'size-5',
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-12',
} as const;

const dotSize = {
  xs: 'xs',
  sm: 'xs',
  md: 'sm',
  lg: 'sm',
} as const;

type BoxSize = keyof typeof boxSize;

export function AvatarWithStatus({
  name,
  src,
  status,
  size = 'md',
  teamColor,
  teamName,
  team,
  showTeamBadge,
  className,
}: {
  name: string;
  src?: string | null;
  status: UserStatus;
  size?: BoxSize;
  teamColor?: string | null;
  teamName?: string | null;
  team?: { id: string; name: string; color: string; logoUrl?: string | null } | null;
  /** Small team logo on avatar corner (e.g. channel messages). */
  showTeamBadge?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative shrink-0', boxSize[size], className)}>
      <Avatar
        name={name}
        src={src}
        size={size}
        teamColor={teamColor}
        teamName={teamName}
        className="!h-full !w-full"
      />
      <StatusDot
        status={status}
        size={dotSize[size] as 'xs' | 'sm'}
        className="absolute bottom-0 right-0 z-10"
      />
      {showTeamBadge && team ? (
        <span className="absolute bottom-0 left-0 z-[9] size-4 overflow-hidden rounded-[3px]">
          <TeamMark team={team} size="xs" className="!h-full !w-full !rounded-[3px]" />
        </span>
      ) : null}
    </div>
  );
}
