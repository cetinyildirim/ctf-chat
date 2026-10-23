'use client';

import * as React from 'react';
import type { NotificationDto } from '@sydt/shared';
import { notificationsApi } from '@/lib/api/endpoints';
import { useNotificationStore, type Notification } from '@/store/notifications';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/components/providers/LocaleProvider';
import type { Dict } from '@/i18n/dict';
import { ticketStatusLabel } from '@/i18n/ticket-labels';
import {
  formatModerationDuration,
  formatModerationUntil,
  withReason,
} from '@/lib/moderation/messages';

const metaString = (dto: NotificationDto, key: string): string | null =>
  typeof dto.meta[key] === 'string' ? (dto.meta[key] as string) : null;

/**
 * Notification rows are stored with English headlines so webhooks and logs stay
 * stable; the inbox rebuilds them from `kind` + `meta` in the viewer's locale
 * and only falls back to the stored text when the meta is missing.
 */
function localizedTitle(dto: NotificationDto, t: Dict): string {
  const code = metaString(dto, 'code');
  const withCode = (label: string) => (code ? `${label} · ${code}` : label);

  switch (dto.kind) {
    case 'TICKET_CREATED':
      return withCode(t.notifyTicketCreated);
    case 'TICKET_REPLY':
      return withCode(t.notifyTicketReply);
    case 'TICKET_ASSIGNED':
      return withCode(t.notifyTicketAssigned);
    case 'TICKET_CRITICAL':
      return withCode(dto.meta.escalated ? t.notifyTicketEscalated : t.notifyTicketCritical);
    case 'TICKET_STATUS':
    case 'TICKET_RESOLVED':
    case 'TICKET_REOPENED': {
      const to = metaString(dto, 'to');
      if (!to) return dto.title;
      return code ? `${code} · ${ticketStatusLabel(t, to)}` : ticketStatusLabel(t, to);
    }
    case 'TICKET_MULTI_TEAM': {
      const teamCount = typeof dto.meta.teamCount === 'number' ? dto.meta.teamCount : null;
      const challenge = metaString(dto, 'challengeTitle');
      if (teamCount === null) return dto.title;
      const headline = `${teamCount} ${t.notifyTicketMultiTeam}`;
      return challenge ? `${headline} · ${challenge}` : headline;
    }
    case 'FRIEND_REQUEST':
    case 'FRIEND_ACCEPTED': {
      const name = metaString(dto, 'displayName');
      if (!name) return dto.title;
      const template = dto.kind === 'FRIEND_REQUEST' ? t.notifyFriendRequest : t.notifyFriendAccepted;
      return template.replace('{{name}}', name);
    }
    case 'DIRECT_MESSAGE': {
      const name = metaString(dto, 'displayName');
      if (!name) return dto.title;
      const count = typeof dto.meta.count === 'number' ? dto.meta.count : 1;
      return count > 1
        ? t.dmNewMessagesFrom.replace('{{name}}', name).replace('{{count}}', String(count))
        : t.dmNewMessageFrom.replace('{{name}}', name);
    }
    case 'USER_MUTED':
      return t.notifyUserMutedTitle;
    case 'USER_UNMUTED':
      return t.notifyUserUnmutedTitle;
    case 'USER_BANNED':
      return t.notifyUserBannedTitle;
    case 'USER_UNBANNED':
      return dto.meta.expired ? t.notifyUserUnbannedExpiredTitle : t.notifyUserUnbannedTitle;
    case 'SERVER_BANNED':
    case 'SERVER_UNBANNED': {
      const server = metaString(dto, 'serverName');
      if (!server) return dto.title;
      const template = dto.kind === 'SERVER_BANNED' ? t.notifyServerBannedTitle : t.notifyServerUnbannedTitle;
      return template.replace('{{server}}', server);
    }
    default:
      return dto.title;
  }
}

function localizedBody(dto: NotificationDto, t: Dict): string {
  const reason = metaString(dto, 'reason');
  const until = metaString(dto, 'until');
  const minutes = typeof dto.meta.minutes === 'number' ? dto.meta.minutes : null;
  const timed = (template: string) =>
    until && minutes
      ? template
          .replace('{{duration}}', formatModerationDuration(minutes, t))
          .replace('{{until}}', formatModerationUntil(until, t))
      : null;

  switch (dto.kind) {
    case 'USER_MUTED': {
      const text = timed(t.notifyUserMutedBody);
      return text ? withReason(text, reason, t) : dto.body;
    }
    case 'USER_UNMUTED':
      return t.notifyUserUnmutedBody;
    case 'USER_BANNED':
      return withReason(timed(t.notifyUserBannedBody) ?? '', reason, t).trim() || dto.body;
    case 'USER_UNBANNED':
      return t.notifyUserUnbannedBody;
    case 'SERVER_BANNED':
      return withReason(t.notifyServerBannedBody, reason, t);
    case 'SERVER_UNBANNED':
      return t.notifyServerUnbannedBody;
    case 'TICKET_MULTI_TEAM':
      return dto.body.replace(/^Latest: /, `${t.notifyTicketLatest}: `);
    default:
      return dto.body;
  }
}

export function isModerationKind(kind: string): boolean {
  return kind.startsWith('USER_') || kind.startsWith('SERVER_');
}

/** Server notification kinds collapse onto the store's display kinds. */
export function toStoreNotification(dto: NotificationDto, t: Dict): Notification {
  const kind: Notification['kind'] = dto.kind.startsWith('TICKET')
    ? 'ticket'
    : dto.kind === 'ANNOUNCEMENT'
      ? 'announcement'
      : dto.kind === 'MENTION' || dto.kind === 'DIRECT_MESSAGE'
        ? 'mention'
        : 'system';
  return {
    id: dto.id,
    kind,
    title: localizedTitle(dto, t),
    body: localizedBody(dto, t),
    ...(dto.href ? { href: dto.href } : {}),
    ...(dto.refId ? { refId: dto.refId } : {}),
    createdAt: dto.createdAt,
    read: dto.read,
    remote: true,
  };
}

/**
 * Keeps the ephemeral notification store in step with the durable inbox:
 * hydrates it once per session and routes read/dismiss actions to the API so
 * the state survives a reload.
 */
export function useNotificationSync() {
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const hydrate = useNotificationStore((s) => s.hydrate);
  const markReadLocal = useNotificationStore((s) => s.markRead);
  const markAllReadLocal = useNotificationStore((s) => s.markAllRead);
  const removeLocal = useNotificationStore((s) => s.remove);
  const items = useNotificationStore((s) => s.items);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void notificationsApi
      .list({ limit: 30 })
      .then((page) => {
        if (!cancelled) hydrate(page.notifications.map((dto) => toStoreNotification(dto, t)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, hydrate, t]);

  const isRemote = React.useCallback(
    (id: string) => items.find((i) => i.id === id)?.remote === true,
    [items],
  );

  const markRead = React.useCallback(
    (id: string) => {
      markReadLocal(id);
      if (isRemote(id)) void notificationsApi.markRead(id).catch(() => undefined);
    },
    [isRemote, markReadLocal],
  );

  const markAllRead = React.useCallback(() => {
    markAllReadLocal();
    void notificationsApi.markAllRead().catch(() => undefined);
  }, [markAllReadLocal]);

  const dismiss = React.useCallback(
    (id: string) => {
      const remote = isRemote(id);
      removeLocal(id);
      if (remote) void notificationsApi.remove(id).catch(() => undefined);
    },
    [isRemote, removeLocal],
  );

  return { markRead, markAllRead, dismiss };
}
