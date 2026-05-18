'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Avatar } from '@/components/ui/avatar';
import { UserIdentity } from '@/components/common/UserIdentity';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/components/providers/LocaleProvider';
import { useAuthStore } from '@/store/auth';
import { friendsApi, directApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import type { PublicUser } from '@sydt/shared';

type Row = {
  id: string;
  requesterId: string;
  addresseeId: string;
  requester: PublicUser;
  addressee: PublicUser;
};

function FriendPeerRow({ user, children }: { user: PublicUser; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
      <Avatar name={user.displayName} src={user.avatarUrl} size="sm" teamColor={user.team?.color} />
      <UserIdentity user={user} className="min-w-0 flex-1" />
      {children}
    </li>
  );
}

function peer(meId: string, row: Row) {
  return row.requesterId === meId ? row.addressee : row.requester;
}

export default function FriendsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [username, setUsername] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.friends,
    queryFn: friendsApi.summary,
    enabled: !!me,
  });

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
  }, [queryClient]);

  const reqMut = useMutation({
    mutationFn: async () => friendsApi.request(username.trim()),
    onSuccess: () => {
      setUsername('');
      toast.success(t.friendsRequestSent);
      invalidate();
    },
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  const acceptMut = useMutation({
    mutationFn: (id: string) => friendsApi.accept(id),
    onSuccess: invalidate,
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => friendsApi.reject(id),
    onSuccess: invalidate,
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  const unfriendMut = useMutation({
    mutationFn: (id: string) => friendsApi.unfriend(id),
    onSuccess: invalidate,
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  const dmMut = useMutation({
    mutationFn: async (userId: string) => directApi.open(userId),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.channels });
      router.push(`/channels/${res.channel.id}`);
    },
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  if (!me) return null;

  const accepted = data?.accepted ?? [];
  const inc = data?.pendingIncoming ?? [];
  const out = data?.pendingOutgoing ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar title={t.friendsPageTitle} subtitle={t.friendsPageSubtitle} />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
        <GlassPanel className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <label htmlFor="friend-user" className="text-xs text-fg-subtle">
              {t.profileUsernameLabel}
            </label>
            <Input
              id="friend-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t.friendsUsernamePlaceholder}
              autoComplete="username"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  reqMut.mutate();
                }
              }}
            />
          </div>
          <Button
            type="button"
            disabled={!username.trim() || reqMut.isPending}
            onClick={() => reqMut.mutate()}
          >
            {reqMut.isPending ? '…' : t.friendsSendRequest}
          </Button>
        </GlassPanel>

        {isLoading ? <div className="text-sm text-muted-fg">{t.loading}</div> : null}

        <GlassPanel className="p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-fg">
            {t.friendsIncoming}
          </h2>
          {!inc.length ? <p className="text-sm text-fg-subtle">{t.friendsEmpty}</p> : null}
          <ul className="space-y-2">
            {inc.map((row) => {
              const p = peer(me.id, row);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
                >
                  <Avatar name={p.displayName} src={p.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-fg">{p.displayName}</div>
                    <div className="truncate text-[11px] text-fg-subtle">{p.username}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={acceptMut.isPending || rejectMut.isPending}
                    onClick={() => acceptMut.mutate(row.id)}
                  >
                    {t.friendsAccept}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={rejectMut.isPending || acceptMut.isPending}
                    onClick={() => rejectMut.mutate(row.id)}
                  >
                    {t.friendsReject}
                  </Button>
                </li>
              );
            })}
          </ul>
        </GlassPanel>

        <GlassPanel className="p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-fg">
            {t.friendsOutgoing}
          </h2>
          {!out.length ? <p className="text-sm text-fg-subtle">{t.friendsEmpty}</p> : null}
          <ul className="space-y-2">
            {out.map((row) => {
              const p = peer(me.id, row);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
                >
                  <Avatar name={p.displayName} src={p.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-fg">{p.displayName}</div>
                    <div className="truncate text-[11px] text-fg-subtle">{p.username}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={rejectMut.isPending}
                    onClick={() => rejectMut.mutate(row.id)}
                  >
                    {t.friendsReject}
                  </Button>
                </li>
              );
            })}
          </ul>
        </GlassPanel>

        <GlassPanel className="p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted-fg">
            {t.friendsList}
          </h2>
          {!accepted.length ? <p className="text-sm text-fg-subtle">{t.friendsEmpty}</p> : null}
          <ul className="space-y-2">
            {accepted.map((row) => {
              const p = peer(me.id, row);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
                >
                  <Avatar name={p.displayName} src={p.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-fg">{p.displayName}</div>
                    <div className="truncate text-[11px] text-fg-subtle">{p.username}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={dmMut.isPending}
                    onClick={() => dmMut.mutate(p.id)}
                  >
                    {t.friendsMessage}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={unfriendMut.isPending}
                    onClick={() => unfriendMut.mutate(row.id)}
                  >
                    {t.friendsRemove}
                  </Button>
                </li>
              );
            })}
          </ul>
        </GlassPanel>
      </div>
    </div>
  );
}
