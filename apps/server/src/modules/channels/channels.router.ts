import { Router } from 'express';
import { z } from 'zod';
import {
  Permission,
  isAdmin,
  isStaff,
  schemas,
  ChannelType,
} from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeChannel, serializeUser } from '../serializers.js';
import { emitChannelCreated, emitChannelsRefresh } from '../../realtime/broadcasters.js';
import { logoImageUpload } from '../../lib/upload.js';
import { removeLogoFiles, writeLogoFile } from '../../lib/logo-files.js';
import {
  loadChannel,
  assertCanAccessChannel,
  canViewChannelInList,
  serverChannelGrants,
} from '../messages/access.js';
import { requireServerMember } from '../../lib/server-membership.js';
import { getUserTeamOnServer } from '../../lib/team-membership.js';
import {
  assertPlatformAdminForServer,
  assertPlatformAdminForChannel,
} from '../../lib/server-admin-scope.js';

const router: Router = Router();

router.use(requireAuth);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function normalizeNotifyDefault(v: string | null): 'ALL' | 'MENTIONS_ONLY' | 'NONE' {
  if (v === 'MENTIONS_ONLY') return 'MENTIONS_ONLY';
  if (v === 'NONE') return 'NONE';
  return 'ALL';
}

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const serverId = typeof req.query.serverId === 'string' ? req.query.serverId : undefined;
    if (!serverId) throw BadRequest('serverId query required');

    if (!isAdmin(user.role)) {
      await requireServerMember(user.id, serverId);
    }

    const [categories, channels, dmRows, me, prefRows, serverPref] = await Promise.all([
      prisma.category.findMany({
        where: { serverId },
        orderBy: { position: 'asc' },
      }),
      prisma.channel.findMany({
        where: {
          serverId,
          NOT: { type: 'DIRECT_MESSAGE' },
        },
        include: { category: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      prisma.channel.findMany({
        where: {
          type: 'DIRECT_MESSAGE',
          dmParticipants: { some: { userId: user.id } },
        },
        include: {
          category: true,
          dmParticipants: {
            include: {
              user: { include: { team: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { notifyDefault: true },
      }),
      prisma.userChannelPreference.findMany({ where: { userId: user.id } }),
      prisma.userServerPreference.findUnique({
        where: { userId_serverId: { userId: user.id, serverId } },
      }),
    ]);

    const myTeam = await getUserTeamOnServer(prisma, user.id, serverId);
    const listUser = {
      id: user.id,
      role: user.role,
      teamId: myTeam?.id ?? user.teamId,
      grants: isStaff(user.role) ? undefined : await serverChannelGrants(user.id, serverId),
    };

    const visible = channels.filter((c) =>
      canViewChannelInList(
        {
          type: c.type,
          isPrivate: c.isPrivate,
          teamId: c.teamId,
          category: c.category
            ? { staffOnly: c.category.staffOnly, teamId: c.category.teamId }
            : null,
        },
        listUser,
      ),
    );

    const dmListed = dmRows.map((c) => {
      const serialized = serializeChannel(c);
      const peer = c.dmParticipants.map((x) => x.user).find((u) => u.id !== user.id);
      const peerPu = peer ? serializeUser(peer) : null;
      return {
        ...serialized,
        name: peerPu?.displayName ?? serialized.name,
        dmPeer: peerPu,
      };
    });

    const overrides: Record<string, string> = {};
    for (const p of prefRows) {
      overrides[p.channelId] = p.notifyMode;
    }

    const defaultNotifyMode = normalizeNotifyDefault(me?.notifyDefault ?? 'ALL');

    const includeEmpty =
      req.query.includeEmpty === '1' || req.query.includeEmpty === 'true';

    const visibleCategoryIds = new Set(
      visible.map((c) => c.categoryId).filter((id): id is string => !!id),
    );

    res.json({
      categories: categories
        .filter((c) => {
          if (c.staffOnly && !isStaff(user.role) && !listUser.grants?.staff) return false;
          if (c.teamId) {
            if (isStaff(user.role) || listUser.grants?.team) {
              return visibleCategoryIds.has(c.id) || c.teamId === listUser.teamId;
            }
            return c.teamId === listUser.teamId;
          }
          return visibleCategoryIds.has(c.id) || !c.teamId;
        })
        .filter((c) => {
          // Hide empty non-team categories from the rail; settings/admin can request includeEmpty.
          if (c.teamId) return true;
          if (includeEmpty) return true;
          return visibleCategoryIds.has(c.id);
        })
        .map((c) => ({
          id: c.id,
          name: c.name,
          position: c.position,
          logoUrl: c.logoUrl,
          staffOnly: c.staffOnly,
          teamId: c.teamId,
        })),
      channels: visible.map(serializeChannel),
      dmChannels: dmListed,
      notificationPrefs: {
        defaultNotifyMode,
        overrides,
      },
      serverNotifyMode: serverPref?.notifyMode ?? 'DEFAULT',
    });
  } catch (err) {
    next(err);
  }
});

const channelIdSchema = z.object({ id: z.string().cuid() });

router.patch(
  '/:id/me/notifications',
  validate(channelIdSchema, 'params'),
  validate(schemas.patchChannelNotifySchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const channel = await loadChannel(id);
      await assertCanAccessChannel(channel, req.user!);
      const body = req.body as z.infer<typeof schemas.patchChannelNotifySchema>;
      await prisma.userChannelPreference.upsert({
        where: { userId_channelId: { userId: req.user!.id, channelId: id } },
        create: {
          userId: req.user!.id,
          channelId: id,
          notifyMode: body.notifyMode,
        },
        update: { notifyMode: body.notifyMode },
      });
      await audit({
        actorId: req.user!.id,
        action: 'channel.notify',
        target: id,
        meta: { mode: body.notifyMode, channelName: channel.name },
      });
      res.json({
        prefs: {
          channelId: id,
          notifyMode: body.notifyMode,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/logo',
  requirePermission(Permission.CHANNEL_CREATE),
  logoImageUpload.single('file'),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const channel = await loadChannel(id);
      if (channel.type === 'DIRECT_MESSAGE') throw Forbidden();
      await assertCanAccessChannel(channel, req.user!);
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Image file required' } });
        return;
      }

      const url = await writeLogoFile('channel', id, file.buffer, file.originalname);
      const updated = await prisma.channel.update({ where: { id }, data: { logoUrl: url } });
      await audit({ actorId: req.user?.id, action: 'channel.logo', target: id });
      if (channel.serverId) emitChannelsRefresh(channel.serverId);
      res.json({ channel: serializeChannel(updated) });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id/logo',
  requirePermission(Permission.CHANNEL_CREATE),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const channel = await loadChannel(id);
      if (channel.type === 'DIRECT_MESSAGE') throw Forbidden();
      await assertCanAccessChannel(channel, req.user!);

      await removeLogoFiles('channel', id);
      const updated = await prisma.channel.update({ where: { id }, data: { logoUrl: null } });
      await audit({ actorId: req.user?.id, action: 'channel.logo.clear', target: id });
      if (channel.serverId) emitChannelsRefresh(channel.serverId);
      res.json({ channel: serializeChannel(updated) });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:id', validate(channelIdSchema, 'params'), async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound();
    const channel = await loadChannel(id);
    await assertCanAccessChannel(channel, req.user!);
    const serialized = serializeChannel(channel);

    if (channel.type !== 'DIRECT_MESSAGE') {
      res.json({ channel: serialized });
      return;
    }

    const parts = await prisma.channelDmParticipant.findMany({
      where: { channelId: id },
      include: {
        user: { include: { team: true } },
      },
    });
    const peer = parts.map((x) => x.user).find((u) => u.id !== req.user!.id);
    const peerPu = peer ? serializeUser(peer) : null;

    res.json({
      channel: {
        ...serialized,
        name: peerPu?.displayName ?? serialized.name,
        dmPeer: peerPu,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/team',
  validate(schemas.createTeamChannelSchema),
  async (req, res, next) => {
    try {
      const data = req.body as z.infer<typeof schemas.createTeamChannelSchema>;
      const me = req.user!;
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category?.teamId || !category.serverId) {
        throw BadRequest('Not a team category');
      }
      await requireServerMember(me.id, category.serverId);
      const myTeam = await getUserTeamOnServer(prisma, me.id, category.serverId);
      if (!myTeam || myTeam.id !== category.teamId) {
        throw Forbidden('Only team members can add channels here');
      }

      const name = data.name.trim();
      const dup = await prisma.channel.findFirst({
        where: { categoryId: category.id, teamId: category.teamId, name: { equals: name } },
      });
      if (dup) throw BadRequest('A channel with this name already exists');

      const maxPos =
        (
          await prisma.channel.findFirst({
            where: { categoryId: category.id },
            orderBy: { position: 'desc' },
            select: { position: true },
          })
        )?.position ?? 0;

      const baseSlug = slugify(name);
      const slug = `${baseSlug}-${category.teamId.slice(-4)}-${Math.random().toString(36).slice(2, 6)}`;
      const channel = await prisma.channel.create({
        data: {
          name,
          slug,
          topic: data.topic?.trim() || `${category.name} · ${name}`,
          type: ChannelType.TEAM_PRIVATE,
          categoryId: category.id,
          serverId: category.serverId,
          isPrivate: true,
          teamId: category.teamId,
          position: maxPos + 1,
        },
      });
      await audit({
        actorId: me.id,
        action: 'channel.create.team',
        target: channel.id,
        meta: { teamId: category.teamId, categoryId: category.id },
      });
      const serialized = serializeChannel(channel);
      emitChannelCreated(serialized);
      emitChannelsRefresh(category.serverId);
      res.status(201).json({ channel: serialized });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  requirePermission(Permission.CHANNEL_CREATE),
  validate(schemas.createChannelSchema),
  async (req, res, next) => {
    try {
      const data = req.body as ReturnType<typeof schemas.createChannelSchema.parse>;
      if (data.type === 'DIRECT_MESSAGE') throw BadRequest('Invalid channel type');
      let serverId = data.serverId ?? null;
      if (data.categoryId) {
        const cat = await prisma.category.findUnique({ where: { id: data.categoryId } });
        if (!cat) throw BadRequest('Category not found');
        serverId = cat.serverId;
      }
      if (!serverId) throw BadRequest('serverId required');

      const me = req.user!;
      await assertPlatformAdminForServer(me.id, serverId, me.role);

      const baseSlug = slugify(data.name);
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const channel = await prisma.channel.create({
        data: {
          name: data.name,
          slug,
          topic: data.topic ?? null,
          type: data.type,
          categoryId: data.categoryId ?? null,
          serverId,
          isPrivate: data.isPrivate ?? false,
          iconKey: data.iconKey ?? null,
        },
      });
      await audit({ actorId: me.id, action: 'channel.create', target: channel.id });
      const serialized = serializeChannel(channel);
      emitChannelCreated(serialized);
      res.status(201).json({ channel: serialized });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id',
  requireAnyPermission(Permission.CHANNEL_CREATE, Permission.CHANNEL_LOCK),
  validate(schemas.updateChannelSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id!;
      const me = req.user!;
      const serverId = await assertPlatformAdminForChannel(me.id, id, me.role);
      const data = req.body as ReturnType<typeof schemas.updateChannelSchema.parse>;
      const channel = await prisma.channel.update({ where: { id }, data });
      await audit({ actorId: me.id, action: 'channel.update', target: channel.id, meta: data });
      if (serverId) emitChannelsRefresh(serverId);
      res.json({ channel: serializeChannel(channel) });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  requirePermission(Permission.CHANNEL_DELETE),
  async (req, res, next) => {
    try {
      const id = req.params.id!;
      const me = req.user!;
      const channel = await prisma.channel.findUnique({ where: { id } });
      if (!channel) throw NotFound();
      if (channel.type === 'DIRECT_MESSAGE') throw BadRequest('Cannot delete DM channels');
      if (channel.serverId) {
        await assertPlatformAdminForServer(me.id, channel.serverId, me.role);
      }
      await prisma.channel.delete({ where: { id } });
      await audit({
        actorId: me.id,
        action: 'channel.delete',
        target: id,
        meta: { name: channel.name },
      });
      if (channel.serverId) emitChannelsRefresh(channel.serverId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

