import { NotificationKind } from '@sydt/shared';
import { prisma } from '../prisma.js';
import { serializeAnnouncement } from '../modules/serializers.js';
import { emitAnnouncement } from '../realtime/broadcasters.js';
import { dispatchServerWebhooks } from './server-webhooks.js';
import { notifyUsers } from './notify.js';
import { logger } from './logger.js';

export async function publishAnnouncementById(id: string) {
  const row = await prisma.announcement.findUnique({
    where: { id },
    include: { author: { include: { team: true } } },
  });
  if (!row) return null;

  const wasAlreadyPublished = row.publishedAt != null;
  const updated =
    wasAlreadyPublished
      ? row
      : await prisma.announcement.update({
          where: { id },
          data: { publishedAt: new Date() },
          include: { author: { include: { team: true } } },
        });

  const serialized = serializeAnnouncement(updated);
  emitAnnouncement(serialized, updated.serverId ?? undefined);

  if (updated.serverId) {
    await dispatchServerWebhooks(updated.serverId, 'announcement.publish', {
      announcement: serialized,
    });
  }

  // Durable inbox + live notification:new (offline users catch up on next open).
  // Skip re-notify when scheduler/idempotent re-publish hits an already-published row.
  if (!wasAlreadyPublished) {
    void notifyAnnouncementRecipients({
      announcementId: updated.id,
      title: updated.title,
      body: updated.body,
      serverId: updated.serverId,
      authorId: updated.authorId,
    }).catch((err) => logger.warn({ err, id }, 'announcement notify failed'));
  }

  return serialized;
}

async function notifyAnnouncementRecipients(input: {
  announcementId: string;
  title: string;
  body: string;
  serverId: string | null;
  authorId: string;
}) {
  const href = `/notifications?announcement=${input.announcementId}`;
  let userIds: string[];

  if (input.serverId) {
    const members = await prisma.serverMember.findMany({
      where: { serverId: input.serverId, bannedAt: null, user: { isBanned: false } },
      select: { userId: true },
    });
    userIds = members.map((m) => m.userId);
  } else {
    const users = await prisma.user.findMany({
      where: { isBanned: false },
      select: { id: true },
    });
    userIds = users.map((u) => u.id);
  }

  await notifyUsers({
    userIds,
    kind: NotificationKind.ANNOUNCEMENT,
    title: input.title,
    body: input.body.slice(0, 500),
    href,
    refType: 'announcement',
    refId: input.announcementId,
    serverId: input.serverId,
    exceptUserId: input.authorId,
  });
}

export async function publishDueAnnouncements() {
  const now = new Date();
  const due = await prisma.announcement.findMany({
    where: {
      publishedAt: null,
      scheduledFor: { lte: now },
    },
    select: { id: true },
    take: 20,
  });
  for (const row of due) {
    await publishAnnouncementById(row.id);
  }
}
