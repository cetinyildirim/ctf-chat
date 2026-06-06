import { prisma } from '../../prisma.js';
import { ensureDirectChannelForBroadcast } from '../direct/direct.service.js';
import { serializeMessage } from '../serializers.js';
import { emitMessageNew } from '../../realtime/broadcasters.js';
import { publishAnnouncementById } from '../../lib/announcement-publish.js';
import { serializeAnnouncement } from '../serializers.js';

const messageInclude = {
  author: { include: { team: true } },
  attachments: true,
  reactions: { select: { emoji: true, userId: true } },
  replyTo: { select: { id: true, authorId: true, content: true } },
  pin: true,
} as const;

export async function sendAdminMassDm(actorId: string, title: string, body: string) {
  const content = `**${title.trim()}**\n\n${body.trim()}`;
  const recipients = await prisma.user.findMany({
    where: { id: { not: actorId }, isBanned: false },
    select: { id: true },
  });

  let sent = 0;
  for (const { id: peerId } of recipients) {
    try {
      const channelId = await ensureDirectChannelForBroadcast(actorId, peerId);
      const message = await prisma.message.create({
        data: {
          channelId,
          authorId: actorId,
          content,
          mentionsJson: '[]',
        },
        include: messageInclude,
      });
      emitMessageNew(channelId, serializeMessage(message));
      sent += 1;
    } catch {
      /* skip users that cannot receive DM */
    }
  }

  return prisma.adminBroadcast.create({
    data: {
      kind: 'MASS_DM',
      title: title.trim(),
      body: body.trim(),
      recipientCount: sent,
      createdById: actorId,
    },
    include: { createdBy: { include: { team: true } } },
  });
}

export async function sendAdminPlatformAnnouncement(
  actorId: string,
  input: { title: string; body: string; severity: string },
) {
  const announcement = await prisma.announcement.create({
    data: {
      title: input.title.trim(),
      body: input.body.trim(),
      severity: input.severity,
      authorId: actorId,
    },
    include: { author: { include: { team: true } } },
  });
  const serialized = (await publishAnnouncementById(announcement.id)) ?? serializeAnnouncement(announcement);

  const userCount = await prisma.user.count({ where: { isBanned: false } });
  const record = await prisma.adminBroadcast.create({
    data: {
      kind: 'PLATFORM_ANNOUNCEMENT',
      title: input.title.trim(),
      body: input.body.trim(),
      recipientCount: userCount,
      createdById: actorId,
    },
    include: { createdBy: { include: { team: true } } },
  });

  return { announcement: serialized, broadcast: record };
}
