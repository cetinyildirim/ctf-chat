'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Hash, Lock, Pin, Users, AlertTriangle } from 'lucide-react';
import type { Message } from '@sydt/shared';
import { channelsApi, messagesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { getSocket } from '@/lib/socket/client';
import { TopBar } from '@/components/layout/TopBar';
import { RightPanel, MembersPanel } from '@/components/layout/RightPanel';
import { MessageList } from '@/components/chat/MessageList';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageMarkdown } from '@/components/chat/MessageMarkdown';
import { Avatar } from '@/components/ui/avatar';
import { smartDate } from '@/lib/format/time';
import { Section } from '@/components/common/Section';
import { useAuthStore } from '@/store/auth';

export default function ChannelPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const channelId = params.id;
  const me = useAuthStore((s) => s.user);

  const { data: channel, isLoading } = useQuery({
    queryKey: queryKeys.channel(channelId),
    queryFn: () => channelsApi.get(channelId),
  });

  const [replyTo, setReplyTo] = React.useState<Message | null>(null);

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
      socket.emit('channel:leave', channelId);
    };
  }, [channelId]);

  if (isLoading || !channel) return <LoadingScreen label="Loading channel..." />;

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
    ? 'Channel is locked'
    : isAnnouncement
    ? 'Only staff may post in announcement channels'
    : undefined;

  return (
    <div className="grid h-full min-w-0 grid-cols-[1fr_auto]">
      <div className="flex h-full min-w-0 flex-col">
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
                  Locked
                </span>
              ) : null}
              {isStaffOnly ? (
                <span className="rounded-md border border-accent-violet/30 bg-accent-violet/10 px-1.5 py-0.5 text-[10px] uppercase text-accent-violet">
                  Staff
                </span>
              ) : null}
            </div>
          }
          subtitle={channel.topic ?? undefined}
          right={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/channels/${channelId}?panel=pins`)}
              className="hidden md:inline-flex"
            >
              <Pin className="h-3.5 w-3.5" />
              Pins
            </Button>
          }
        />

        {isVoice ? (
          <VoicePlaceholder topic={channel.topic ?? null} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <MessageList channelId={channelId} onReply={setReplyTo} />
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

      <RightPanel slot={<ChannelContextPanel channelId={channelId} />} />
    </div>
  );
}

function ChannelContextPanel({ channelId }: { channelId: string }) {
  const { data: pins } = useQuery({
    queryKey: queryKeys.pins(channelId),
    queryFn: () => messagesApi.listPins(channelId),
    staleTime: 60_000,
  });

  return (
    <Tabs defaultValue="members" className="flex h-full flex-col">
      <div className="border-b border-white/5 px-2 pt-2">
        <TabsList className="w-full">
          <TabsTrigger value="members" className="flex-1">
            <Users className="h-3 w-3" /> Members
          </TabsTrigger>
          <TabsTrigger value="pins" className="flex-1">
            <Pin className="h-3 w-3" /> Pinned
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="members" className="m-0 min-h-0 flex-1">
        <MembersPanel />
      </TabsContent>
      <TabsContent value="pins" className="m-0 min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="space-y-3 p-3">
            <Section title="Pinned messages" description="Important context surfaced by staff" >
              {!pins || pins.length === 0 ? (
                <div className="rounded-md border border-dashed border-white/10 p-4 text-xs text-muted-fg">
                  No pinned messages.
                </div>
              ) : (
                pins.map((p) => (
                  <div key={p.id} className="rounded-md border border-white/8 bg-white/[0.02] p-2.5">
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-fg-subtle">
                      <Avatar name={p.author.displayName} src={p.author.avatarUrl} size="xs" />
                      <span className="font-medium text-fg">{p.author.displayName}</span>
                      <span>·</span>
                      <span>{smartDate(p.createdAt)}</span>
                    </div>
                    <MessageMarkdown content={p.content} />
                  </div>
                ))
              )}
            </Section>
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function VoicePlaceholder({ topic }: { topic: string | null }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-grid-fade p-8">
      <div className="glass-strong w-full max-w-md rounded-2xl border border-white/8 p-6 text-center shadow-glass">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-accent-violet/15 text-accent-violet">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold">Voice is coming soon</h3>
        <p className="mt-1 text-sm text-fg-subtle">
          This voice channel is a placeholder for the upcoming WebRTC stage. {topic ?? ''}
        </p>
      </div>
    </div>
  );
}
