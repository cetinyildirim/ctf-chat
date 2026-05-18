import { Router } from 'express';
import { schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import type { z } from 'zod';

const router: Router = Router();

router.use(requireAuth);

router.post('/', validate(schemas.createUserReportSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof schemas.createUserReportSchema>;
    const reporterId = req.user!.id;
    if (body.reportedUserId === reporterId) throw BadRequest('Cannot report yourself');

    const reported = await prisma.user.findUnique({ where: { id: body.reportedUserId } });
    if (!reported) throw NotFound('User not found');

    const report = await prisma.userReport.create({
      data: {
        reporterId,
        reportedId: body.reportedUserId,
        reason: body.reason.trim(),
        details: body.details.trim(),
        contextType: body.contextType ?? 'PROFILE',
        contextId: body.contextId ?? null,
      },
    });

    await audit({
      actorId: reporterId,
      action: 'user.report',
      target: report.id,
      meta: {
        reportedId: reported.id,
        username: reported.username,
        reason: report.reason,
      },
    });

    res.status(201).json({ ok: true, reportId: report.id });
  } catch (err) {
    next(err);
  }
});

export default router;
