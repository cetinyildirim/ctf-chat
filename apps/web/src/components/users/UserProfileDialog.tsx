'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import {
  UserPlus,
  Flag,
  MessageCircle,
  Info,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { FriendshipStatus } from '@sydt/shared';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusDot } from '@/components/common/StatusDot';
import { UserIdentity } from '@/components/common/UserIdentity';
import { useI18n } from '@/components/providers/LocaleProvider';
import { resolveUserAvatarSrc } from '@/lib/branding/user-avatar';
import { usersApi, friendsApi, directApi, reportsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { useUserProfileStore } from '@/store/userProfile';
import { useAuthStore } from '@/store/auth';
import { useLivePresence } from '@/lib/presence/use-live-presence';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

type TabId = 'profile' | 'mutual' | 'groups' | 'servers';

const REPORT_REASONS = ['SPAM', 'HARASSMENT', 'CHEATING', 'INAPPROPRIATE', 'OTHER'] as const;

function headerGradient(teamColor?: string | null) {
  if (teamColor) {
    return `linear-gradient(135deg, ${teamColor}99 0%, ${teamColor} 45%, #6366f1 100%)`;
  }
  return 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 35%, #6366f1 70%, #22d3ee 100%)';
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-white/5 text-muted-fg">
        <Info className="h-8 w-8" />
      </div>
      <p className="text-sm text-muted-fg">{label}</p>
    </div>
  );
}

export function UserProfileDialog() {
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const userId = useUserProfileStore((s) => s.userId);
  const close = useUserProfileStore((s) => s.close);
  const openProfile = useUserProfileStore((s) => s.open);

  const [tab, setTab] = React.useState<TabId>('profile');
  const [reporting, setReporting] = React.useState(false);
  const [reason, setReason] = React.useState<(typeof REPORT_REASONS)[number]>('HARASSMENT');
  const [details, setDetails] = React.useState('');

  const { data: card, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.userProfile(userId ?? ''),
    queryFn: () => usersApi.profile(userId!),
    enabled: !!userId,
  });

  const livePresence = useLivePresence(userId ?? undefined, card?.presenceStatus);

  React.useEffect(() => {
    if (userId) {
      setTab('profile');
      setReporting(false);
      setDetails('');
    }
  }, [userId]);

  const friendMut = useMutation({
    mutationFn: async (action: 'request' | 'accept' | 'reject') => {
      if (!card) return;
      if (action === 'request') return friendsApi.request(card.user.username);
      if (!card.friendship) return;
      if (action === 'accept') return friendsApi.accept(card.friendship.id);
      return friendsApi.reject(card.friendship.id);
    },
    onSuccess: () => {
      toast.success(t.userCardFriendSuccess);
      void refetch();
      void qc.invalidateQueries({ queryKey: queryKeys.friends });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const dmMut = useMutation({
    mutationFn: (peerId: string) => directApi.open(peerId),
    onSuccess: (data) => {
      close();
      router.push(`/channels/${data.channelId ?? data.channel.id}`);
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const reportMut = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('no user');
      const reasonLabel = t[`userCardReportReason_${reason}` as keyof typeof t] as string;
      return reportsApi.create({
        reportedUserId: userId,
        reason: reasonLabel,
        details: details.trim(),
        contextType: 'PROFILE',
      });
    },
    onSuccess: () => {
      toast.success(t.userCardReportSent);
      setReporting(false);
      setDetails('');
      close();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const open = !!userId;
  const user = card?.user;
  const teamColor = user?.team?.color ?? null;
  const presence = livePresence;

  const presenceLabel = React.useMemo(() => {
    switch (presence) {
      case 'ONLINE':
        return t.presenceOnline;
      case 'IDLE':
        return t.presenceIdle;
      case 'DND':
        return t.presenceDnd;
      default:
        return t.presenceOffline;
    }
  }, [presence, t]);
  const isSelf = card?.isSelf || userId === me?.id;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'profile', label: t.userCardTabProfile },
    { id: 'mutual', label: t.userCardTabMutual },
    { id: 'groups', label: t.userCardTabGroups },
    { id: 'servers', label: t.userCardTabServers },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[85] bg-black/65 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[86] flex max-h-[min(92vh,36rem)] w-[min(96vw,26rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1a1b1e] shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">{user?.displayName ?? t.userCardTitle}</Dialog.Title>

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-accent-violet" />
            </div>
          ) : isError || !card || !user ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              <p className="text-sm text-fg-subtle">{unwrapApiError(error).message || t.userCardLoadError}</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>{t.userCardRetry}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={close}>{t.userCardClose}</Button>
              </div>
            </div>
          ) : reporting ? (
            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <h3 className="font-semibold text-fg">{t.userCardReportTitle}</h3>
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-fg hover:bg-white/10 hover:text-fg"
                  onClick={() => setReporting(false)}
                  aria-label={t.userCardClose}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 overflow-y-auto p-4">
                <p className="text-sm text-fg-subtle">{t.userCardReportLead}</p>
                <div className="space-y-2">
                  <Label>{t.userCardReportReason}</Label>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-bg-deep px-3 py-2 text-sm text-fg"
                    value={reason}
                    onChange={(e) => setReason(e.target.value as (typeof REPORT_REASONS)[number])}
                  >
                    {REPORT_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {t[`userCardReportReason_${r}` as keyof typeof t] as string}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{t.userCardReportDetails}</Label>
                  <Textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder={t.userCardReportDetailsPlaceholder}
                    rows={5}
                    maxLength={2000}
                  />
                  <p className="text-[11px] text-muted-fg">{t.userCardReportDetailsHint}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={details.trim().length < 10 || reportMut.isPending}
                    onClick={() => reportMut.mutate()}
                  >
                    {reportMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t.userCardReportSubmit}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setReporting(false)}>
                    {t.userCardCancel}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                className="relative shrink-0 px-4 pb-3 pt-4"
                style={{ background: headerGradient(teamColor) }}
              >
                <div className="absolute right-3 top-3 flex items-center gap-1">
                  {!isSelf ? (
                    <>
                      {card.friendship?.status !== FriendshipStatus.ACCEPTED ? (
                        <button
                          type="button"
                          title={t.userCardAddFriend}
                          disabled={friendMut.isPending || card.friendship?.status === FriendshipStatus.PENDING}
                          onClick={() => {
                            if (card.friendship?.status === FriendshipStatus.PENDING && card.friendship.isIncoming) {
                              friendMut.mutate('accept');
                            } else if (!card.friendship) {
                              friendMut.mutate('request');
                            }
                          }}
                          className="rounded-lg bg-black/25 p-2 text-white transition hover:bg-black/40 disabled:opacity-50"
                        >
                          {card.friendship?.status === FriendshipStatus.PENDING && card.friendship.isIncoming ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <UserPlus className="h-4 w-4" />
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          title={t.userCardMessage}
                          disabled={dmMut.isPending}
                          onClick={() => dmMut.mutate(card.user.id)}
                          className="rounded-lg bg-black/25 p-2 text-white transition hover:bg-black/40"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        title={t.userCardReport}
                        onClick={() => setReporting(true)}
                        className="rounded-lg bg-black/25 p-2 text-white transition hover:bg-black/40"
                      >
                        <Flag className="h-4 w-4" />
                      </button>
                    </>
                  ) : null}
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-lg bg-black/25 p-2 text-white transition hover:bg-black/40"
                      aria-label={t.userCardClose}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="flex gap-4 pr-20">
                  <div className="relative shrink-0">
                    <Avatar
                      name={user.displayName}
                      src={resolveUserAvatarSrc(user)}
                      size="xl"
                      teamColor={teamColor}
                      className="ring-4 ring-black/20"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[#1a1b1e]">
                      <StatusDot status={presence} />
                    </span>
                  </div>
                  <div className="min-w-0 pt-1">
                    <div className="truncate text-xl font-bold text-white drop-shadow-sm">{user.displayName}</div>
                    <div className="truncate font-mono text-sm font-medium text-amber-300">@{user.username}</div>
                    <p className="mt-0.5 text-xs text-white/75">{presenceLabel}</p>
                    {card.friendship?.status === FriendshipStatus.PENDING && card.friendship.isOutgoing ? (
                      <p className="mt-1 text-xs text-white/80">{t.userCardRequestPending}</p>
                    ) : null}
                    {card.friendship?.status === FriendshipStatus.PENDING && card.friendship.isIncoming ? (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="primary" disabled={friendMut.isPending} onClick={() => friendMut.mutate('accept')}>
                          {t.friendsAccept}
                        </Button>
                        <Button size="sm" variant="outline" disabled={friendMut.isPending} onClick={() => friendMut.mutate('reject')}>
                          {t.friendsReject}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-4 border-b border-white/8 px-4">
                {tabs.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={cn(
                      'relative py-3 text-sm font-medium transition-colors',
                      tab === id ? 'text-fg' : 'text-muted-fg hover:text-fg-subtle',
                    )}
                  >
                    {label}
                    {tab === id ? (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-white" />
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#232428]">
                {tab === 'profile' ? (
                  card.bio ? (
                    <div className="p-4 text-sm leading-relaxed text-fg-subtle">{card.bio}</div>
                  ) : (
                    <EmptyTab label={t.userCardEmpty} />
                  )
                ) : null}

                {tab === 'mutual' ? (
                  card.mutualFriends.length > 0 ? (
                    <ul className="divide-y divide-white/5 p-2">
                      {card.mutualFriends.map((u) => (
                        <li key={u.id}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
                            onClick={() => openProfile(u.id)}
                          >
                            <Avatar name={u.displayName} src={u.avatarUrl} size="sm" teamColor={u.team?.color} />
                            <UserIdentity user={u} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyTab label={t.userCardEmpty} />
                  )
                ) : null}

                {tab === 'groups' ? (
                  card.sharedTeam || card.teamChannels.length > 0 ? (
                    <div className="space-y-3 p-4">
                      {card.sharedTeam ? (
                        <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                          <div className="text-xs uppercase tracking-wider text-muted-fg">{t.userCardSharedTeam}</div>
                          <div className="mt-1 font-semibold" style={{ color: card.sharedTeam.color }}>
                            {card.sharedTeam.name}
                          </div>
                        </div>
                      ) : null}
                      {card.teamChannels.length > 0 ? (
                        <ul className="space-y-1">
                          {card.teamChannels.map((ch) => (
                            <li key={ch.id}>
                              <Link
                                href={`/channels/${ch.id}`}
                                onClick={() => close()}
                                className="block rounded-md px-2 py-1.5 text-sm text-fg-subtle hover:bg-white/5 hover:text-fg"
                              >
                                # {ch.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : (
                    <EmptyTab label={t.userCardEmpty} />
                  )
                ) : null}

                {tab === 'servers' ? (
                  card.platformChannels.length > 0 ? (
                    <ul className="space-y-1 p-4">
                      {card.platformChannels.map((ch) => (
                        <li key={ch.id}>
                          <Link
                            href={`/channels/${ch.id}`}
                            onClick={() => close()}
                            className="block rounded-md px-2 py-1.5 text-sm text-fg-subtle hover:bg-white/5 hover:text-fg"
                          >
                            # {ch.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyTab label={t.userCardEmpty} />
                  )
                ) : null}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
