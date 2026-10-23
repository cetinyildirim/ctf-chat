'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Announcement,
  Incident,
  Message,
  NotificationDto,
  Ticket,
  TicketDetailResponse,
  TicketEvent,
  UserStatus,
  Channel,
  ChannelsListPayload,
} from '@sydt/shared';
import { Permission, resolveEffectiveNotify } from '@sydt/shared';
import { useAuthStore } from '@/store/auth';
import { usePresenceStore } from '@/store/presence';
import { useNotificationStore } from '@/store/notifications';
import { getSocket, disconnectSocket } from '@/lib/socket/client';
import { queryKeys } from '@/lib/query/client';
import { channelsApi, directApi, notificationsApi } from '@/lib/api/endpoints';
import { useServerStore } from '@/store/server';
import { useChannelUnreadStore } from '@/store/channel-unread';
import { playSound, ensureAudioUnlocked } from '@/lib/notifications/sound';
import { isModerationKind, toStoreNotification } from '@/lib/notifications/use-notification-sync';
import { saveSuspensionNotice } from '@/lib/moderation/messages';
import { useI18n } from '@/components/providers/LocaleProvider';
import { showBrowserNotification } from '@/lib/notifications/browser';
import {
  shouldShowRealtimeAlert,
  shouldShowTicketAlert,
} from '@/lib/notifications/ticket-alert-dedupe';
import { isViewingChannel } from '@/lib/chat/viewing';
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
  const pushRemoteNotification = useNotificationStore((s) => s.pushRemote);
  const markUnread = useChannelUnreadStore((s) => s.markUnread);
  const setUnreadUserId = useChannelUnreadStore((s) => s.setUserId);
  const { t } = useI18n();

  const { data: channelsPayload } = useQuery({
    queryKey: queryKeys.channels(activeServerId ?? ''),
    queryFn: () => channelsApi.list(activeServerId!),
    enabled: !!ready && !!user && !!activeServerId,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    setUnreadUserId(user?.id ?? null);
  }, [user?.id, setUnreadUserId]);

  const subscribedChannelIdsKey = React.useMemo(
    () =>
      (channelsPayload?.channels ?? [])
        .map((c) => c.id)
        .slice()
        .sort()
        .join(','),
    [channelsPayload?.channels],
  );

  React.useEffect(() => {
    ensureAudioUnlocked();
  }, []);

  /** Stay in every accessible channel room so unread + sounds work while browsing elsewhere. */
  React.useEffect(() => {
    if (!ready || !user || !subscribedChannelIdsKey) return;
    const socket = getSocket();
    const ids = subscribedChannelIdsKey.split(',');

    const joinAll = () => {
      for (const channelId of ids) {
        socket.emit('channel:join', channelId);
      }
    };

    if (socket.connected) joinAll();
    socket.on('connect', joinAll);

    return () => {
      socket.off('connect', joinAll);
      for (const channelId of ids) {
        socket.emit('channel:leave', channelId);
      }
    };
  }, [ready, user, subscribedChannelIdsKey]);

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
          if (!prev?.pages.length) return prev;
          // Page 0 is the newest batch (backward pagination). Append there so
          // after MessageList reverses pages the message lands at the bottom.
          const pages = prev.pages.map((p, i) =>
            i === 0
              ? {
                  ...p,
                  messages: [
                    ...p.messages.filter((m) => m.id !== payload.message.id),
                    payload.message,
                  ],
                }
              : p,
          );
          return { ...prev, pages };
        },
      );
      setTyping(payload.channelId, payload.message.authorId, false);
      const inbox = queryClient.getQueryData<{ conversations: Array<{ channelId: string }> }>(
        queryKeys.directConversations,
      );
      if (isViewingChannel(payload.channelId) || inbox?.conversations.some((c) => c.channelId === payload.channelId)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.directConversations });
      }
      if (payload.message.authorId !== user.id) {
        if (!isViewingChannel(payload.channelId)) markUnread(payload.channelId);
      }
      if (
        payload.message.authorId !== user.id &&
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

    const alertOrganizerForNewTicket = (ticket: Ticket) => {
      if (!user?.permissions.includes(Permission.TICKET_VIEW_ALL)) return;
      if (ticket.openedBy.id === user.id) return;
      playSound('ticket');
      if (!shouldShowTicketAlert(`toast:${ticket.id}`)) return;
      const title = `${t.notifyTicketCreated} · ${ticket.code}`;
      toast(title, { description: ticket.title });
      showBrowserNotification(title, ticket.title);
    };

    // Realtime list refresh plus an immediate organizer alert (sound + toast).
    const onTicketCreated = (payload: { ticket: Ticket }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticketsAll });
      alertOrganizerForNewTicket(payload.ticket);
    };

    const patchTicketDetail = (payload: { ticket: Ticket; event?: TicketEvent }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticketsAll });
      queryClient.setQueryData(
        queryKeys.ticket(payload.ticket.id),
        (prev: TicketDetailResponse | undefined) => {
          if (!prev) return prev;
          const events = payload.event
            ? [...prev.events.filter((e) => e.id !== payload.event!.id), payload.event!]
            : prev.events;
          return { ...prev, ticket: payload.ticket, events };
        },
      );
    };

    const onTicketUpdated = patchTicketDetail;

    const onTicketComment = (payload: { ticket: Ticket; event: TicketEvent }) => {
      patchTicketDetail(payload);
      const authorId = payload.event.author?.id;
      // Organizers must hear competitor replies even before the durable inbox event.
      if (
        user?.permissions.includes(Permission.TICKET_VIEW_ALL) &&
        authorId &&
        authorId !== user.id
      ) {
        playSound('ticket');
      }
    };

    /**
     * Durable inbox rows written by the server. The unread badge follows the
     * server's count, so a reload keeps the same state.
     */
    const onNotification = (payload: { notification: NotificationDto; unreadCount: number }) => {
      const item = toStoreNotification(payload.notification, t);
      if (payload.notification.kind === 'DIRECT_MESSAGE' && item.refId) {
        // The server replaced the previous unread row for this conversation.
        const store = useNotificationStore.getState();
        store.removeByRef(item.refId);
        store.pushRemote(item, payload.unreadCount);
        if (isViewingChannel(item.refId)) {
          store.markRead(item.id);
          void notificationsApi.markRead(item.id).catch(() => undefined);
        }
        // Toast + sound come from dm:new.
        return;
      }
      pushRemoteNotification(item, payload.unreadCount);
      if (isModerationKind(payload.notification.kind)) {
        const kind = payload.notification.kind;
        if (kind === 'SERVER_BANNED' || kind === 'SERVER_UNBANNED') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.servers });
          void queryClient.invalidateQueries({ queryKey: queryKeys.channelsAll });
        }
        const lifted = kind === 'USER_UNMUTED' || kind === 'USER_UNBANNED' || kind === 'SERVER_UNBANNED';
        playSound(lifted ? 'mention' : 'incident');
        const show = lifted ? toast.success : toast.warning;
        show(item.title, { description: item.body, duration: lifted ? 6_000 : 15_000 });
        showBrowserNotification(item.title, item.body);
        return;
      }
      const isTicket = payload.notification.kind.startsWith('TICKET');
      if (isTicket) {
        playSound('ticket');
        const ticketId = payload.notification.refId ?? payload.notification.id;
        if (!shouldShowTicketAlert(`toast:${ticketId}`)) return;
        toast(item.title, { description: item.body });
        showBrowserNotification(item.title, item.body);
        return;
      }
      // Live toast/sound: announcement:new may miss on some proxies; inbox is the fallback.
      if (payload.notification.kind === 'ANNOUNCEMENT') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.announcementsPendingAck });
        const annId = payload.notification.refId ?? payload.notification.id;
        if (!shouldShowRealtimeAlert(`announcement:${annId}`)) return;
        playSound('announcement');
        toast(item.title, { description: item.body });
        showBrowserNotification(item.title, item.body);
        return;
      }
      if (payload.notification.kind === 'FRIEND_REQUEST' || payload.notification.kind === 'FRIEND_ACCEPTED') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
        playSound('mention');
        toast(item.title, { description: item.body });
        showBrowserNotification(item.title, item.body);
        return;
      }
      playSound('mention');
    };

    const onIncident = (payload: { incident: Incident }) => {
      if (
        payload.incident.serverId &&
        activeServerId &&
        payload.incident.serverId !== activeServerId
      ) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      pushNotification({
        kind: 'incident',
        title: `${t.incidentToastPrefix}: ${payload.incident.title}`,
        body: payload.incident.description.slice(0, 140),
        href: `/incidents/${payload.incident.id}`,
      });
      playSound('incident');
    };

    const onAnnouncement = (payload: { announcement: Announcement }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements });
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsFeed });
      queryClient.invalidateQueries({ queryKey: queryKeys.announcementsPendingAck });
      // Inbox row comes from durable notification:new — avoid a duplicate local entry.
      const annId = payload.announcement.id;
      if (!shouldShowRealtimeAlert(`announcement:${annId}`)) return;
      playSound('announcement');
      // AnnouncementGate already shows the full text with an OK button.
      if (payload.announcement.requireAck) return;
      toast(payload.announcement.title, { description: payload.announcement.body });
      showBrowserNotification(payload.announcement.title, payload.announcement.body);
    };

    const onChannelCreated = (_payload: { channel: Channel }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.channelsAll });
    };

    const onChannelsRefresh = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.channelsAll });
      // Also fired for team logo changes; message authors embed the team logo URL.
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    };

    const onServersRefresh = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.servers });
      queryClient.invalidateQueries({ queryKey: queryKeys.channelsAll });
    };

    const onMention = (payload: { messageId: string; channelId: string; fromUserId: string; preview: string }) => {
      if (!shouldDeliverMention(payload.channelId)) return;
      pushNotification({
        kind: 'mention',
        title: t.mentionToastTitle,
        body: payload.preview,
        href: `/channels/${payload.channelId}`,
      });
      playSound('mention');
      showBrowserNotification(t.mentionToastTitle, payload.preview);
      toast(t.mentionToastTitle, { description: payload.preview });
    };

    const onDirectMessage = (payload: {
      channelId: string;
      fromDisplayName: string;
      preview: string;
    }) => {
      if (isViewingChannel(payload.channelId)) {
        void directApi
          .markRead(payload.channelId)
          .then(() => {
            useNotificationStore.getState().markReadByRef(payload.channelId);
            return queryClient.invalidateQueries({ queryKey: queryKeys.friends });
          })
          .catch(() => undefined);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      // Same sound kind as message:new so the 700 ms dedupe prevents a double beep.
      playSound('message');
      const title = t.dmNewMessageFrom.replace('{{name}}', payload.fromDisplayName);
      toast(title, { description: payload.preview });
      showBrowserNotification(title, payload.preview);
    };

    /** The server drops this session right after; the login page shows the details. */
    const onSuspended = (payload: { until: string | null; reason: string | null }) => {
      saveSuspensionNotice(payload);
      disconnectSocket();
      useAuthStore.getState().clear();
      window.location.assign('/login');
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
    socket.on('ticket:created', onTicketCreated);
    socket.on('ticket:updated', onTicketUpdated);
    socket.on('ticket:comment', onTicketComment);
    socket.on('notification:new', onNotification);
    socket.on('incident:created', onIncident);
    socket.on('incident:updated', onIncident);
    socket.on('announcement:new', onAnnouncement);
    socket.on('channel:created', onChannelCreated);
    socket.on('channels:refresh', onChannelsRefresh);
    socket.on('servers:refresh', onServersRefresh);
    socket.on('mention:new', onMention);
    socket.on('dm:new', onDirectMessage);
    socket.on('moderation:suspended', onSuspended);

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
      socket.off('ticket:created', onTicketCreated);
      socket.off('ticket:updated', onTicketUpdated);
      socket.off('ticket:comment', onTicketComment);
      socket.off('notification:new', onNotification);
      socket.off('incident:created', onIncident);
      socket.off('incident:updated', onIncident);
      socket.off('announcement:new', onAnnouncement);
      socket.off('channel:created', onChannelCreated);
      socket.off('channels:refresh', onChannelsRefresh);
      socket.off('servers:refresh', onServersRefresh);
      socket.off('mention:new', onMention);
      socket.off('dm:new', onDirectMessage);
      socket.off('moderation:suspended', onSuspended);
    };
  }, [
    ready,
    user,
    activeServerId,
    queryClient,
    setPresences,
    upsertPresence,
    setTyping,
    pushNotification,
    pushRemoteNotification,
    markUnread,
    t,
  ]);

  return null;
}
