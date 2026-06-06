import { prisma } from '../prisma.js';
import { serializeAnnouncement } from '../modules/serializers.js';
import { emitAnnouncement } from '../realtime/broadcasters.js';
import { dispatchServerWebhooks } from './server-webhooks.js';

export async function publishAnnouncementById(id: string) {
  const row = await prisma.announcement.findUnique({
    where: { id },
    include: { author: { include: { team: true } } },
  });
  if (!row) return null;

  const updated =
    row.publishedAt != null
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

  return serialized;
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
