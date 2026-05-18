'use client';

import { cn } from '@/lib/utils';
import { teamLogoSrc } from '@/lib/branding/logo-badges';

const sizes = {
  xs: 'h-4 w-4 rounded-[4px]',
  sm: 'h-6 w-6 rounded-md',
  md: 'h-8 w-8 rounded-lg',
};

export function TeamMark({
  team,
  size = 'sm',
  className,
}: {
  team: { id: string; name: string; color: string; logoUrl?: string | null };
  size?: keyof typeof sizes;
  className?: string;
}) {
  const src = teamLogoSrc(team);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      title={team.name}
      className={cn('shrink-0 object-cover ring-1 ring-white/15', sizes[size], className)}
      style={{ boxShadow: `0 0 0 1px ${team.color}55` }}
    />
  );
}
