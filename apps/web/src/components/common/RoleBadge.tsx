'use client';

import * as React from 'react';

import type { Dict } from '@/i18n/dict';
import { useI18n } from '@/components/providers/LocaleProvider';
import type { Role } from '@sydt/shared';
import { cn } from '@/lib/utils';
import { Crown, Shield, Wrench, Users, User, Eye, Hammer, Star } from 'lucide-react';

const colorByRole: Record<Role, string> = {
  SUPER_ADMIN: 'border-accent-rose/40 text-accent-rose bg-accent-rose/10',
  COMP_ADMIN: 'border-accent-amber/40 text-accent-amber bg-accent-amber/10',
  CHALLENGE_AUTHOR: 'border-accent-violet/40 text-accent-violet bg-accent-violet/10',
  MODERATOR: 'border-accent-cyan/40 text-accent-cyan bg-accent-cyan/10',
  TEAM_CAPTAIN: 'border-accent-emerald/40 text-accent-emerald bg-accent-emerald/10',
  TEAM_MEMBER: 'border-white/15 text-fg-subtle bg-white/5',
  SPECTATOR: 'border-white/8 text-muted-fg bg-white/3',
  OBSERVER: 'border-white/8 text-muted-fg bg-white/3',
};

const iconByRole: Record<Role, React.ReactNode> = {
  SUPER_ADMIN: <Crown className="h-3 w-3" />,
  COMP_ADMIN: <Shield className="h-3 w-3" />,
  CHALLENGE_AUTHOR: <Hammer className="h-3 w-3" />,
  MODERATOR: <Wrench className="h-3 w-3" />,
  TEAM_CAPTAIN: <Star className="h-3 w-3" />,
  TEAM_MEMBER: <User className="h-3 w-3" />,
  SPECTATOR: <Eye className="h-3 w-3" />,
  OBSERVER: <Users className="h-3 w-3" />,
};

export function roleLabel(role: Role, t: Dict): string {
  const map: Record<Role, keyof Dict> = {
    SUPER_ADMIN: 'roleSuperAdmin',
    COMP_ADMIN: 'roleCompAdmin',
    CHALLENGE_AUTHOR: 'roleChallengeAuthor',
    MODERATOR: 'roleModerator',
    TEAM_CAPTAIN: 'roleTeamCaptain',
    TEAM_MEMBER: 'roleTeamMember',
    SPECTATOR: 'roleSpectator',
    OBSERVER: 'roleObserver',
  };
  return t[map[role]] ?? role;
}

interface RoleBadgeProps {
  role: Role;
  className?: string;
  iconOnly?: boolean;
}

export function RoleBadge({ role, className, iconOnly }: RoleBadgeProps) {
  const { t } = useI18n();

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        colorByRole[role],
        className,
      )}
    >
      {iconByRole[role]}
      {!iconOnly && <span>{roleLabel(role, t)}</span>}
    </span>
  );
}
