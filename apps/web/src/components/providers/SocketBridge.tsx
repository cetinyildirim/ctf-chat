'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  Announcement,
  Incident,
  Message,
  ScoreboardEntry,
  Ticket,
  TicketEvent,
  UserStatus,
  Channel,
  ChannelsListPayload,
} from '@sydt/shared';
import { resolveEffectiveNotify } from '@sydt/shared';
import { useAuthStore } from '@/store/auth';
import { usePresenceStore } from '@/store/presence';
import { useNotificationStore } from '@/store/notifications';
import { getSocket, disconnectSocket } from '@/lib/socket/client';
import { queryKeys } from '@/lib/query/client';
import { useServerStore } from '@/store/server';
import { playSound } from '@/lib/notifications/sound';
import { showBrowserNotification } from '@/lib/notifications/browser';
import { toast } from 'sonner';

export function SocketBridge() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const queryClient = useQueryClient();
  const setPresences = usePresenceStore((s) => s.setPresences);
  const upsertPresence = usePresenceStore((s) => s.upsertPresence);
  const setTyping = usePresenceStore((s) => s.setTyping);
  const pushNotification = useNotificationStore((s) => s.push);
  const soundEnabled = useNotificationStore((s) => s.soundEnabled);
  const dnd = useNotificationStore((s) => s.dnd);

  React.useEffect(() => {
    if (!ready) return;
    if (!user) {
      disconnectSocket();
      return;
    }
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const onConnect = () => {
      socket.emit('presence:heartbeat', { status: 'ONLINE' });
    };
    const onConnectError = (err: Error) => {
      console.warn('socket error', err.message);
    };

    const notifyForChannel = (channelId: string) => {
      const cached = queryClient.getQueryData<ChannelsListPayload>(
        queryKeys.channels(activeServerId ?? ''),
      );
      const prefs = cached?.notificationPrefs;
      const listDefault = prefs?.defaultNotifyMode ?? user.defaultNotifyMode;
      const stored = prefs?.overrides[channelId];
      return resolveEffectiveNotify(stored, listDefault);
    };

    const shouldPlayGeneralMessageSound = (channelId: string) => notifyForChannel(channelId) === 'ALL';

    const shouldDeliverMention = (channelId: string) => {
      const mode = notifyForChannel(channelId);
      return mode === 'ALL' || mode === 'MENTIONS_ONLY';
    };

    const onMessageNew = (payload: { channelId: string; message: Message }) => {
      queryClient.setQueryData<{ pages: Array<{ messages: Message[]; nextCursor: string | null; hasMore: boolean }>; pageParams: unknown[] }>(
        queryKeys.messages(payload.channelId),
        (prev) => {
          if (!prev) return prev;
          const pages = prev.pages.map((p, i) =>
            i === prev.pages.length - 1
              ? { ...p, messages: [...p.messages.filter((m) => m.id !== payload.message.id), payload.message] }
              : p,
          );
          return { ...prev, pages };
        },
      );
      if (
        payload.message.authorId !== user.id &&
        soundEnabled &&
        !dnd &&
        shouldPlayGeneralMessageSound(payload.channelId)
      )
        playSound('message');
    };

    const onMessageEdit = (payload: { channelId: string; message: Message }) => {
      queryClient.setQueryData<{ pages: Array<{ messages: Message[]; nextCursor: string | null; hasMore: boolean }>; pageParams: unknown[] }>(
        queryKeys.messages(payload.channelId),
        (prev) => {
          if (!prev) return prev;
          const pages = prev.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) => (m.id === payload.message.id ? payload.message : m)),
          }));
          return { ...prev, pages };
        },
      );
    };

    const onMessageDelete = (payload: { channelId: string; messageId: string }) => {
      queryClient.setQueryData<{ pages: Array<{ messages: Message[]; nextCursor: string | null; hasMore: boolean }>; pageParams: unknown[] }>(
        queryKeys.messages(payload.channelId),
        (prev) => {
          if (!prev) return prev;
          const pages = prev.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) =>
              m.id === payload.messageId ? { ...m, content: '', deletedAt: new Date().toISOString() } : m,
            ),
          }));
          return { ...prev, pages };
        },
      );
    };

    const onMessageReact = (payload: { channelId: string; messageId: string; reactions: Message['reactions'] }) => {
      queryClient.setQueryData<{ pages: Array<{ messages: Message[]; nextCursor: string | null; hasMore: boolean }>; pageParams: unknown[] }>(
        queryKeys.messages(payload.channelId),
        (prev) => {
          if (!prev) return prev;
          const pages = prev.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m) =>
              m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m,
            ),
          }));
          return { ...prev, pages };
        },
      );
    };

    const onTypingStart = (payload: { channelId: string; userId: string }) => {
      setTyping(payload.channelId, payload.userId, true);
    };
    const onTypingStop = (payload: { channelId: string; userId: string }) => {
      setTyping(payload.channelId, payload.userId, false);
    };

    const onPresence = (payload: { presences: Array<{ userId: string; status: UserStatus; lastSeen: string }> }) => {
      setPresences(payload.presences);
    };

    const onScoreboard = (payload: { generatedAt: string; entries: ScoreboardEntry[] }) => {
      queryClient.setQueryData(queryKeys.scoreboard, (prev: unknown) => {
        const base = (prev as { totalChallenges?: number; totalTeams?: number }) ?? {};
        return {
          generatedAt: payload.generatedAt,
          entries: payload.entries,
          totalChallenges: base.totalChallenges ?? 0,
          totalTeams: payload.entries.length,
        };
      });
    };

    const onTicketCreated = (payload: { ticket: Ticket }) => {
      queryClient.setQueryData<Ticket[]>(queryKeys.tickets, (prev) => {
        const list = prev ?? [];
        if (list.some((t) => t.id === payload.ticket.id)) return list;
        return [payload.ticket, ...list];
      });
      pushNotification({
        kind: 'ticket',
        title: `New ticket · ${payload.ticket.code}`,
        body: payload.ticket.title,
        href: `/tickets/${payload.ticket.id}`,
      });
      if (soundEnabled && !dnd) playSound('ticket');
      showBrowserNotification(`Ticket ${payload.ticket.code}`, payload.ticket.title);
      toast.info(`Ticket ${payload.ticket.code} opened`, { description: payload.ticket.title });
    };

    const onTicketUpdated = (payload: { ticket: Ticket; event?: TicketEvent }) => {
      queryClient.setQueryData<Ticket[]>(queryKeys.tickets, (prev) =>
        (prev ?? []).map((t) => (t.id === payload.ticket.id ? payload.ticket : t)),
      );
      queryClient.setQueryData(
        queryKeys.ticket(payload.ticket.id),
        (prev: { ticket: Ticket; events: TicketEvent[] } | undefined) => {
          if (!prev) return prev;
          const events = payload.event
            ? [...prev.events.filter((e) => e.id !== payload.event!.id), payload.event!]
            : prev.events;
          return { ticket: payload.ticket, events };
        },
      );
    };

    const onIncident = (payload: { incident: Incident }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incidents });
      pushNotification({
        kind: 'incident',
        title: `Incident: ${payload.incident.title}`,
        body: payload.incident.description.slice(0, 140),
        href: `/incidents/${payload.incident.id}`,
      });
      if (soundEnabled && !dnd) playSound('incident');
    };

    const onAnnouncement = (payload: { announcement: Announcement }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements });
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsFeed });
      const annHref = `/notifications?announcement=${payload.announcement.id}`;
      pushNotification({
        kind: 'announcement',
        title: payload.announcement.title,
        body: payload.announcement.body.slice(0, 200),
        href: annHref,
        refId: payload.announcement.id,
      });
      if (soundEnabled && !dnd) playSound('announcement');
      toast(payload.announcement.title, { description: payload.announcement.body });
      showBrowserNotification(payload.announcement.title, payload.announcement.body);
    };

    const onChannelCreated = (_payload: { channel: Channel }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.channelsAll });
    };

    const onChannelsRefresh = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.channelsAll });
    };

    const onMention = (payload: { messageId: string; channelId: string; fromUserId: string; preview: string }) => {
      if (!shouldDeliverMention(payload.channelId)) return;
      pushNotification({
        kind: 'mention',
        title: 'You were mentioned',
        body: payload.preview,
        href: `/channels/${payload.channelId}`,
      });
      if (soundEnabled && !dnd) playSound('mention');
      showBrowserNotification('You were mentioned', payload.preview);
      toast('You were mentioned', { description: payload.preview });
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('message:new', onMessageNew);
    socket.on('message:edit', onMessageEdit);
    socket.on('message:delete', onMessageDelete);
    socket.on('message:react', onMessageReact);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('presence:update', onPresence);
    socket.on('scoreboard:update', onScoreboard);
    socket.on('ticket:created', onTicketCreated);
    socket.on('ticket:updated', onTicketUpdated);
    socket.on('incident:created', onIncident);
    socket.on('incident:updated', onIncident);
    socket.on('announcement:new', onAnnouncement);
    socket.on('channel:created', onChannelCreated);
    socket.on('channels:refresh', onChannelsRefresh);
    socket.on('mention:new', onMention);

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('message:new', onMessageNew);
      socket.off('message:edit', onMessageEdit);
      socket.off('message:delete', onMessageDelete);
      socket.off('message:react', onMessageReact);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('presence:update', onPresence);
      socket.off('scoreboard:update', onScoreboard);
      socket.off('ticket:created', onTicketCreated);
      socket.off('ticket:updated', onTicketUpdated);
      socket.off('incident:created', onIncident);
      socket.off('incident:updated', onIncident);
      socket.off('announcement:new', onAnnouncement);
      socket.off('channel:created', onChannelCreated);
      socket.off('channels:refresh', onChannelsRefresh);
      socket.off('mention:new', onMention);
    };
  }, [ready, user, activeServerId, queryClient, setPresences, upsertPresence, setTyping, pushNotification, soundEnabled, dnd]);

  return null;
}
