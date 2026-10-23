/**
 * Tells users about moderation actions taken against them.
 *
 * Rows keep an English headline (logs/webhooks); the web client rebuilds the
 * localized text from `kind` + `meta` ({ minutes, until, reason, serverName }).
 */
import { NotificationKind } from '@sydt/shared';
import { prisma } from '../prisma.js';
import { logger } from './logger.js';
import { notifyUsers } from './notify.js';
import { audit } from './audit.js';
import { getIO } from '../realtime/io.js';
import { room } from '../realtime/rooms.js';

function withReason(text: string, reason: string | null | undefined) {
  return reason ? `${text} Reason: ${reason}` : text;
}

export async function notifyUserMuted(
  userId: string,
  input: { until: Date; minutes: number; reason: string | null },
) {
  await notifyUsers({
    userIds: [userId],
    kind: NotificationKind.USER_MUTED,
    title: 'You have been muted',
    body: withReason(
      `You cannot send messages for ${input.minutes} minute(s), until ${input.until.toISOString()}.`,
      input.reason,
    ),
    refType: 'moderation',
    meta: { minutes: input.minutes, until: input.until.toISOString(), reason: input.reason },
  });
}

export async function notifyUserUnmuted(userId: string) {
  await notifyUsers({
    userIds: [userId],
    kind: NotificationKind.USER_UNMUTED,
    title: 'Your mute has been lifted',
    body: 'You can send messages again.',
    refType: 'moderation',
  });
}

/**
 * The inbox row is only visible once the ban ends; the live session learns about
 * the ban through `moderation:suspended` just before its sockets are dropped.
 */
export async function notifyUserBanned(
  userId: string,
  input: { until: Date | null; minutes: number | null; reason: string | null },
) {
  await notifyUsers({
    userIds: [userId],
    kind: NotificationKind.USER_BANNED,
    title: 'Your account has been suspended',
    body: withReason(
      input.until
        ? `You cannot use the platform until ${input.until.toISOString()}.`
        : 'Your account is suspended until further notice.',
      input.reason,
    ),
    refType: 'moderation',
    meta: { minutes: input.minutes, until: input.until?.toISOString() ?? null, reason: input.reason },
  });
  try {
    const io = getIO();
    io.to(room.user(userId)).emit('moderation:suspended', {
      until: input.until?.toISOString() ?? null,
      reason: input.reason,
    });
    setTimeout(() => io.in(room.user(userId)).disconnectSockets(true), 1_500).unref?.();
  } catch (err) {
    logger.warn({ err }, 'suspension broadcast failed');
  }
}

export async function notifyUserUnbanned(userId: string, input: { expired: boolean }) {
  await notifyUsers({
    userIds: [userId],
    kind: NotificationKind.USER_UNBANNED,
    title: input.expired ? 'Your suspension has ended' : 'Your suspension has been lifted',
    body: 'You can use the platform again.',
    refType: 'moderation',
    meta: { expired: input.expired },
  });
}

export async function notifyServerBanned(
  userId: string,
  input: { serverId: string; serverName: string; reason: string | null },
) {
  await notifyUsers({
    userIds: [userId],
    kind: NotificationKind.SERVER_BANNED,
    title: `You have been removed from ${input.serverName}`,
    body: withReason('You can no longer use this server.', input.reason),
    refType: 'server',
    refId: input.serverId,
    meta: { serverName: input.serverName, reason: input.reason },
  });
}

export async function notifyServerUnbanned(userId: string, input: { serverId: string; serverName: string }) {
  await notifyUsers({
    userIds: [userId],
    kind: NotificationKind.SERVER_UNBANNED,
    title: `Your ban on ${input.serverName} has been lifted`,
    body: 'You can use this server again.',
    refType: 'server',
    refId: input.serverId,
    meta: { serverName: input.serverName },
  });
}

/** Lifts a timed ban whose end has passed. Returns true when the user was unbanned. */
export async function liftExpiredBan(userId: string): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: { id: userId, isBanned: true, bannedUntil: { lte: new Date() } },
    data: { isBanned: false, bannedUntil: null, banReason: null },
  });
  if (count === 0) return false;
  await audit({ action: 'user.moderation.ban_expired', target: userId, meta: { isBanned: false } });
  await notifyUserUnbanned(userId, { expired: true });
  return true;
}

export function startBanExpiryJob() {
  const tick = async () => {
    const due = await prisma.user.findMany({
      where: { isBanned: true, bannedUntil: { lte: new Date() } },
      select: { id: true },
      take: 100,
    });
    for (const u of due) await liftExpiredBan(u.id);
  };
  setInterval(() => {
    void tick().catch((err) => logger.warn({ err }, 'ban expiry job failed'));
  }, 60_000).unref?.();
}
