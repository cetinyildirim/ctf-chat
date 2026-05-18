import { Router } from 'express';
import { z } from 'zod';
import { schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../lib/audit.js';
import { serializeUser } from '../serializers.js';
import {
  sendAdminMassDm,
  sendAdminPlatformAnnouncement,
} from './broadcasts-admin.service.js';

const router: Router = Router();

const broadcastBodySchema = z.object({
  title: z.string().min(2).max(140),
  body: z.string().min(1).max(4000),
});

function serializeBroadcast(row: {
  id: string;
  kind: string;
  title: string;
  body: string;
  recipientCount: number;
  createdAt: Date;
  createdBy: Parameters<typeof serializeUser>[0] | null;
}) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    recipientCount: row.recipientCount,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy ? serializeUser(row.createdBy) : null,
  };
}

router.get('/history', async (_req, res, next) => {
  try {
    const rows = await prisma.adminBroadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { createdBy: { include: { team: true } } },
    });
    res.json({ broadcasts: rows.map(serializeBroadcast) });
  } catch (err) {
    next(err);
  }
});

router.post('/mass-dm', validate(broadcastBodySchema), async (req, res, next) => {
  try {
    const { title, body } = req.body as z.infer<typeof broadcastBodySchema>;
    const record = await sendAdminMassDm(req.user!.id, title, body);
    await audit({
      actorId: req.user?.id,
      action: 'admin.broadcast.mass_dm',
      target: record.id,
      meta: { title, recipientCount: record.recipientCount },
    });
    res.status(201).json({ broadcast: serializeBroadcast(record) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/announcement',
  validate(schemas.createAnnouncementSchema),
  async (req, res, next) => {
    try {
      const data = req.body as z.infer<typeof schemas.createAnnouncementSchema>;
      const { announcement, broadcast } = await sendAdminPlatformAnnouncement(req.user!.id, {
        title: data.title,
        body: data.body,
        severity: data.severity,
      });
      await audit({
        actorId: req.user?.id,
        action: 'admin.broadcast.announcement',
        target: broadcast.id,
        meta: {
          title: data.title,
          severity: data.severity,
          announcementId: announcement.id,
          recipientCount: broadcast.recipientCount,
        },
      });
      res.status(201).json({
        announcement,
        broadcast: serializeBroadcast(broadcast),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
