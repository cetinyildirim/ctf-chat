import { Router } from 'express';
import { z } from 'zod';
import { Permission, schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeAnnouncement } from '../serializers.js';
import { publishAnnouncementById } from '../../lib/announcement-publish.js';

const router: Router = Router();

router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.announcement.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { author: { include: { team: true } } },
    });
    res.json({ announcements: items.map(serializeAnnouncement) });
  } catch (err) {
    next(err);
  }
});

/**
 * Published "must acknowledge" announcements addressed to me that I have not confirmed yet.
 * Only those published after I joined (the platform for global ones, the server for scoped
 * ones) block the UI; older ones stay readable in the announcement list.
 */
router.get('/pending-ack', async (req, res, next) => {
  try {
    const me = req.user!.id;
    const [account, memberships] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: me }, select: { createdAt: true } }),
      prisma.serverMember.findMany({
        where: { userId: me, bannedAt: null },
        select: { serverId: true, joinedAt: true },
      }),
    ]);
    const now = new Date();
    const items = await prisma.announcement.findMany({
      where: {
        requireAck: true,
        publishedAt: { not: null },
        authorId: { not: me },
        OR: [
          { serverId: null, publishedAt: { gte: account.createdAt } },
          ...memberships.map((m) => ({ serverId: m.serverId, publishedAt: { gte: m.joinedAt } })),
        ],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
        acks: { none: { userId: me } },
      },
      orderBy: { publishedAt: 'asc' },
      take: 20,
      include: { author: { include: { team: true } } },
    });
    res.json({ announcements: items.map(serializeAnnouncement) });
  } catch (err) {
    next(err);
  }
});

const idParamSchema = z.object({ id: z.string().cuid() });

router.post('/:id/ack', validate(idParamSchema, 'params'), async (req, res, next) => {
  try {
    const me = req.user!.id;
    const id = req.params.id!;
    const exists = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw NotFound();
    await prisma.announcementAck.upsert({
      where: { announcementId_userId: { announcementId: id, userId: me } },
      create: { announcementId: id, userId: me },
      update: {},
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requirePermission(Permission.ANNOUNCEMENT_CREATE),
  validate(schemas.createAnnouncementSchema),
  async (req, res, next) => {
    try {
      const data = req.body as ReturnType<typeof schemas.createAnnouncementSchema.parse>;
      const scheduledFor = data.scheduledFor ? new Date(data.scheduledFor) : null;
      const publishNow = !scheduledFor || scheduledFor <= new Date();
      const announcement = await prisma.announcement.create({
        data: {
          title: data.title,
          body: data.body,
          severity: data.severity,
          authorId: req.user!.id,
          scheduledFor,
          requireAck: data.requireAck ?? false,
        },
        include: { author: { include: { team: true } } },
      });
      if (publishNow) await publishAnnouncementById(announcement.id);
      const fresh = await prisma.announcement.findUniqueOrThrow({
        where: { id: announcement.id },
        include: { author: { include: { team: true } } },
      });
      const serialized = serializeAnnouncement(fresh);
      await audit({ actorId: req.user?.id, action: 'announcement.create', target: announcement.id });
      res.status(201).json({ announcement: serialized });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
