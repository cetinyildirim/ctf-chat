'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Flag,
  Lightbulb,
  Hash,
  Droplet,
  CheckCircle2,
  Loader2,
  LifeBuoy,
  ExternalLink,
} from 'lucide-react';
import { challengesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TicketComposer } from '@/components/tickets/TicketComposer';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { Section } from '@/components/common/Section';
import { MessageMarkdown } from '@/components/chat/MessageMarkdown';
import { Avatar } from '@/components/ui/avatar';
import { smartDate } from '@/lib/format/time';
import { toast } from 'sonner';
import { unwrapApiError } from '@/lib/api/axios';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/providers/LocaleProvider';

const CAT_COLOR: Record<string, string> = {
  WEB: 'border-accent-cyan/40 text-accent-cyan bg-accent-cyan/10',
  PWN: 'border-accent-rose/40 text-accent-rose bg-accent-rose/10',
  REV: 'border-accent-violet/40 text-accent-violet bg-accent-violet/10',
  CRYPTO: 'border-accent-emerald/40 text-accent-emerald bg-accent-emerald/10',
  FORENSICS: 'border-accent-amber/40 text-accent-amber bg-accent-amber/10',
  OSINT: 'border-pink-400/40 text-pink-300 bg-pink-400/10',
  MISC: 'border-white/15 text-fg-subtle bg-white/5',
};

export default function ChallengeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.challenge(id),
    queryFn: () => challengesApi.get(id),
  });

  const unlockMutation = useMutation({
    mutationFn: (hintId: string) => challengesApi.unlockHint(hintId),
    onSuccess: () => {
      toast.success(t.challengeHintUnlocked);
      void queryClient.invalidateQueries({ queryKey: queryKeys.challenge(id) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  if (isLoading || !data) return <LoadingScreen label={t.loadingChallenge} />;
  const { challenge, hints, solves } = data;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        title={
          <div className="flex items-center gap-2">
            <Link
              href="/challenges"
              className="rounded-md p-1 text-fg-subtle hover:bg-white/5 hover:text-fg"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Flag className="h-4 w-4 text-accent-emerald" />
            <span>{challenge.title}</span>
            {challenge.isSolvedByMyTeam ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-accent-emerald/40 bg-accent-emerald/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent-emerald">
                <CheckCircle2 className="h-3 w-3" /> {t.challengeSolvedBadge}
              </span>
            ) : null}
          </div>
        }
        subtitle={`${challenge.category} · ${challenge.difficulty} · ${challenge.points} ${t.pointsShort}`}
        right={
          <div className="flex items-center gap-2">
            {challenge.discussionChannelId ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/channels/${challenge.discussionChannelId}`}>
                  <Hash className="h-3.5 w-3.5" />
                  {t.challengeOpenDiscussion}
                </Link>
              </Button>
            ) : null}
            <TicketComposer
              challengeId={challenge.id}
              trigger={
                <Button variant="primary" size="sm">
                  <LifeBuoy className="h-3.5 w-3.5" />
                  {t.challengeOpenTicket}
                </Button>
              }
            />
          </div>
        }
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <GlassPanel className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                    CAT_COLOR[challenge.category],
                  )}
                >
                  {challenge.category}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
                  {challenge.difficulty}
                </span>
                <span className="font-mono text-sm text-fg">{challenge.points} {t.pointsShort}</span>
              </div>
              <div className="prose-invert space-y-2">
                <MessageMarkdown content={challenge.description} />
              </div>
              {challenge.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {challenge.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-fg-subtle"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              ) : null}
            </GlassPanel>

            <GlassPanel className="p-4">
              <Section title={t.challengeHints} description={t.challengeHintsCost} />
              {hints.length === 0 ? (
                <div className="text-xs text-muted-fg">{t.challengeNoHints}</div>
              ) : (
                <ul className="space-y-2">
                  {hints.map((h) => (
                    <li
                      key={h.id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3',
                        h.unlocked
                          ? 'border-accent-amber/30 bg-accent-amber/5'
                          : 'border-white/8 bg-white/[0.02]',
                      )}
                    >
                      <Lightbulb
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          h.unlocked ? 'text-accent-amber' : 'text-fg-subtle',
                        )}
                      />
                      <div className="flex-1">
                        <div className="text-[11px] uppercase tracking-wider text-muted-fg">
                          {t.challengeHintN.replace('{{n}}', String(h.order + 1))} · {h.cost > 0 ? `-${h.cost} ${t.pointsShort}` : t.challengeHintFree}
                        </div>
                        {h.unlocked ? (
                          <div className="mt-1 text-sm text-fg">{h.text}</div>
                        ) : (
                          <Button
                            variant="subtle"
                            size="sm"
                            className="mt-2"
                            disabled={unlockMutation.isPending}
                            onClick={() => unlockMutation.mutate(h.id)}
                          >
                            {unlockMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Lightbulb className="h-3.5 w-3.5" />
                            )}
                            {t.challengeUnlockHint}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </GlassPanel>
          </div>

          <aside className="space-y-3">
            <GlassPanel className="p-3 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">{t.challengeStats}</div>
              <Row k={t.challengeStatPoints} v={<span className="font-mono">{challenge.points}</span>} />
              <Row k={t.challengeStatSolves} v={<span className="font-mono">{challenge.solveCount}</span>} />
              <Row k={t.challengeStatHints} v={<span className="font-mono">{challenge.hintCount}</span>} />
              <Row k={t.challengeStatAuthor} v={<span>{challenge.authorName ?? '—'}</span>} />
            </GlassPanel>

            <GlassPanel className="p-3">
              <Section title={t.challengeSolveTimeline} />
              {solves.length === 0 ? (
                <div className="text-xs text-muted-fg">{t.challengeNoSolves}</div>
              ) : (
                <ul className="space-y-1.5">
                  {solves.map((s, i) => (
                    <li key={`${s.team.id}-${i}`} className="flex items-center gap-2 text-xs">
                      <Avatar name={s.team.name} size="xs" />
                      <span className="font-mono text-muted-fg">#{i + 1}</span>
                      <span className="font-medium" style={{ color: s.team.color }}>
                        {s.team.name}
                      </span>
                      <span className="ml-auto text-muted-fg">{smartDate(s.solvedAt)}</span>
                      {s.firstBlood ? (
                        <Droplet className="h-3 w-3 text-accent-rose" />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </GlassPanel>

            {challenge.discussionChannelId ? (
              <Link
                href={`/channels/${challenge.discussionChannelId}`}
                className="flex items-center justify-between rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 p-3 text-sm text-accent-cyan hover:bg-accent-cyan/10"
              >
                <span>{t.challengeOpenDiscussionChannel}</span>
                <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
          </aside>
        </div>
      </ScrollArea>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-fg">{k}</span>
      <span className="text-fg">{v}</span>
    </div>
  );
}
