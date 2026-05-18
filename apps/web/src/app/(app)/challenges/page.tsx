'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Flag, Filter, Search, CheckCircle2, Droplet } from 'lucide-react';
import { challengesApi, scoreboardApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const CATS = ['WEB', 'PWN', 'REV', 'CRYPTO', 'FORENSICS', 'OSINT', 'MISC'] as const;
const DIFFS = ['EASY', 'MEDIUM', 'HARD', 'INSANE'] as const;

const CAT_COLOR: Record<(typeof CATS)[number], string> = {
  WEB: 'border-accent-cyan/40 text-accent-cyan bg-accent-cyan/10',
  PWN: 'border-accent-rose/40 text-accent-rose bg-accent-rose/10',
  REV: 'border-accent-violet/40 text-accent-violet bg-accent-violet/10',
  CRYPTO: 'border-accent-emerald/40 text-accent-emerald bg-accent-emerald/10',
  FORENSICS: 'border-accent-amber/40 text-accent-amber bg-accent-amber/10',
  OSINT: 'border-pink-400/40 text-pink-300 bg-pink-400/10',
  MISC: 'border-white/15 text-fg-subtle bg-white/5',
};

const DIFF_COLOR: Record<(typeof DIFFS)[number], string> = {
  EASY: 'text-accent-emerald',
  MEDIUM: 'text-accent-amber',
  HARD: 'text-accent-rose',
  INSANE: 'text-accent-violet',
};

export default function ChallengesPage() {
  const [filter, setFilter] = React.useState<{
    category?: string;
    difficulty?: string;
    q?: string;
    solved?: 'true' | 'false';
  }>({});

  const { data: challenges, isLoading } = useQuery({
    queryKey: queryKeys.challenges(filter),
    queryFn: () => challengesApi.list(filter),
  });

  const { data: snapshot } = useQuery({
    queryKey: queryKeys.scoreboard,
    queryFn: scoreboardApi.snapshot,
  });

  const teamsById = React.useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const e of snapshot?.entries ?? []) map.set(e.team.id, e.team);
    return map;
  }, [snapshot]);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        title={
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-accent-emerald" />
            <span>Challenges</span>
          </div>
        }
        subtitle={`${challenges?.length ?? '—'} released`}
      />

      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              placeholder="Search challenges"
              value={filter.q ?? ''}
              onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value || undefined }))}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-muted-fg" />
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setFilter((f) => ({ ...f, category: f.category === c ? undefined : c }))}
                className={cn(
                  'rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
                  filter.category === c ? CAT_COLOR[c] : 'border-white/10 bg-white/5 text-fg-subtle hover:bg-white/8',
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
              Difficulty
            </span>
            {DIFFS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setFilter((f) => ({ ...f, difficulty: f.difficulty === d ? undefined : d }))}
                className={cn(
                  'rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
                  filter.difficulty === d
                    ? cn('border-white/25 bg-white/10', DIFF_COLOR[d])
                    : 'border-white/10 bg-white/5 text-fg-subtle hover:bg-white/8',
                )}
              >
                {d}
              </button>
            ))}
          </div>

          <Tabs
            value={filter.solved ?? 'all'}
            onValueChange={(v) =>
              setFilter((f) => ({ ...f, solved: v === 'all' ? undefined : (v as 'true' | 'false') }))
            }
            className="ml-auto"
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="false">Unsolved</TabsTrigger>
              <TabsTrigger value="true">Solved</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading
            ? Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-40" />)
            : null}

          {!isLoading && (!challenges || challenges.length === 0) ? (
            <div className="col-span-full">
              <EmptyState icon={Flag} title="No challenges match" description="Try clearing filters." />
            </div>
          ) : null}

          {challenges?.map((c) => {
            const bloodTeam = c.firstBloodTeamId ? teamsById.get(c.firstBloodTeamId) : null;
            return (
              <Link key={c.id} href={`/challenges/${c.id}`} className="group">
                <GlassPanel
                  className="flex h-full flex-col gap-2 p-3 transition-all group-hover:border-accent-cyan/40 group-hover:shadow-glow-cyan/30"
                  tone={c.isSolvedByMyTeam ? 'emerald' : 'default'}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                        CAT_COLOR[c.category],
                      )}
                    >
                      {c.category}
                    </span>
                    <span className={cn('font-mono text-[10px] font-semibold uppercase', DIFF_COLOR[c.difficulty])}>
                      {c.difficulty}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-semibold text-fg group-hover:text-accent-cyan">
                        {c.title}
                      </h3>
                      {c.isSolvedByMyTeam ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent-emerald" />
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-fg-subtle">{c.description}</p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-fg">
                    <span className="font-mono">{c.points} pts</span>
                    <span>{c.solveCount} solve{c.solveCount === 1 ? '' : 's'}</span>
                  </div>
                  {bloodTeam ? (
                    <div className="inline-flex items-center gap-1 rounded border border-accent-rose/30 bg-accent-rose/10 px-1.5 py-0.5 text-[10px]" style={{ color: bloodTeam.color }}>
                      <Droplet className="h-2.5 w-2.5" />
                      <span className="font-medium">Blood · {bloodTeam.name}</span>
                    </div>
                  ) : null}
                </GlassPanel>
              </Link>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
