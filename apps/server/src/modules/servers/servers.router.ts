import { Router } from 'express';
import { z } from 'zod';
import { Permission, schemas, isAdmin, permissionsFor, type Role } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { logoImageUpload } from '../../lib/upload.js';
import { removeLogoFiles, writeLogoFile } from '../../lib/logo-files.js';
import { serializeMessage, serializeTeam, serializeUser } from '../serializers.js';
import { assertCanAccessChannel } from '../messages/access.js';
import { emitChannelsRefresh } from '../../realtime/broadcasters.js';
import crypto from 'node:crypto';
import integrationsRouter from './server-integrations.router.js';
import serverRolesRouter from './server-roles.router.js';
import { ensureServerDefaultRole } from '../../lib/ensure-server-default-role.js';
import { assignDefaultRoleToMember } from '../../lib/assign-default-server-role.js';
import { requireServerMember } from '../../lib/server-membership.js';
import { assertServerPermission } from '../../lib/server-permissions.js';
import { assertPlatformAdminForServer } from '../../lib/server-admin-scope.js';

const router: Router = Router();
router.use(requireAuth);

const idSchema = z.object({ id: z.string().cuid() });

function inviteCode(): string {
  return crypto.randomBytes(4).toString('hex').slice(0, 8);
}

async function assertCanManageInvites(userId: string, serverId: string, platformRole: Role) {
  if (isAdmin(platformRole)) return;
  await requireServerMember(userId, serverId);
  await assertServerPermission(userId, serverId, 'inviteOthers', permissionsFor(platformRole));
}

function serializeServer(s: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  position: number;
}) {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    iconUrl: s.iconUrl,
    bannerUrl: s.bannerUrl,
    position: s.position,
  };
}

/** All servers (platform admins — server picker in Yönetim). */
router.get(
  '/manageable',
  requirePermission(Permission.ADMIN_DASHBOARD),
  async (req, res, next) => {
    try {
      const rows = await prisma.chatServer.findMany({ orderBy: { position: 'asc' } });
      res.json({ servers: rows.map(serializeServer) });
    } catch (err) {
      next(err);
    }
  },
);

/** Servers the current user is a member of (server rail). */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await prisma.chatServer.findMany({
      where: { members: { some: { userId, bannedAt: null } } },
      orderBy: { position: 'asc' },
    });
    res.json({ servers: rows.map(serializeServer) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requirePermission(Permission.ADMIN_DASHBOARD),
  validate(schemas.createChatServerSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof schemas.createChatServerSchema>;
      const slug = body.slug.trim().toLowerCase();
      const exists = await prisma.chatServer.findUnique({ where: { slug } });
      if (exists) throw BadRequest('Slug already in use');

      const maxPos = await prisma.chatServer.findFirst({ orderBy: { position: 'desc' } });
      const server = await prisma.chatServer.create({
        data: {
          name: body.name.trim(),
          slug,
          description: body.description?.trim() ?? null,
          position: (maxPos?.position ?? 0) + 1,
        },
      });

      await prisma.serverMember.create({
        data: { userId: req.user!.id, serverId: server.id },
      });
      await assignDefaultRoleToMember(req.user!.id, server.id);

      await audit({
        actorId: req.user!.id,
        action: 'server.create',
        target: server.id,
        meta: { name: server.name, slug },
      });

      emitChannelsRefresh(server.id);
      res.status(201).json({ server: serializeServer(server) });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:id', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const id = req.params.id!;
    const me = req.user!;
    if (!isAdmin(me.role)) {
      await requireServerMember(me.id, id);
    }
    const server = await prisma.chatServer.findUnique({ where: { id } });
    if (!server) throw NotFound();
    res.json({ server: serializeServer(server) });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id',
  validate(idSchema, 'params'),
  requireAnyPermission(Permission.ADMIN_DASHBOARD, Permission.CATEGORY_MANAGE),
  validate(schemas.updateChatServerSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id!;
      const me = req.user!;
      await assertPlatformAdminForServer(me.id, id, me.role);
      const body = req.body as z.infer<typeof schemas.updateChatServerSchema>;
      const server = await prisma.chatServer.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.description !== undefined ? { description: body.description?.trim() ?? null } : {}),
        },
      });
      await audit({ actorId: req.user!.id, action: 'server.update', target: id, meta: body });
      emitChannelsRefresh(id);
      res.json({ server: serializeServer(server) });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  validate(idSchema, 'params'),
  requirePermission(Permission.ADMIN_DASHBOARD),
  async (req, res, next) => {
    try {
      const id = req.params.id!;
      const count = await prisma.chatServer.count();
      if (count <= 1) throw BadRequest('Cannot delete the last server');
      await prisma.chatServer.delete({ where: { id } });
      await audit({ actorId: req.user!.id, action: 'server.delete', target: id });
      emitChannelsRefresh(id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/logo',
  validate(idSchema, 'params'),
  requireAnyPermission(Permission.ADMIN_DASHBOARD, Permission.CATEGORY_MANAGE),
  logoImageUpload.single('file'),
  async (req, res, next) => {
    try {
      const id = req.params.id!;
      const me = req.user!;
      await assertPlatformAdminForServer(me.id, id, me.role);
      if (!req.file) throw BadRequest('No file');
      const iconUrl = await writeLogoFile('server', id, req.file.buffer, req.file.originalname);
      const server = await prisma.chatServer.update({ where: { id }, data: { iconUrl } });
      emitChannelsRefresh(id);
      res.json({ server: serializeServer(server) });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id/logo',
  validate(idSchema, 'params'),
  requireAnyPermission(Permission.ADMIN_DASHBOARD, Permission.CATEGORY_MANAGE),
  async (req, res, next) => {
    try {
      const id = req.params.id!;
      const me = req.user!;
      await assertPlatformAdminForServer(me.id, id, me.role);
      await removeLogoFiles('server', id);
      const server = await prisma.chatServer.update({ where: { id }, data: { iconUrl: null } });
      emitChannelsRefresh(id);
      res.json({ server: serializeServer(server) });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:id/me', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const serverId = req.params.id!;
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { team: true } });
    if (!user) throw NotFound();
    res.json({
      member: {
        nickname: member?.nickname ?? null,
        avatarUrl: member?.avatarUrl ?? null,
        displayName: user.displayName,
        username: user.username,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/me',
  validate(idSchema, 'params'),
  validate(schemas.patchServerMemberSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const serverId = req.params.id!;
      const body = req.body as z.infer<typeof schemas.patchServerMemberSchema>;

      const member = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
      });
      if (!member) throw Forbidden('Not a member of this server');

      await prisma.serverMember.update({
        where: { userId_serverId: { userId, serverId } },
        data: {
          nickname: body.nickname === undefined ? undefined : body.nickname?.trim() ?? null,
        },
      });

      const user = await prisma.user.findUnique({ where: { id: userId }, include: { team: true } });
      const updated = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
      });
      res.json({
        member: {
          nickname: updated?.nickname ?? null,
          avatarUrl: updated?.avatarUrl ?? null,
          displayName: user!.displayName,
          username: user!.username,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/me/avatar',
  validate(idSchema, 'params'),
  logoImageUpload.single('file'),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const serverId = req.params.id!;
      if (!req.file) throw BadRequest('No file');
      await requireServerMember(userId, serverId);
      const avatarUrl = await writeLogoFile('server', `${serverId}-${userId}`, req.file.buffer, req.file.originalname);
      await prisma.serverMember.update({
        where: { userId_serverId: { userId, serverId } },
        data: { avatarUrl },
      });
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { team: true } });
      const member = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
      });
      res.json({
        member: {
          nickname: member?.nickname ?? null,
          avatarUrl: member?.avatarUrl ?? null,
          displayName: user!.displayName,
          username: user!.username,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/:id/me/avatar', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const serverId = req.params.id!;
    await requireServerMember(userId, serverId);
    await removeLogoFiles('server', `${serverId}-${userId}`);
    await prisma.serverMember.updateMany({
      where: { userId, serverId },
      data: { avatarUrl: null },
    });
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { team: true } });
    res.json({
      member: {
        nickname: null,
        avatarUrl: null,
        displayName: user!.displayName,
        username: user!.username,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/me/notifications',
  validate(idSchema, 'params'),
  validate(schemas.patchServerNotifySchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const serverId = req.params.id!;
      await requireServerMember(userId, serverId);
      const { notifyMode } = req.body as z.infer<typeof schemas.patchServerNotifySchema>;
      const prefs = await prisma.userServerPreference.upsert({
        where: { userId_serverId: { userId, serverId } },
        create: { userId, serverId, notifyMode },
        update: { notifyMode },
      });
      res.json({ prefs: { serverId, notifyMode: prefs.notifyMode } });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:id/invites', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    const me = req.user!;
    await assertCanManageInvites(me.id, serverId, me.role);
    const rows = await prisma.serverInvite.findMany({
      where: { serverId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        creator: { include: { team: true } },
        channel: { select: { id: true, name: true } },
      },
    });
    res.json({
      invites: rows.map((r) => ({
        id: r.id,
        code: r.code,
        serverId: r.serverId,
        channelId: r.channelId,
        channelName: r.channel?.name ?? null,
        creator: serializeUser(r.creator),
        uses: r.uses,
        maxUses: r.maxUses,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/invites',
  validate(idSchema, 'params'),
  validate(schemas.createServerInviteSchema),
  async (req, res, next) => {
    try {
      const serverId = req.params.id!;
      const me = req.user!;
      await assertCanManageInvites(me.id, serverId, me.role);
      const body = req.body as z.infer<typeof schemas.createServerInviteSchema>;
      if (body.channelId) {
        const ch = await prisma.channel.findFirst({ where: { id: body.channelId, serverId } });
        if (!ch) throw BadRequest('Channel not in this server');
      }
      const ttlDays = body.expiresInDays ?? env.SERVER_INVITE_TTL_DAYS;
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
      let code = inviteCode();
      for (let i = 0; i < 5; i++) {
        const hit = await prisma.serverInvite.findUnique({ where: { code } });
        if (!hit) break;
        code = inviteCode();
      }
      const row = await prisma.serverInvite.create({
        data: {
          serverId,
          code,
          creatorId: req.user!.id,
          channelId: body.channelId ?? null,
          maxUses: body.maxUses ?? null,
          expiresAt,
        },
        include: {
          creator: { include: { team: true } },
          channel: { select: { id: true, name: true } },
        },
      });
      res.status(201).json({
        invite: {
          id: row.id,
          code: row.code,
          serverId: row.serverId,
          channelId: row.channelId,
          channelName: row.channel?.name ?? null,
          creator: serializeUser(row.creator),
          uses: row.uses,
          maxUses: row.maxUses,
          expiresAt: row.expiresAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/:id/invites/:inviteId', validate(idSchema.extend({ inviteId: z.string().cuid() }), 'params'), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    const inviteId = req.params.inviteId!;
    const me = req.user!;
    await assertCanManageInvites(me.id, serverId, me.role);
    const row = await prisma.serverInvite.findFirst({ where: { id: inviteId, serverId } });
    if (!row) throw NotFound();
    await prisma.serverInvite.delete({ where: { id: inviteId } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/:id/members', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    const me = req.user!;
    if (!isAdmin(me.role)) {
      await requireServerMember(me.id, serverId);
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const bannedOnly = req.query.bannedOnly === 'true' || req.query.bannedOnly === '1';
    const members = await prisma.serverMember.findMany({
      where: {
        serverId,
        ...(bannedOnly ? { bannedAt: { not: null } } : { bannedAt: null }),
      },
      include: { user: { include: { team: true } } },
      take: 200,
    });
    let list = members.map((m) => ({
      ...serializeUser(m.user),
      nickname: m.nickname,
      serverAvatarUrl: m.avatarUrl,
      isBanned: !!m.bannedAt,
      banReason: m.banReason,
    }));
    if (q) {
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          (u.nickname?.toLowerCase().includes(q) ?? false),
      );
    }
    res.json({ members: list });
  } catch (err) {
    next(err);
  }
});

async function assertCanBanMembers(userId: string, serverId: string, platformRole: Role) {
  if (isAdmin(platformRole)) return;
  await requireServerMember(userId, serverId);
  await assertServerPermission(userId, serverId, 'banMembers', permissionsFor(platformRole));
}

const memberUserParams = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
});

router.post(
  '/:id/members/:userId/ban',
  validate(memberUserParams, 'params'),
  validate(schemas.banServerMemberSchema),
  async (req, res, next) => {
    try {
      const serverId = req.params.id!;
      const targetUserId = req.params.userId!;
      const me = req.user!;
      if (targetUserId === me.id) throw BadRequest('Cannot ban yourself');
      await assertCanBanMembers(me.id, serverId, me.role);

      const member = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId: targetUserId, serverId } },
        include: { user: { select: { username: true, isBanned: true } } },
      });
      if (!member) throw NotFound('Member not found');
      if (member.bannedAt) {
        res.json({ ok: true, alreadyBanned: true });
        return;
      }

      const body = req.body as z.infer<typeof schemas.banServerMemberSchema>;
      await prisma.serverMember.update({
        where: { userId_serverId: { userId: targetUserId, serverId } },
        data: {
          bannedAt: new Date(),
          bannedById: me.id,
          banReason: body.reason?.trim() || null,
        },
      });
      await audit({
        actorId: me.id,
        action: 'server.member.ban',
        target: serverId,
        meta: { userId: targetUserId, username: member.user.username, reason: body.reason ?? null },
      });
      emitChannelsRefresh(serverId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/:id/members/:userId/ban', validate(memberUserParams, 'params'), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    const targetUserId = req.params.userId!;
    const me = req.user!;
    await assertCanBanMembers(me.id, serverId, me.role);

    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: targetUserId, serverId } },
      include: { user: { select: { username: true } } },
    });
    if (!member) throw NotFound('Member not found');
    if (!member.bannedAt) {
      res.json({ ok: true, alreadyUnbanned: true });
      return;
    }

    await prisma.serverMember.update({
      where: { userId_serverId: { userId: targetUserId, serverId } },
      data: { bannedAt: null, bannedById: null, banReason: null },
    });
    await audit({
      actorId: me.id,
      action: 'server.member.unban',
      target: serverId,
      meta: { userId: targetUserId, username: member.user.username },
    });
    emitChannelsRefresh(serverId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/me/team', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    const userId = req.user!.id;
    const membership = await prisma.serverTeamMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
      include: { team: { include: { _count: { select: { serverMembers: true } } } } },
    });
    if (!membership) {
      res.json({ team: null });
      return;
    }
    res.json({
      team: serializeTeam(membership.team, { memberCount: membership.team._count.serverMembers }),
    });
  } catch (err) {
    next(err);
  }
});

const pinMessageInclude = {
  author: { include: { team: true } },
  attachments: true,
  reactions: { select: { emoji: true, userId: true } },
  replyTo: { select: { id: true, authorId: true, content: true } },
  pin: true,
};

router.get('/:id/pins-by-category', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    await requireServerMember(req.user!.id, serverId);

    const rows = await prisma.pin.findMany({
      where: { channel: { serverId } },
      include: {
        message: { include: pinMessageInclude },
        channel: { include: { category: true } },
      },
      orderBy: { pinnedAt: 'desc' },
    });

    const user = req.user!;
    const bucket = new Map<
      string,
      {
        categoryId: string | null;
        categoryName: string;
        categoryPosition: number;
        pins: Array<{
          message: ReturnType<typeof serializeMessage>;
          channelId: string;
          channelName: string;
          pinnedAt: string;
        }>;
      }
    >();

    for (const row of rows) {
      if (!row.message) continue;
      try {
        await assertCanAccessChannel(row.channel, user);
      } catch {
        continue;
      }
      const cat = row.channel.category;
      const key = cat?.id ?? '__uncategorized__';
      if (!bucket.has(key)) {
        bucket.set(key, {
          categoryId: cat?.id ?? null,
          categoryName: cat?.name ?? '',
          categoryPosition: cat?.position ?? 999_999,
          pins: [],
        });
      }
      bucket.get(key)!.pins.push({
        message: serializeMessage(row.message),
        channelId: row.channel.id,
        channelName: row.channel.name,
        pinnedAt: row.pinnedAt.toISOString(),
      });
    }

    const groups = [...bucket.values()].sort((a, b) => a.categoryPosition - b.categoryPosition);
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

router.use('/:id', serverRolesRouter);
router.use('/:id', integrationsRouter);

export default router;
