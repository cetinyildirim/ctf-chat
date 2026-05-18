'use client';
import { cn } from '@/lib/utils';
import type { UserStatus } from '@sydt/shared';

const colorByStatus: Record<UserStatus, string> = {
  ONLINE: 'bg-accent-emerald shadow-glow-emerald',
  IDLE: 'bg-accent-amber',
  DND: 'bg-accent-rose shadow-glow-rose',
  OFFLINE: 'bg-muted-fg/60',
};

interface StatusDotProps {
  status: UserStatus;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  ringClass?: string;
}

const sizes = { xs: 'h-1.5 w-1.5', sm: 'h-2 w-2', md: 'h-2.5 w-2.5' };

export function StatusDot({ status, size = 'sm', className, ringClass }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full ring-2 ring-bg-deep',
        sizes[size],
        colorByStatus[status],
        ringClass,
        className,
      )}
      aria-label={status.toLowerCase()}
    />
  );
}
