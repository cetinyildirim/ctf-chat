import { Router } from 'express';
import { Permission } from '@sydt/shared';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { requireAnyPermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { NotFound } from '../../lib/http-error.js';
import { serializeUser } from '../serializers.js';
import { schemas } from '@sydt/shared';

const router: Router = Router();
router.use(requireAnyPermission(Permission.USER_VIEW_ALL, Permission.USER_BAN, Permission.USER_MUTE));

const idSchema = z.object({ id: z.string().cuid() });

router.get('/', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = await prisma.userReport.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        reporter: { include: { team: true } },
        reported: { include: { team: true } },
        reviewedBy: { include: { team: true } },
      },
    });
    res.json({
      reports: rows.map((r) => ({
        id: r.id,
        reason: r.reason,
        details: r.details,
        contextType: r.contextType,
        contextId: r.contextId,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        reporter: serializeUser(r.reporter),
        reported: serializeUser(r.reported),
        reviewedBy: r.reviewedBy ? serializeUser(r.reviewedBy) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id',
  validate(idSchema, 'params'),
  validate(schemas.patchUserReportSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id!;
      const { status } = req.body as z.infer<typeof schemas.patchUserReportSchema>;
      const existing = await prisma.userReport.findUnique({ where: { id } });
      if (!existing) throw NotFound();

      const updated = await prisma.userReport.update({
        where: { id },
        data: {
          status,
          reviewedAt: new Date(),
          reviewedById: req.user!.id,
        },
        include: {
          reporter: { include: { team: true } },
          reported: { include: { team: true } },
          reviewedBy: { include: { team: true } },
        },
      });

      res.json({
        report: {
          id: updated.id,
          reason: updated.reason,
          details: updated.details,
          contextType: updated.contextType,
          contextId: updated.contextId,
          status: updated.status,
          createdAt: updated.createdAt.toISOString(),
          reviewedAt: updated.reviewedAt?.toISOString() ?? null,
          reporter: serializeUser(updated.reporter),
          reported: serializeUser(updated.reported),
          reviewedBy: updated.reviewedBy ? serializeUser(updated.reviewedBy) : null,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
