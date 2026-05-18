import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { Permission } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';
import { serializeUser } from '../serializers.js';
import { snapshot } from '../../realtime/presence.js';
import { importCtfdChallengesCsv } from './ctfd-import.service.js';
import type { ActivityBucket, AuditLogEntry, KPISnapshot } from '@sydt/shared';
import teamsAdminRouter from './teams-admin.router.js';
import surveysAdminRouter from './surveys-admin.router.js';
import usersAdminRouter from './users-admin.router.js';
import {
  getPlatformBranding,
  getUploadMaxMb,
  setPlatformBranding,
  setUploadMaxMb,
} from '../../lib/platform-settings.js';
import broadcastsAdminRouter from './broadcasts-admin.router.js';
import reportsAdminRouter from './reports-admin.router.js';
import { validate } from '../../middleware/validate.js';
import { schemas } from '@sydt/shared';
import { audit } from '../../lib/audit.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const router: Router = Router();

router.use(requireAuth);

router.get(
  '/runtime',
  requireAnyPermission(Permission.ADMIN_DASHBOARD, Permission.CATEGORY_MANAGE, Permission.CHANNEL_CREATE),
  async (_req, res) => {
    res.json({
      nodeEnv: env.NODE_ENV,
      uploadMaxMb: await getUploadMaxMb(),
      uploadDir: env.UPLOAD_DIR,
      accessTokenTtlSec: env.ACCESS_TOKEN_TTL,
      refreshTokenTtlSec: env.REFRESH_TOKEN_TTL,
      cookieSecure: env.COOKIE_SECURE,
      corsOrigin: env.CORS_ORIGIN,
    });
  },
);

router.use('/teams', teamsAdminRouter);

router.use(requirePermission(Permission.ADMIN_DASHBOARD));

router.get('/system', async (_req, res, next) => {
  try {
    const presences = snapshot();
    const onlineUserIds = presences.filter((p) => p.status !== 'OFFLINE').map((p) => p.userId);
    const [
      userCount,
      bannedCount,
      teamCount,
      channelCount,
      messageCount,
      auditCount,
      activeSurveys,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.team.count(),
      prisma.channel.count(),
      prisma.message.count({ where: { deletedAt: null } }),
      prisma.auditLog.count(),
      prisma.survey.count({ where: { isActive: true } }),
    ]);
    res.json({
      userCount,
      bannedCount,
      teamCount,
      channelCount,
      messageCount,
      auditCount,
      activeSurveys,
      onlineUsers: onlineUserIds.length,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/kpis', async (_req, res, next) => {
  try {
    const now = new Date();
    const oneMinAgo = new Date(now.getTime() - 60_000);

    const [messagesLastMinute, openTickets, openIncidents, totalSolves] = await Promise.all([
      prisma.message.count({ where: { createdAt: { gte: oneMinAgo }, deletedAt: null } }),
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'CLAIMED', 'IN_PROGRESS'] } } }),
      prisma.incident.count({ where: { status: { in: ['OPEN', 'INVESTIGATING'] } } }),
      prisma.solve.count(),
    ]);

    const presences = snapshot();
    const activeUsers = presences.filter((p) => p.status !== 'OFFLINE').length;
    const onlineUserIds = new Set(presences.filter((p) => p.status !== 'OFFLINE').map((p) => p.userId));
    const onlineUsers = await prisma.user.findMany({
      where: { id: { in: Array.from(onlineUserIds) } },
      select: { teamId: true },
    });
    const onlineTeams = new Set(onlineUsers.map((u) => u.teamId).filter(Boolean)).size;

    const snap: KPISnapshot = {
      activeUsers,
      onlineTeams,
      messagesLastMinute,
      openTickets,
      openIncidents,
      totalSolves,
      generatedAt: now.toISOString(),
    };
    res.json(snap);
  } catch (err) {
    next(err);
  }
});

router.get('/activity', async (_req, res, next) => {
  try {
    const now = Date.now();
    const buckets: ActivityBucket[] = [];
    const bucketCount = 24;
    const bucketMs = 5 * 60_000;
    for (let i = bucketCount - 1; i >= 0; i--) {
      const start = new Date(now - (i + 1) * bucketMs);
      const end = new Date(now - i * bucketMs);
      const [messages, solves, tickets] = await Promise.all([
        prisma.message.count({ where: { createdAt: { gte: start, lt: end }, deletedAt: null } }),
        prisma.solve.count({ where: { solvedAt: { gte: start, lt: end } } }),
        prisma.ticket.count({ where: { createdAt: { gte: start, lt: end } } }),
      ]);
      buckets.push({
        at: end.toISOString(),
        messages,
        solves,
        tickets,
      });
    }
    res.json({ buckets });
  } catch (err) {
    next(err);
  }
});

const auditQuerySchema = {
  q: (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
  action: (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
  actorId: (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
  target: (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
  from: (v: unknown) => (typeof v === 'string' && v ? new Date(v) : undefined),
  to: (v: unknown) => (typeof v === 'string' && v ? new Date(v) : undefined),
  limit: (v: unknown) => {
    const n = typeof v === 'string' ? parseInt(v, 10) : 100;
    return Number.isFinite(n) ? Math.min(500, Math.max(1, n)) : 100;
  },
  offset: (v: unknown) => {
    const n = typeof v === 'string' ? parseInt(v, 10) : 0;
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  },
};

router.get('/audit/actions', requirePermission(Permission.AUDIT_LOG_VIEW), async (_req, res, next) => {
  try {
    const rows = await prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    res.json({ actions: rows.map((r) => r.action) });
  } catch (err) {
    next(err);
  }
});

router.get('/audit', requirePermission(Permission.AUDIT_LOG_VIEW), async (req, res, next) => {
  try {
    const q = auditQuerySchema.q(req.query.q);
    const action = auditQuerySchema.action(req.query.action);
    const actorId = auditQuerySchema.actorId(req.query.actorId);
    const target = auditQuerySchema.target(req.query.target);
    const from = auditQuerySchema.from(req.query.from);
    const to = auditQuerySchema.to(req.query.to);
    const limit = auditQuerySchema.limit(req.query.limit);
    const offset = auditQuerySchema.offset(req.query.offset);

    const where = {
      AND: [
        action ? { action } : {},
        actorId ? { actorId } : {},
        target ? { target: { contains: target } } : {},
        from && !Number.isNaN(from.getTime()) ? { createdAt: { gte: from } } : {},
        to && !Number.isNaN(to.getTime()) ? { createdAt: { lte: to } } : {},
        q
          ? {
              OR: [
                { action: { contains: q } },
                { target: { contains: q } },
                { metaJson: { contains: q } },
              ],
            }
          : {},
      ],
    };

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { actor: { include: { team: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    const entries: AuditLogEntry[] = rows.map((r) => {
      let meta: Record<string, unknown> | null = null;
      try {
        meta = JSON.parse(r.metaJson ?? '{}');
      } catch {
        meta = null;
      }
      return {
        id: r.id,
        actor: r.actor ? serializeUser(r.actor) : null,
        action: r.action,
        target: r.target,
        meta,
        createdAt: r.createdAt.toISOString(),
      };
    });
    res.json({ entries, total, limit, offset });
  } catch (err) {
    next(err);
  }
});

router.use('/surveys', surveysAdminRouter);
router.use('/users', usersAdminRouter);
router.use('/reports', reportsAdminRouter);
router.use('/broadcasts', broadcastsAdminRouter);

router.get('/settings/branding', async (_req, res, next) => {
  try {
    res.json(await getPlatformBranding());
  } catch (err) {
    next(err);
  }
});

router.patch('/settings/branding', validate(schemas.patchPlatformBrandingSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof schemas.patchPlatformBrandingSchema>;
    const nextBranding = await setPlatformBranding(body);
    await audit({
      actorId: req.user?.id,
      action: 'admin.settings.branding',
      meta: body as Record<string, unknown>,
    });
    res.json(nextBranding);
  } catch (err) {
    next(err);
  }
});

router.get('/settings/upload', async (_req, res, next) => {
  try {
    res.json({ uploadMaxMb: await getUploadMaxMb() });
  } catch (err) {
    next(err);
  }
});

router.patch('/settings/upload', validate(schemas.patchUploadMaxSchema), async (req, res, next) => {
  try {
    const { uploadMaxMb } = req.body as { uploadMaxMb: number };
    const nextMb = await setUploadMaxMb(uploadMaxMb);
    await audit({
      actorId: req.user?.id,
      action: 'admin.settings.upload',
      meta: { uploadMaxMb: nextMb },
    });
    res.json({ uploadMaxMb: nextMb });
  } catch (err) {
    next(err);
  }
});

router.post('/import/ctfd', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'CSV file required' } });
      return;
    }
    const text = file.buffer.toString('utf8');
    const stats = await importCtfdChallengesCsv(text);
    await audit({
      actorId: req.user?.id,
      action: 'admin.import.ctfd',
      meta: stats as unknown as Record<string, unknown>,
    });
    res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
});

export default router;
