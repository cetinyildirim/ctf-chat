'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Hash, Lock, Pin, Users, AlertTriangle } from 'lucide-react';
import type { Message, PinnedMessageEntry } from '@sydt/shared';
import { channelsApi, directApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { getSocket } from '@/lib/socket/client';
import { directConversationHref } from '@/lib/chat/viewing';
import { TopBar } from '@/components/layout/TopBar';
import { RightPanel, MembersPanel } from '@/components/layout/RightPanel';
import { MessageList, type MessageListHandle } from '@/components/chat/MessageList';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { ChannelPinnedPanel } from '@/components/chat/ChannelPinnedPanel';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notifications';
import { useI18n } from '@/components/providers/LocaleProvider';

export default function ChannelPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const channelId = params.id;
  const me = useAuthStore((s) => s.user);
  const { t } = useI18n();

  const panelTab = searchParams.get('panel') === 'pins' ? 'pins' : 'members';

  const setPanelTab = React.useCallback(
    (tab: 'members' | 'pins') => {
      const next = new URLSearchParams(searchParams.toString());
      if (tab === 'pins') next.set('panel', 'pins');
      else next.delete('panel');
      const q = next.toString();
      router.replace(q ? `/channels/${channelId}?${q}` : `/channels/${channelId}`);
    },
    [channelId, router, searchParams],
  );

  const { data: channel, isLoading } = useQuery({
    queryKey: queryKeys.channel(channelId),
    queryFn: () => channelsApi.get(channelId),
  });

  const [replyTo, setReplyTo] = React.useState<Message | null>(null);
  const messageListRef = React.useRef<MessageListHandle>(null);
  const queryClient = useQueryClient();

  const isDirect = channel?.type === 'DIRECT_MESSAGE';
  React.useEffect(() => {
    if (isDirect && channelId) router.replace(directConversationHref(channelId));
  }, [isDirect, channelId, router]);

  React.useEffect(() => {
    if (!isDirect || !channelId) return;
    void directApi
      .markRead(channelId)
      .then(() => {
        useNotificationStore.getState().markReadByRef(channelId);
        return queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      })
      .catch(() => undefined);
  }, [isDirect, channelId, queryClient]);

  React.useEffect(() => {
    if (!channelId) return;
    const socket = getSocket();
    const join = () =>
      socket.emit('channel:join', channelId, (res) => {
        if (!res?.ok) console.warn('channel join rejected:', res?.error);
      });
    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      // Keep room membership so unread indicators still receive message:new elsewhere.
    };
  }, [channelId]);

  if (isLoading || !channel || isDirect) return <LoadingScreen label={t.loadingChannel} />;

  const isVoice = channel.type === 'VOICE_PLACEHOLDER';
  const isAnnouncement = channel.type === 'GLOBAL_ANNOUNCEMENT';
  const isStaffOnly =
    channel.type === 'STAFF_COORD' ||
    channel.type === 'ORGANIZER_INTERNAL' ||
    channel.type === 'LOGS';

  const composerDisabled = channel.isLocked && me && !['MODERATOR', 'COMP_ADMIN', 'SUPER_ADMIN', 'CHALLENGE_AUTHOR'].includes(me.role)
    ? true
    : isAnnouncement && me && !['MODERATOR', 'COMP_ADMIN', 'SUPER_ADMIN', 'CHALLENGE_AUTHOR'].includes(me.role)
    ? true
    : false;

  const composerDisabledReason = channel.isLocked
    ? t.channelLockedReason
    : isAnnouncement
    ? t.channelAnnouncementStaffOnly
    : undefined;

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-cols-[1fr_auto] grid-rows-[minmax(0,1fr)]">
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <TopBar
          title={
            <div className="flex items-center gap-2">
              {channel.isPrivate ? (
                <Lock className="h-4 w-4 text-fg-subtle" />
              ) : (
                <Hash className="h-4 w-4 text-fg-subtle" />
              )}
              <span>{channel.name}</span>
              {channel.isLocked ? (
                <span className="rounded-md border border-accent-rose/30 bg-accent-rose/10 px-1.5 py-0.5 text-[10px] uppercase text-accent-rose">
                  {t.channelLockedBadge}
                </span>
              ) : null}
              {isStaffOnly ? (
                <span className="rounded-md border border-accent-violet/30 bg-accent-violet/10 px-1.5 py-0.5 text-[10px] uppercase text-accent-violet">
                  {t.channelStaffBadge}
                </span>
              ) : null}
            </div>
          }
          subtitle={channel.topic ?? undefined}
          right={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPanelTab('pins')}
              className="hidden gap-1.5 md:inline-flex"
            >
              <Pin className="h-3.5 w-3.5" />
              {t.channelPinsBtn}
            </Button>
          }
        />

        {isVoice ? (
          <VoicePlaceholder topic={channel.topic ?? null} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <MessageList
                key={channelId}
                ref={messageListRef}
                channelId={channelId}
                serverId={channel.serverId ?? undefined}
                onReply={setReplyTo}
              />
            </div>
            <MessageComposer
              channelId={channelId}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(null)}
              disabled={!!composerDisabled}
              disabledReason={composerDisabledReason}
            />
          </div>
        )}
      </div>

      <RightPanel
        slot={
          <ChannelContextPanel
            channelId={channelId}
            serverId={channel.serverId}
            tab={panelTab}
            onTabChange={setPanelTab}
            onJumpToPin={(entry) => {
              if (entry.channelId === channelId) {
                messageListRef.current?.scrollToMessage(entry.message.id);
                return;
              }
              router.push(`/channels/${entry.channelId}?panel=pins#message-${entry.message.id}`);
            }}
          />
        }
      />
    </div>
  );
}

function ChannelContextPanel({
  channelId,
  serverId,
  tab,
  onTabChange,
  onJumpToPin,
}: {
  channelId: string;
  serverId?: string | null;
  tab: 'members' | 'pins';
  onTabChange: (tab: 'members' | 'pins') => void;
  onJumpToPin: (entry: PinnedMessageEntry) => void;
}) {
  const { t } = useI18n();

  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as 'members' | 'pins')} className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/5 px-2 pt-2">
        <TabsList className="w-full">
          <TabsTrigger value="members" className="flex-1 gap-1.5">
            <Users className="h-3 w-3 shrink-0" />
            {t.channelPanelMembers}
          </TabsTrigger>
          <TabsTrigger value="pins" className="flex-1 gap-1.5">
            <Pin className="h-3 w-3 shrink-0" />
            {t.channelPanelPinned}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="members" className="m-0 min-h-0 flex-1">
        <MembersPanel />
      </TabsContent>
      <TabsContent value="pins" className="m-0 min-h-0 flex-1">
        {serverId ? (
          <ChannelPinnedPanel serverId={serverId} activeChannelId={channelId} onJumpToPin={onJumpToPin} />
        ) : (
          <div className="p-3 text-xs text-muted-fg">{t.channelPinnedEmpty}</div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function VoicePlaceholder({ topic }: { topic: string | null }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-grid-fade p-8">
      <div className="glass-strong w-full max-w-md rounded-2xl border border-white/8 p-6 text-center shadow-glass">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-accent-violet/15 text-accent-violet">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold">{t.voiceComingSoonTitle}</h3>
        <p className="mt-1 text-sm text-fg-subtle">
          {t.voiceComingSoonBody} {topic ?? ''}
        </p>
      </div>
    </div>
  );
}
