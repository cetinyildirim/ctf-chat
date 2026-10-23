import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { Permission, TICKET_ACTIVE_STATUSES } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';
import { serializeUser } from '../serializers.js';
import { snapshot } from '../../realtime/presence.js';
import { importCtfdChallengesCsv, previewCtfdChallengesCsv, importCtfdChallengeRows, challengeItemToRow } from './ctfd-import.service.js';
import { importCtfdTeamsCsv, previewCtfdTeamsCsv, importCtfdTeamMembers } from './ctfd-teams-import.service.js';
import { BadRequest } from '../../lib/http-error.js';
import type { ActivityBucket, AuditLogEntry, KPISnapshot } from '@sydt/shared';
import teamsAdminRouter from './teams-admin.router.js';
import surveysAdminRouter from './surveys-admin.router.js';
import usersAdminRouter from './users-admin.router.js';
import usersManageRouter from './users-manage.router.js';
import {
  getPlatformBranding,
  getRegistrationSettings,
  getUploadMaxMb,
  setDefaultRegistrationServerId,
  setPlatformBranding,
  setUploadMaxMb,
} from '../../lib/platform-settings.js';
import broadcastsAdminRouter from './broadcasts-admin.router.js';
import reportsAdminRouter from './reports-admin.router.js';
import pagesAdminRouter from './pages-admin.router.js';
import backupsAdminRouter from './backups-admin.router.js';
import { validate } from '../../middleware/validate.js';
import { schemas } from '@sydt/shared';
import { audit } from '../../lib/audit.js';
import { adminMutationLimiter } from '../../middleware/ratelimit.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const router: Router = Router();

router.use(requireAuth);
router.use(adminMutationLimiter);

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
router.use('/pages', pagesAdminRouter);

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
      prisma.ticket.count({ where: { status: { in: [...TICKET_ACTIVE_STATUSES] } } }),
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
        ip: r.ip,
        userAgent: r.userAgent,
        createdAt: r.createdAt.toISOString(),
      };
    });
    res.json({ entries, total, limit, offset });
  } catch (err) {
    next(err);
  }
});

router.use('/surveys', surveysAdminRouter);
router.use('/users/manage', usersManageRouter);
router.use('/users', usersAdminRouter);
router.use('/reports', reportsAdminRouter);
router.use('/broadcasts', broadcastsAdminRouter);
router.use('/backups', backupsAdminRouter);

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

router.get('/settings/registration', async (_req, res, next) => {
  try {
    res.json(await getRegistrationSettings());
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/settings/registration',
  validate(schemas.patchRegistrationSettingsSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof schemas.patchRegistrationSettingsSchema>;
      const nextSettings = await setDefaultRegistrationServerId(body.defaultRegistrationServerId);
      await audit({
        actorId: req.user?.id,
        action: 'admin.settings.registration',
        meta: { defaultRegistrationServerId: body.defaultRegistrationServerId },
      });
      res.json(nextSettings);
    } catch (err) {
      next(err);
    }
  },
);

router.post('/import/ctfd/preview', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'CSV file required' } });
      return;
    }
    const text = file.buffer.toString('utf8');
    const preview = previewCtfdChallengesCsv(text);
    if (preview.totalChannels === 0) {
      throw BadRequest('No challenges found in CSV. Use CTFd challenges export.');
    }
    res.json({ ok: true, preview });
  } catch (err) {
    next(err);
  }
});

router.post('/import/ctfd/apply', validate(schemas.applyCtfdChallengesSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof schemas.applyCtfdChallengesSchema>;
    const server = await prisma.chatServer.findUnique({ where: { id: body.serverId } });
    if (!server) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
      return;
    }
    const rows = body.channels.map(challengeItemToRow);
    const stats = await importCtfdChallengeRows(rows, body.serverId);
    if (stats.channelsCreated + stats.channelsUpdated === 0) {
      throw BadRequest('No channels were imported.');
    }
    await audit({
      actorId: req.user?.id,
      action: 'admin.import.ctfd',
      meta: { ...stats, selectedCount: body.channels.length } as unknown as Record<string, unknown>,
    });
    res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
});

/** @deprecated use /import/ctfd/apply */
router.post('/import/ctfd', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'CSV file required' } });
      return;
    }
    const serverId = typeof req.body?.serverId === 'string' ? req.body.serverId.trim() : '';
    if (!serverId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'serverId required' } });
      return;
    }
    const server = await prisma.chatServer.findUnique({ where: { id: serverId } });
    if (!server) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
      return;
    }
    const text = file.buffer.toString('utf8');
    const stats = await importCtfdChallengesCsv(text, serverId);
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

router.post('/import/ctfd-teams/preview', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'CSV file required' } });
      return;
    }
    const serverId = z.string().cuid().parse(req.body?.serverId);
    const server = await prisma.chatServer.findUnique({ where: { id: serverId } });
    if (!server) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
      return;
    }
    const text = file.buffer.toString('utf8');
    const preview = await previewCtfdTeamsCsv(text, serverId);
    if (preview.totalMembers === 0) {
      throw BadRequest(
        'No teams or members found in CSV. Use CTFd export: users+teams+fields or teams+members+fields.',
      );
    }
    res.json({ ok: true, preview });
  } catch (err) {
    next(err);
  }
});

router.post('/import/ctfd-teams/apply', validate(schemas.applyCtfdTeamsSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof schemas.applyCtfdTeamsSchema>;
    const server = await prisma.chatServer.findUnique({ where: { id: body.serverId } });
    if (!server) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
      return;
    }
    const stats = await importCtfdTeamMembers(
      body.members.map((m) => ({
        displayName: m.displayName,
        email: m.email,
        teamName: m.teamName,
        isCaptain: m.isCaptain,
        serverRoleId: m.serverRoleId,
      })),
      body.serverId,
    );
    if (stats.credentials.length === 0) {
      throw BadRequest('No teams or members were imported.');
    }
    await audit({
      actorId: req.user?.id,
      action: 'admin.import.ctfd_teams',
      meta: {
        teamsCreated: stats.teamsCreated,
        teamsReused: stats.teamsReused,
        usersCreated: stats.usersCreated,
        usersUpdated: stats.usersUpdated,
        serverMembersAdded: stats.serverMembersAdded,
        skipped: stats.skipped,
        credentialCount: stats.credentials.length,
        selectedCount: body.members.length,
      },
    });
    res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
});

/** @deprecated use /import/ctfd-teams/apply with JSON body */
router.post('/import/ctfd-teams/apply-file', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'CSV file required' } });
      return;
    }
    const serverId = typeof req.body?.serverId === 'string' ? req.body.serverId.trim() : '';
    if (!serverId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'serverId required' } });
      return;
    }
    const server = await prisma.chatServer.findUnique({ where: { id: serverId } });
    if (!server) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
      return;
    }
    const text = file.buffer.toString('utf8');
    const stats = await importCtfdTeamsCsv(text, serverId);
    if (stats.credentials.length === 0) {
      throw BadRequest(
        'No teams or members were imported. Check the CSV format (CTFd users+teams+fields).',
      );
    }
    await audit({
      actorId: req.user?.id,
      action: 'admin.import.ctfd_teams',
      meta: {
        teamsCreated: stats.teamsCreated,
        teamsReused: stats.teamsReused,
        usersCreated: stats.usersCreated,
        usersUpdated: stats.usersUpdated,
        serverMembersAdded: stats.serverMembersAdded,
        skipped: stats.skipped,
        credentialCount: stats.credentials.length,
      },
    });
    res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
});

/** @deprecated use /import/ctfd-teams/apply */
router.post('/import/ctfd-teams', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'CSV file required' } });
      return;
    }
    const serverId = typeof req.body?.serverId === 'string' ? req.body.serverId.trim() : '';
    if (!serverId) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'serverId required' } });
      return;
    }
    const server = await prisma.chatServer.findUnique({ where: { id: serverId } });
    if (!server) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Server not found' } });
      return;
    }
    const text = file.buffer.toString('utf8');
    const stats = await importCtfdTeamsCsv(text, serverId);
    await audit({
      actorId: req.user?.id,
      action: 'admin.import.ctfd_teams',
      meta: {
        teamsCreated: stats.teamsCreated,
        teamsReused: stats.teamsReused,
        usersCreated: stats.usersCreated,
        usersUpdated: stats.usersUpdated,
        serverMembersAdded: stats.serverMembersAdded,
        skipped: stats.skipped,
        credentialCount: stats.credentials.length,
      },
    });
    res.json({ ok: true, stats });
  } catch (err) {
    next(err);
  }
});

export default router;
