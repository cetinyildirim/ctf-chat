/**
 * Durable notification inbox.
 *
 * Writes are fire-and-forget from the caller's perspective: a failing
 * notification must never fail the mutation that triggered it, so every helper
 * swallows its own errors after logging.
 */
import { NotificationKind, Permission, can } from '@sydt/shared';
import { prisma } from '../prisma.js';
import { logger } from './logger.js';
import { serializeNotification } from '../modules/serializers.js';
import { emitNotification } from '../realtime/broadcasters.js';
import { permissionRoleOf } from './user-role.js';

export interface NotifyInput {
  userIds: string[];
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string | null;
  refType?: string | null;
  refId?: string | null;
  serverId?: string | null;
  meta?: Record<string, unknown>;
  /** Users to exclude, typically the actor who caused the event. */
  exceptUserId?: string | null;
}

export async function notifyUsers(input: NotifyInput): Promise<void> {
  const targets = [...new Set(input.userIds.filter((id) => id && id !== input.exceptUserId))];
  if (targets.length === 0) return;

  try {
    for (const userId of targets) {
      const row = await prisma.notification.create({
        data: {
          userId,
          serverId: input.serverId ?? null,
          kind: input.kind,
          title: input.title.slice(0, 200),
          body: (input.body ?? '').slice(0, 500),
          href: input.href ?? null,
          refType: input.refType ?? null,
          refId: input.refId ?? null,
          metaJson: JSON.stringify(input.meta ?? {}),
        },
      });
      const unreadCount = await prisma.notification.count({
        where: { userId, readAt: null },
      });
      emitNotification(userId, serializeNotification(row), unreadCount);
    }
  } catch (err) {
    logger.warn({ err, kind: input.kind }, 'notification delivery failed');
  }
}

/**
 * One inbox row per DM conversation: each new message replaces the previous
 * unread row so a chatty friend does not flood the inbox.
 */
export async function notifyDirectMessage(input: {
  userId: string;
  channelId: string;
  fromDisplayName: string;
  fromUsername: string;
  preview: string;
}): Promise<void> {
  try {
    const participant = await prisma.channelDmParticipant.findUnique({
      where: { channelId_userId: { channelId: input.channelId, userId: input.userId } },
      select: { lastReadAt: true },
    });
    const count = await prisma.message.count({
      where: {
        channelId: input.channelId,
        authorId: { not: input.userId },
        deletedAt: null,
        ...(participant?.lastReadAt ? { createdAt: { gt: participant.lastReadAt } } : {}),
      },
    });
    await prisma.notification.deleteMany({
      where: {
        userId: input.userId,
        kind: NotificationKind.DIRECT_MESSAGE,
        refId: input.channelId,
        readAt: null,
      },
    });
    const row = await prisma.notification.create({
      data: {
        userId: input.userId,
        kind: NotificationKind.DIRECT_MESSAGE,
        title:
          count > 1
            ? `${input.fromDisplayName} sent you ${count} messages`
            : `${input.fromDisplayName} sent you a message`,
        body: input.preview.slice(0, 500),
        href: `/channels/${input.channelId}`,
        refType: 'channel',
        refId: input.channelId,
        metaJson: JSON.stringify({
          displayName: input.fromDisplayName,
          username: input.fromUsername,
          count,
        }),
      },
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: input.userId, readAt: null },
    });
    emitNotification(input.userId, serializeNotification(row), unreadCount);
  } catch (err) {
    logger.warn({ err }, 'direct message notification failed');
  }
}

/**
 * Everyone who should be alerted about a new ticket in this competition:
 * members with TICKET_VIEW_ALL (honoring platformRole), plus platform super-admins.
 */
export async function organizerIdsForServer(serverId: string): Promise<string[]> {
  const members = await prisma.serverMember.findMany({
    where: {
      serverId,
      bannedAt: null,
      user: { isBanned: false },
    },
    select: {
      userId: true,
      user: { select: { role: true, platformRole: true } },
    },
  });
  const ids = members
    .filter((m) => can(permissionRoleOf(m.user), Permission.TICKET_VIEW_ALL))
    .map((m) => m.userId);

  const superAdmins = await prisma.user.findMany({
    where: {
      isBanned: false,
      OR: [{ role: 'SUPER_ADMIN' }, { platformRole: 'SUPER_ADMIN' }],
    },
    select: { id: true },
  });
  for (const row of superAdmins) ids.push(row.id);

  return [...new Set(ids)];
}

/**
 * Everyone on the competitor side of a ticket: the reporter plus their team
 * inside that competition (never the global team, which spans competitions).
 */
export async function competitorIdsForTicket(ticket: {
  serverId: string;
  openedById: string;
  teamId: string | null;
}): Promise<string[]> {
  const ids = [ticket.openedById];
  if (ticket.teamId) {
    const mates = await prisma.serverTeamMember.findMany({
      where: { serverId: ticket.serverId, teamId: ticket.teamId },
      select: { userId: true },
    });
    ids.push(...mates.map((m) => m.userId));
  }
  return [...new Set(ids)];
}
