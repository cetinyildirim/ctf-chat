'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'cyan' | 'violet' | 'emerald' | 'rose' | 'amber';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  strong?: boolean;
  glow?: boolean;
  bordered?: boolean;
}

const toneRing: Record<Tone, string> = {
  default: '',
  cyan: 'shadow-glow-cyan',
  violet: 'shadow-glow-violet',
  emerald: 'shadow-glow-emerald',
  rose: 'shadow-glow-rose',
  amber: '',
};

const toneBorder: Record<Tone, string> = {
  default: 'border-white/8',
  cyan: 'border-accent-cyan/30',
  violet: 'border-accent-violet/30',
  emerald: 'border-accent-emerald/30',
  rose: 'border-accent-rose/30',
  amber: 'border-accent-amber/30',
};

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, tone = 'default', strong, glow, bordered = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        strong ? 'glass-strong' : 'glass',
        bordered && 'border',
        bordered && toneBorder[tone],
        glow && toneRing[tone],
        'rounded-xl',
        className,
      )}
      {...props}
    />
  ),
);
GlassPanel.displayName = 'GlassPanel';
