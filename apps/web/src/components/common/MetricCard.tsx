'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { GlassPanel } from './GlassPanel';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: 'cyan' | 'violet' | 'emerald' | 'rose' | 'amber' | 'default';
  trend?: { value: number; positive?: boolean };
  subline?: string;
  className?: string;
}

const toneText = {
  cyan: 'text-accent-cyan',
  violet: 'text-accent-violet',
  emerald: 'text-accent-emerald',
  rose: 'text-accent-rose',
  amber: 'text-accent-amber',
  default: 'text-fg',
};

const toneBg = {
  cyan: 'bg-accent-cyan/10',
  violet: 'bg-accent-violet/10',
  emerald: 'bg-accent-emerald/10',
  rose: 'bg-accent-rose/10',
  amber: 'bg-accent-amber/10',
  default: 'bg-white/5',
};

export function MetricCard({ label, value, icon: Icon, tone = 'default', trend, subline, className }: MetricCardProps) {
  return (
    <GlassPanel className={cn('relative overflow-hidden p-4', className)} tone={tone === 'default' ? 'default' : tone}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">{label}</div>
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('font-mono text-2xl font-bold tabular-nums', toneText[tone])}
          >
            {value}
          </motion.div>
          {subline ? <div className="text-[11px] text-fg-subtle">{subline}</div> : null}
        </div>
        {Icon ? (
          <div className={cn('rounded-lg p-2', toneBg[tone])}>
            <Icon className={cn('h-4 w-4', toneText[tone])} />
          </div>
        ) : null}
      </div>
      {trend ? (
        <div className="mt-2 flex items-center gap-1 text-[11px] font-medium">
          <span className={trend.positive ? 'text-accent-emerald' : 'text-accent-rose'}>
            {trend.positive ? '▲' : '▼'} {Math.abs(trend.value)}%
          </span>
          <span className="text-muted-fg">vs. last min</span>
        </div>
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -right-12 h-32 w-32 rounded-full opacity-20 blur-2xl"
        style={{
          background:
            tone === 'cyan'
              ? '#22d3ee'
              : tone === 'violet'
              ? '#a78bfa'
              : tone === 'emerald'
              ? '#34d399'
              : tone === 'rose'
              ? '#fb7185'
              : tone === 'amber'
              ? '#fbbf24'
              : '#ffffff',
        }}
      />
    </GlassPanel>
  );
}
