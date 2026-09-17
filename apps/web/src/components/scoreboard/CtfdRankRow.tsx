'use client';

import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import type { CtfdScoreboardEntryDto } from '@sydt/shared';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

interface Props {
  entry: CtfdScoreboardEntryDto;
  topScore: number;
}

const medalByRank: Record<number, string> = {
  1: 'from-accent-amber to-accent-amber/40',
  2: 'from-fg-subtle to-muted-fg/40',
  3: 'from-accent-rose to-accent-rose/40',
};

export function CtfdRankRow({ entry, topScore }: Props) {
  const color = entry.localTeam?.color ?? 'hsl(var(--accent-cyan))';
  const pct = topScore > 0 ? Math.max(2, (entry.score / topScore) * 100) : 0;

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.5, ease: 'easeOut' } }}
      className={cn(
        'relative grid min-w-0 grid-cols-[auto_2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.05]',
        entry.place <= 3 && 'border-accent-cyan/30',
      )}
    >
      <div
        className={cn(
          'grid h-9 w-9 place-items-center rounded-lg font-mono text-sm font-bold',
          entry.place <= 3
            ? `bg-gradient-to-br ${medalByRank[entry.place]} text-bg-deep`
            : 'border border-white/10 bg-white/5 text-fg-subtle',
        )}
      >
        {entry.place}
      </div>

      <Avatar name={entry.name} src={entry.localTeam?.logoUrl ?? null} size="md" className="ring-1" />

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-fg" style={{ color }}>
            {entry.name}
          </span>
          {entry.place === 1 ? <Trophy className="h-3.5 w-3.5 shrink-0 text-accent-amber" /> : null}
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${color}, hsl(var(--accent-violet)))`,
            }}
          />
        </div>
        {entry.solves != null ? (
          <div className="mt-1 text-[10px] text-muted-fg">
            {entry.solves} solve{entry.solves === 1 ? '' : 's'}
          </div>
        ) : null}
      </div>

      <div className="text-right font-mono tabular-nums">
        <div className="text-base font-bold text-fg">{entry.score.toLocaleString()}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-fg">points</div>
      </div>
    </motion.div>
  );
}
