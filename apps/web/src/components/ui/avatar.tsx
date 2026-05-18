'use client';
import * as React from 'react';
import * as RxAvatar from '@radix-ui/react-avatar';
import { cn, avatarColor, initials } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  ring?: boolean;
  /** Colored ring for team affiliation */
  teamColor?: string | null;
  /** When no src: show team name initials on team color */
  teamName?: string | null;
}

const sizes = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-base',
};

export function Avatar({ src, name, size = 'md', className, ring, teamColor, teamName }: AvatarProps) {
  const useTeamFallback = !src && teamName?.trim();
  const bg = useTeamFallback && teamColor ? teamColor : avatarColor(name);
  const fallbackLabel = useTeamFallback ? teamName!.trim() : name;
  return (
    <RxAvatar.Root
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-white/5',
        sizes[size],
        ring && 'ring-2 ring-accent-cyan/60 shadow-glow-cyan',
        teamColor && 'ring-2',
        className,
      )}
      style={teamColor ? { boxShadow: `0 0 0 2px ${teamColor}88` } : undefined}
    >
      {src ? (
        <RxAvatar.Image src={src} alt={name} className="h-full w-full object-cover" />
      ) : null}
      <RxAvatar.Fallback
        delayMs={50}
        className="flex h-full w-full items-center justify-center font-semibold text-white"
        style={{ background: bg }}
      >
        {initials(fallbackLabel)}
      </RxAvatar.Fallback>
    </RxAvatar.Root>
  );
}
