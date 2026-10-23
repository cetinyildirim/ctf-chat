import { Router } from 'express';
import { z } from 'zod';
import { Permission, schemas, permissionsFor, type Role } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeAnnouncement } from '../serializers.js';
import { publishAnnouncementById } from '../../lib/announcement-publish.js';
import { assertServerPermission } from '../../lib/server-permissions.js';
import { assertCtfdOutboundUrl, assertSafeOutboundUrl } from '../../lib/url-safety.js';
import { testCtfdConnection, invalidateCtfdCaches } from '../../lib/ctfd-client.js';

const router: Router = Router({ mergeParams: true });
router.use(requireAuth);

const idSchema = z.object({ id: z.string().cuid() });
const webhookIdSchema = idSchema.extend({ webhookId: z.string().cuid() });

async function assertServerManage(serverId: string, userId: string, role: Role) {
  await assertServerPermission(userId, serverId, 'manageServer', permissionsFor(role));
}

/** Platform ANNOUNCEMENT_CREATE, or the server role's `manageAnnouncements`. */
async function assertCanAnnounce(serverId: string, userId: string, role: Role) {
  const platform = permissionsFor(role);
  if (platform.includes(Permission.ANNOUNCEMENT_CREATE)) return;
  await assertServerPermission(userId, serverId, 'manageAnnouncements', platform);
}

router.get('/integrations', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    await assertServerManage(serverId, req.user!.id, req.user!.role);
    const server = await prisma.chatServer.findUnique({ where: { id: serverId } });
    if (!server) throw NotFound();
    res.json({
      integrations: {
        themePrimary: server.themePrimary,
        themeAccent: server.themeAccent,
        emailNotifyEnabled: server.emailNotifyEnabled,
        emailReplyTo: server.emailReplyTo,
        ctfdBaseUrl: server.ctfdBaseUrl,
        ctfdAccessTokenConfigured: !!server.ctfdAccessToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/integrations',
  requirePermission(Permission.ADMIN_DASHBOARD),
  validate(idSchema, 'params'),
  validate(schemas.patchServerIntegrationsSchema),
  async (req, res, next) => {
    try {
      const serverId = req.params.id!;
      const body = req.body as z.infer<typeof schemas.patchServerIntegrationsSchema>;
      if (body.ctfdBaseUrl !== undefined && body.ctfdBaseUrl) {
        await assertCtfdOutboundUrl(body.ctfdBaseUrl);
      }
      if (body.ctfdBaseUrl !== undefined || body.ctfdAccessToken !== undefined) {
        invalidateCtfdCaches();
      }
      const server = await prisma.chatServer.update({
        where: { id: serverId },
        data: {
          themePrimary: body.themePrimary !== undefined ? body.themePrimary : undefined,
          themeAccent: body.themeAccent !== undefined ? body.themeAccent : undefined,
          emailNotifyEnabled: body.emailNotifyEnabled,
          emailReplyTo: body.emailReplyTo !== undefined ? body.emailReplyTo : undefined,
          ctfdBaseUrl: body.ctfdBaseUrl !== undefined ? body.ctfdBaseUrl : undefined,
          ctfdAccessToken:
            body.ctfdAccessToken !== undefined
              ? body.ctfdAccessToken?.trim() || null
              : undefined,
        },
      });
      await audit({
        actorId: req.user!.id,
        action: 'server.integrations.patch',
        target: serverId,
        meta: {
          ...body,
          ctfdAccessToken: body.ctfdAccessToken !== undefined ? '[redacted]' : undefined,
        },
      });
      res.json({
        integrations: {
          themePrimary: server.themePrimary,
          themeAccent: server.themeAccent,
          emailNotifyEnabled: server.emailNotifyEnabled,
          emailReplyTo: server.emailReplyTo,
          ctfdBaseUrl: server.ctfdBaseUrl,
          ctfdAccessTokenConfigured: !!server.ctfdAccessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/integrations/ctfd/test',
  requirePermission(Permission.ADMIN_DASHBOARD),
  validate(idSchema, 'params'),
  validate(schemas.testCtfdConnectionSchema),
  async (req, res, next) => {
    try {
      const serverId = req.params.id!;
      const body = req.body as z.infer<typeof schemas.testCtfdConnectionSchema>;
      const server = await prisma.chatServer.findUnique({ where: { id: serverId } });
      if (!server) throw NotFound();

      const baseUrl = body.ctfdBaseUrl?.trim() || server.ctfdBaseUrl;
      if (!baseUrl) throw BadRequest('CTFd URL is required');

      const accessToken =
        body.ctfdAccessToken !== undefined ? body.ctfdAccessToken?.trim() || null : server.ctfdAccessToken;

      const result = await testCtfdConnection(baseUrl, accessToken);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.get('/webhooks', validate(idSchema, 'params'), requirePermission(Permission.ADMIN_DASHBOARD), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    const rows = await prisma.serverWebhook.findMany({
      where: { serverId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      webhooks: rows.map((w) => ({
        id: w.id,
        serverId: w.serverId,
        label: w.label,
        url: w.url,
        events: JSON.parse(w.eventsJson) as string[],
        enabled: w.enabled,
        createdAt: w.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/webhooks',
  validate(idSchema, 'params'),
  requirePermission(Permission.ADMIN_DASHBOARD),
  validate(schemas.createServerWebhookSchema),
  async (req, res, next) => {
    try {
      const serverId = req.params.id!;
      const body = req.body as z.infer<typeof schemas.createServerWebhookSchema>;
      await assertSafeOutboundUrl(body.url);
      const row = await prisma.serverWebhook.create({
        data: {
          serverId,
          label: body.label.trim(),
          url: body.url.trim(),
          secret: body.secret?.trim() ?? null,
          eventsJson: JSON.stringify(body.events ?? ['announcement.publish']),
          enabled: body.enabled ?? true,
        },
      });
      res.status(201).json({
        webhook: {
          id: row.id,
          serverId: row.serverId,
          label: row.label,
          url: row.url,
          events: JSON.parse(row.eventsJson) as string[],
          enabled: row.enabled,
          createdAt: row.createdAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/webhooks/:webhookId',
  validate(webhookIdSchema, 'params'),
  requirePermission(Permission.ADMIN_DASHBOARD),
  async (req, res, next) => {
    try {
      const { id: serverId, webhookId } = req.params;
      const row = await prisma.serverWebhook.findFirst({ where: { id: webhookId, serverId } });
      if (!row) throw NotFound();
      await prisma.serverWebhook.delete({ where: { id: webhookId } });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

router.get('/announcements', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    await assertCanAnnounce(serverId, req.user!.id, req.user!.role);
    const rows = await prisma.announcement.findMany({
      where: { serverId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { author: { include: { team: true } } },
    });
    res.json({ announcements: rows.map(serializeAnnouncement) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/announcements',
  validate(idSchema, 'params'),
  validate(schemas.createServerAnnouncementSchema),
  async (req, res, next) => {
    try {
      const serverId = req.params.id!;
      await assertCanAnnounce(serverId, req.user!.id, req.user!.role);
      const body = req.body as z.infer<typeof schemas.createServerAnnouncementSchema>;
      if (body.channelId) {
        const ch = await prisma.channel.findFirst({ where: { id: body.channelId, serverId } });
        if (!ch) throw BadRequest('Channel not in this server');
      }
      const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null;
      const publishNow = !scheduledFor || scheduledFor <= new Date();

      const row = await prisma.announcement.create({
        data: {
          title: body.title.trim(),
          body: body.body.trim(),
          severity: body.severity,
          authorId: req.user!.id,
          serverId,
          channelId: body.channelId ?? null,
          scheduledFor,
          requireAck: body.requireAck ?? false,
        },
        include: { author: { include: { team: true } } },
      });

      if (publishNow) await publishAnnouncementById(row.id);

      const fresh = await prisma.announcement.findUniqueOrThrow({
        where: { id: row.id },
        include: { author: { include: { team: true } } },
      });

      await audit({
        actorId: req.user!.id,
        action: 'announcement.create',
        target: row.id,
        meta: { serverId, scheduled: !!scheduledFor && !publishNow },
      });

      res.status(201).json({ announcement: serializeAnnouncement(fresh) });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
