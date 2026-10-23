'use client';

import { motion } from 'framer-motion';
import { Trophy, Droplet, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { ScoreboardEntry } from '@sydt/shared';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { useI18n } from '@/components/providers/LocaleProvider';

interface Props {
  entry: ScoreboardEntry;
  topScore: number;
}

const medalByRank: Record<number, string> = {
  1: 'from-accent-amber to-accent-amber/40',
  2: 'from-fg-subtle to-muted-fg/40',
  3: 'from-accent-rose to-accent-rose/40',
};

export function RankRow({ entry, topScore }: Props) {
  const { t } = useI18n();
  const pct = topScore > 0 ? Math.max(2, (entry.score / topScore) * 100) : 0;
  const rankChange =
    entry.previousRank == null
      ? 'same'
      : entry.previousRank > entry.rank
      ? 'up'
      : entry.previousRank < entry.rank
      ? 'down'
      : 'same';
  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.5, ease: 'easeOut' } }}
      className={cn(
        'relative grid grid-cols-[auto_2.25rem_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.05] transition-colors',
        entry.rank <= 3 && 'border-accent-cyan/30',
      )}
    >
      <div
        className={cn(
          'grid h-9 w-9 place-items-center rounded-lg font-mono text-sm font-bold',
          entry.rank <= 3
            ? `bg-gradient-to-br ${medalByRank[entry.rank]} text-bg-deep`
            : 'border border-white/10 bg-white/5 text-fg-subtle',
        )}
      >
        {entry.rank}
      </div>

      <Avatar
        name={entry.team.name}
        src={entry.team.logoUrl}
        size="md"
        className="ring-1"
      />

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="truncate text-sm font-semibold text-fg"
            style={{ color: entry.team.color }}
          >
            {entry.team.name}
          </span>
          {entry.team.bloodCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 rounded border border-accent-rose/30 bg-accent-rose/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-accent-rose">
              <Droplet className="h-2.5 w-2.5" />
              {entry.team.bloodCount} blood
            </span>
          ) : null}
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${entry.team.color}, hsl(var(--accent-violet)))`,
            }}
          />
        </div>
        <div className="mt-1 text-[10px] text-muted-fg">
          {(entry.solveCount === 1 ? t.solveCountOne : t.solveCountMany).replace('{{count}}', String(entry.solveCount))} ·{' '}
          {t.membersCount.replace('{{count}}', String(entry.team.memberCount))}
        </div>
      </div>

      <div className="text-right font-mono tabular-nums">
        <div className="text-base font-bold text-fg">{entry.score.toLocaleString(t.dateLocale)}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-fg">{t.pointsLabel}</div>
      </div>

      <div className="text-right text-[11px]">
        {rankChange === 'up' ? (
          <span className="inline-flex items-center gap-0.5 text-accent-emerald">
            <ArrowUp className="h-3 w-3" />
            {(entry.previousRank ?? entry.rank) - entry.rank}
          </span>
        ) : rankChange === 'down' ? (
          <span className="inline-flex items-center gap-0.5 text-accent-rose">
            <ArrowDown className="h-3 w-3" />
            {entry.rank - (entry.previousRank ?? entry.rank)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-muted-fg">
            <Minus className="h-3 w-3" />
          </span>
        )}
        {entry.rank === 1 ? <Trophy className="ml-1 inline-block h-3.5 w-3.5 text-accent-amber" /> : null}
      </div>
    </motion.div>
  );
}
