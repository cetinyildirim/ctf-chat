import * as React from 'react';
import { cn } from '@/lib/utils';

export const SYDT_EXERCISE_IMAGE = '/brand-assets/sydt-exercise.jpg';
export const TAF_CYBER_DEFENCE_IMAGE = '/brand-assets/taf-cyber-defence.png';

/** Oval crop of the SYDT exercise artwork, framed with the brand gradient. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative inline-block h-12 w-[3.75rem] shrink-0 rounded-[50%] bg-gradient-to-br from-accent-cyan via-white/40 to-accent-rose p-[2px] shadow-[0_0_22px_-4px_rgba(34,211,238,0.55)]',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SYDT_EXERCISE_IMAGE}
        alt="SYDT"
        className="h-full w-full rounded-[50%] object-cover object-[50%_36%]"
        draggable={false}
      />
    </span>
  );
}

/** Mark plus wordmark. */
export function BrandLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <BrandMark className={markClassName} />
      <span className="text-xl font-bold tracking-wide text-fg">
        SYDT <span className="text-gradient-cyan">CHAT</span>
      </span>
    </span>
  );
}
