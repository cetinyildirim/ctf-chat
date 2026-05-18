'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Trophy, Users, Flag, Droplet, Zap } from 'lucide-react';
import { challengesApi, scoreboardApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { MetricCard } from '@/components/common/MetricCard';
import { RankRow } from '@/components/scoreboard/RankRow';
import { TimelineChart } from '@/components/scoreboard/TimelineChart';
import { CategoryChart } from '@/components/scoreboard/CategoryChart';
import { Section } from '@/components/common/Section';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/common/Skeleton';

export default function ScoreboardPage() {
  const { data: snapshot, isLoading } = useQuery({
    queryKey: queryKeys.scoreboard,
    queryFn: scoreboardApi.snapshot,
    refetchInterval: 15_000,
  });

  const { data: timeline } = useQuery({
    queryKey: queryKeys.timeline,
    queryFn: scoreboardApi.timeline,
    refetchInterval: 30_000,
  });

  const { data: challenges } = useQuery({
    queryKey: queryKeys.challenges(),
    queryFn: () => challengesApi.list(),
  });

  const categoryByChallenge = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of challenges ?? []) map.set(c.id, c.category);
    return map;
  }, [challenges]);

  const topScore = snapshot?.entries[0]?.score ?? 0;
  const totalSolves = (snapshot?.entries ?? []).reduce((acc, e) => acc + e.solveCount, 0);
  const totalBloods = (snapshot?.entries ?? []).reduce((acc, e) => acc + e.team.bloodCount, 0);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        title={
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent-amber" />
            <span>Live scoreboard</span>
            <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-accent-emerald/30 bg-accent-emerald/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-emerald">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-emerald" />
              LIVE
            </span>
          </div>
        }
        subtitle={snapshot ? `Updated ${new Date(snapshot.generatedAt).toLocaleTimeString()}` : 'Streaming…'}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 p-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <MetricCard label="Teams" value={snapshot?.totalTeams ?? '—'} icon={Users} tone="cyan" />
              <MetricCard
                label="Challenges"
                value={snapshot?.totalChallenges ?? '—'}
                icon={Flag}
                tone="emerald"
              />
              <MetricCard label="Solves" value={totalSolves} icon={Zap} tone="violet" />
              <MetricCard label="First bloods" value={totalBloods} icon={Droplet} tone="rose" />
            </div>

            <GlassPanel className="p-4">
              <Section
                title="Score over time"
                description="Cumulative points for the top 5 teams"
              />
              {timeline && snapshot ? (
                <TimelineChart points={timeline} entries={snapshot.entries} />
              ) : (
                <Skeleton className="h-72 w-full" />
              )}
            </GlassPanel>

            <GlassPanel className="p-4">
              <Section title="Solves by category" />
              {timeline ? (
                <CategoryChart points={timeline} categories={categoryByChallenge} />
              ) : (
                <Skeleton className="h-56 w-full" />
              )}
            </GlassPanel>
          </div>

          <GlassPanel className="p-3" strong>
            <div className="mb-3 flex items-center justify-between px-1">
              <Section title="Ranking" description="Updates every few seconds" />
              {snapshot ? (
                <span className="rounded-md border border-white/8 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] uppercase text-fg-subtle">
                  Top {snapshot.entries.length}
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))
                : null}
              <AnimatePresence initial={false}>
                {snapshot?.entries.map((entry) => (
                  <RankRow key={entry.team.id} entry={entry} topScore={topScore} />
                ))}
              </AnimatePresence>
            </div>
          </GlassPanel>
        </div>
      </ScrollArea>
    </div>
  );
}
