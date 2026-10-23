'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Trophy, Users, Crown, Target, ExternalLink } from 'lucide-react';
import { serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useServerStore } from '@/store/server';
import { useI18n } from '@/components/providers/LocaleProvider';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { MetricCard } from '@/components/common/MetricCard';
import { CtfdRankRow } from '@/components/scoreboard/CtfdRankRow';
import { Section } from '@/components/common/Section';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/common/Skeleton';

export default function ScoreboardPage() {
  const { t } = useI18n();
  const activeServerId = useServerStore((s) => s.activeServerId);

  const { data: ctfd, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.serverCtfdScoreboard(activeServerId ?? ''),
    queryFn: () => serversApi.getCtfdScoreboard(activeServerId!),
    enabled: !!activeServerId,
    refetchInterval: 30_000,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const connected = !!ctfd?.configured;
  const entries = connected ? (ctfd?.entries ?? []) : [];
  const leader = entries[0];
  const topScore = leader?.score ?? 0;
  const scoringTeams = entries.filter((e) => e.score > 0).length;
  const loading = !!activeServerId && (isLoading || (isFetching && !ctfd));

  const dash = '—';

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        title={
          <div className="flex flex-wrap items-center gap-2">
            <Trophy className="h-4 w-4 text-accent-amber" />
            <span>{t.scoreboardTitle}</span>
            {connected ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-accent-emerald/30 bg-accent-emerald/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-emerald">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-emerald" />
                {t.liveBadge}
              </span>
            ) : null}
            {connected && ctfd?.scoreboardUrl ? (
              <a
                href={ctfd.scoreboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-accent-cyan hover:bg-white/10"
              >
                <ExternalLink className="h-3 w-3" />
                {t.teamCtfdOpenBoard}
              </a>
            ) : null}
          </div>
        }
        subtitle={
          !activeServerId
            ? t.scoreboardPickServer
            : !connected
              ? ctfd?.needsToken
                ? t.scoreboardCtfdNeedToken
                : t.scoreboardNoCtfd
              : ctfd?.generatedAt
                ? t.scoreboardUpdated.replace(
                    '{{time}}',
                    new Date(ctfd.generatedAt).toLocaleTimeString(t.dateLocale),
                  )
                : t.scoreboardStreaming
        }
      />

      <ScrollArea className="min-h-0 flex-1">
        {!activeServerId ? (
          <div className="flex h-64 items-center justify-center p-6">
            <p className="max-w-md text-center text-sm text-fg-subtle">{t.scoreboardPickServer}</p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-4 p-4 lg:gap-5 lg:p-6">
            {!connected && !loading ? (
              <p className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-center text-sm text-fg-subtle">
                {ctfd?.needsToken ? t.scoreboardCtfdNeedToken : t.scoreboardNoCtfd}
              </p>
            ) : null}

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={t.scoreboardTeams}
                value={connected ? entries.length || dash : dash}
                icon={Users}
                tone="cyan"
              />
              <MetricCard
                label={t.scoreboardTopScore}
                value={connected && topScore > 0 ? topScore.toLocaleString(t.dateLocale) : dash}
                icon={Trophy}
                tone="amber"
              />
              <MetricCard
                label={t.scoreboardLeader}
                value={
                  connected && leader ? (
                    <span className="block max-w-full truncate text-lg font-semibold normal-case">{leader.name}</span>
                  ) : (
                    dash
                  )
                }
                subline={connected && leader ? `${leader.score.toLocaleString(t.dateLocale)} ${t.pointsShort}` : undefined}
                icon={Crown}
                tone="violet"
              />
              <MetricCard
                label={t.scoreboardActiveTeams}
                value={connected ? scoringTeams || dash : dash}
                icon={Target}
                tone="emerald"
              />
            </div>

            <GlassPanel className="min-w-0 p-4 lg:p-5" strong>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-0.5">
                <Section title={t.scoreboardRanking} description={t.scoreboardRankingHint} />
                {connected && entries.length > 0 ? (
                  <span className="rounded-md border border-white/8 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-fg-subtle">
                    {t.scoreboardTopN.replace('{{count}}', String(entries.length))}
                  </span>
                ) : null}
              </div>

              {loading ? (
                <div className="grid gap-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-[4.25rem] w-full rounded-lg" />
                  ))}
                </div>
              ) : null}

              {!loading && !connected ? (
                <p className="py-16 text-center text-sm text-fg-subtle">{t.scoreboardNoCtfd}</p>
              ) : null}

              {!loading && connected && !entries.length ? (
                <p className="py-16 text-center text-sm text-fg-subtle">{t.scoreboardCtfdEmpty}</p>
              ) : null}

              {!loading && entries.length > 0 ? (
                <div className="grid min-w-0 gap-2">
                  <AnimatePresence initial={false}>
                    {entries.map((entry) => (
                      <CtfdRankRow
                        key={`${entry.ctfdTeamId ?? entry.name}-${entry.place}`}
                        entry={entry}
                        topScore={topScore}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : null}
            </GlassPanel>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
