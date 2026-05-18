'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import type { Channel, ChannelNotifyMode, UserStatus } from '@sydt/shared';
import { ChannelNotifyContextMenu } from '@/components/channels/ChannelNotifyContextMenu';
import { channelsApi, usersApi } from '@/lib/api/endpoints';
import { usePresenceStore } from '@/store/presence';
import { queryKeys } from '@/lib/query/client';
import { Avatar } from '@/components/ui/avatar';
import { StatusDot } from '@/components/common/StatusDot';
import { UserProfileTrigger } from '@/components/users/UserProfileTrigger';
import { useLivePresence } from '@/lib/presence/use-live-presence';
import { useI18n } from '@/components/providers/LocaleProvider';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/common/Skeleton';

function DmRow({
  channel,
  active,
  notifyBusy,
  setNotify,
}: {
  channel: Channel;
  active: boolean;
  notifyBusy: boolean;
  setNotify: (m: ChannelNotifyMode) => void;
}) {
  const peer = channel.dmPeer;
  const label = peer?.displayName ?? channel.name;
  const status = useLivePresence(peer?.id, 'OFFLINE');

  return (
    <li>
      <ChannelNotifyContextMenu notifyBusy={notifyBusy} onSetNotify={setNotify}>
        <Link
          href={`/channels/${channel.id}`}
          className={cn(
            'group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors',
            active
              ? 'border-accent-violet/25 bg-accent-violet/10 text-fg'
              : 'hover:border-white/8 hover:bg-white/[0.04]',
          )}
        >
          <div className="relative shrink-0">
            {peer ? (
              <UserProfileTrigger userId={peer.id}>
                <Avatar name={peer.displayName} src={peer.avatarUrl} size="sm" teamColor={peer.team?.color} />
              </UserProfileTrigger>
            ) : (
              <Avatar name="?" src={null} size="sm" />
            )}
            {peer ? (
              <span className="absolute -bottom-0.5 -right-0.5 ring-2 ring-bg-elev rounded-full">
                <StatusDot status={status} />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-fg">{label}</div>
            {peer ? (
              <div className="truncate font-mono text-[11px] text-muted-fg">@{peer.username}</div>
            ) : null}
          </div>
        </Link>
      </ChannelNotifyContextMenu>
    </li>
  );
}

export function DmConversationsList({ className }: { className?: string }) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname() ?? '';
  const queryClient = useQueryClient();
  const activeChannelId = pathname.startsWith('/channels/') ? pathname.split('/')[2] : null;

  const notifyMut = useMutation({
    mutationFn: ({ channelId, mode }: { channelId: string; mode: ChannelNotifyMode }) =>
      channelsApi.setChannelNotify(channelId, mode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.channels }),
  });

  const setPresences = usePresenceStore((s) => s.setPresences);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.channels,
    queryFn: channelsApi.list,
    enabled: !!user,
    staleTime: 30_000,
  });

  const { data: onlineData } = useQuery({
    queryKey: queryKeys.usersOnline,
    queryFn: usersApi.online,
    enabled: !!user,
    refetchInterval: 20_000,
  });

  React.useEffect(() => {
    if (!onlineData?.presences) return;
    setPresences(
      onlineData.presences.map((p) => ({
        userId: p.userId,
        status: p.status as UserStatus,
        lastSeen: p.lastSeen,
      })),
    );
  }, [onlineData, setPresences]);

  const dmChannels = data?.dmChannels ?? [];

  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-accent-violet" />
        <h2 className="text-sm font-semibold text-fg">{t.dmSectionTitle}</h2>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : dmChannels.length === 0 ? (
        <p className="text-sm text-fg-subtle">{t.dmEmpty}</p>
      ) : (
        <ul className="space-y-1">
          {dmChannels.map((ch) => (
            <DmRow
              key={ch.id}
              channel={ch}
              active={activeChannelId === ch.id}
              notifyBusy={notifyMut.isPending}
              setNotify={(mode) => notifyMut.mutate({ channelId: ch.id, mode })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
