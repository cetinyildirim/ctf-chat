import { Router } from 'express';
import { Permission, schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../lib/audit.js';
import { serializeAnnouncement } from '../serializers.js';
import { emitAnnouncement } from '../../realtime/broadcasters.js';

const router: Router = Router();

router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { author: { include: { team: true } } },
    });
    res.json({ announcements: items.map(serializeAnnouncement) });
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
      const announcement = await prisma.announcement.create({
        data: {
          title: data.title,
          body: data.body,
          severity: data.severity,
          authorId: req.user!.id,
          scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
        },
        include: { author: { include: { team: true } } },
      });
      const serialized = serializeAnnouncement(announcement);
      emitAnnouncement(serialized);
      await audit({ actorId: req.user?.id, action: 'announcement.create', target: announcement.id });
      res.status(201).json({ announcement: serialized });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
