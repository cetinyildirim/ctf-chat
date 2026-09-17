/**
 * Notification inbox, mounted at /api/notifications.
 *
 * Rows are always scoped to `req.user.id`; the id in the path is only ever used
 * together with that user filter, so one user can never read or clear another
 * user's inbox.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { NotFound } from '../../lib/http-error.js';
import { serializeNotification } from '../serializers.js';

const router: Router = Router();
router.use(requireAuth);

const listQuery = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

router.get('/', validate(listQuery, 'query'), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof listQuery>;
    const where = {
      userId: req.user!.id,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
    ]);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    res.json({
      notifications: page.map(serializeNotification),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/read-all', async (req, res, next) => {
  try {
    const now = new Date();
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: now },
    });
    res.json({ ok: true, updated: result.count });
  } catch (err) {
    next(err);
  }
});

const idParam = z.object({ id: z.string().cuid() });

router.post('/:id/read', validate(idParam, 'params'), async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id!, userId: req.user!.id },
      data: { readAt: new Date() },
    });
    if (result.count === 0) throw NotFound();
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.id, readAt: null },
    });
    res.json({ ok: true, unreadCount });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', validate(idParam, 'params'), async (req, res, next) => {
  try {
    const result = await prisma.notification.deleteMany({
      where: { id: req.params.id!, userId: req.user!.id },
    });
    if (result.count === 0) throw NotFound();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
