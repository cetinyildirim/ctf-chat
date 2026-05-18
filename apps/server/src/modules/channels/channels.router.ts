import { Router } from 'express';
import { z } from 'zod';
import {
  Permission,
  isStaff,
  schemas,
  type Role,
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
import { loadChannel, assertCanAccessChannel } from '../messages/access.js';

const router: Router = Router();

router.use(requireAuth);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function channelVisibleTo(
  channel: {
    type: string;
    isPrivate: boolean;
    teamId: string | null;
    category?: { staffOnly?: boolean } | null;
  },
  user: { role: Role; teamId: string | null },
): boolean {
  if (channel.type === 'DIRECT_MESSAGE') return false;

  const staff = isStaff(user.role);
  const staffOnlyType =
    channel.type === 'STAFF_COORD' ||
    channel.type === 'ORGANIZER_INTERNAL' ||
    channel.type === 'LOGS' ||
    channel.type === 'INCIDENT';
  if (staffOnlyType && !staff) return false;
  if (channel.category?.staffOnly && !staff) return false;
  if (channel.isPrivate) {
    if (staff) return true;
    if (channel.teamId && channel.teamId === user.teamId) return true;
    return false;
  }
  return true;
}

async function viewerCanAccessChannelLogo(
  channel: {
    id: string;
    type: string;
    isPrivate: boolean;
    teamId: string | null;
    category?: { staffOnly?: boolean } | null;
  },
  user: { id: string; role: Role; teamId: string | null },
): Promise<boolean> {
  if (channel.type === 'DIRECT_MESSAGE') {
    const p = await prisma.channelDmParticipant.findUnique({
      where: { channelId_userId: { channelId: channel.id, userId: user.id } },
    });
    return !!p;
  }
  return channelVisibleTo(channel, user);
}

function normalizeNotifyDefault(v: string | null): 'ALL' | 'MENTIONS_ONLY' | 'NONE' {
  if (v === 'MENTIONS_ONLY') return 'MENTIONS_ONLY';
  if (v === 'NONE') return 'NONE';
  return 'ALL';
}

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const [categories, channels, dmRows, me, prefRows] = await Promise.all([
      prisma.category.findMany({ orderBy: { position: 'asc' } }),
      prisma.channel.findMany({
        where: {
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
    ]);

    const visible = channels.filter((c) =>
      channelVisibleTo(
        {
          type: c.type,
          isPrivate: c.isPrivate,
          teamId: c.teamId,
          category: c.category ? { staffOnly: c.category.staffOnly } : null,
        },
        user,
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

    const allSeenIds = new Set<string>();
    visible.forEach((c) => allSeenIds.add(c.id));
    dmListed.forEach((c) => allSeenIds.add(c.id));

    const overrides: Record<string, string> = {};
    for (const p of prefRows) {
      overrides[p.channelId] = p.notifyMode;
    }

    const defaultNotifyMode = normalizeNotifyDefault(me?.notifyDefault ?? 'ALL');

    res.json({
      categories: categories
        .filter((c) => !c.staffOnly || isStaff(user.role))
        .map((c) => ({
          id: c.id,
          name: c.name,
          position: c.position,
          logoUrl: c.logoUrl,
          staffOnly: c.staffOnly,
        })),
      channels: visible.map(serializeChannel),
      dmChannels: dmListed,
      notificationPrefs: {
        defaultNotifyMode,
        overrides,
      },
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
      const channel = await prisma.channel.findUnique({ where: { id }, include: { category: true } });
      if (!channel) throw NotFound('Channel not found');
      if (channel.type === 'DIRECT_MESSAGE') throw Forbidden();
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Image file required' } });
        return;
      }
      const allowed = await viewerCanAccessChannelLogo(
        {
          id: channel.id,
          type: channel.type,
          isPrivate: channel.isPrivate,
          teamId: channel.teamId,
          category: channel.category ? { staffOnly: channel.category.staffOnly } : null,
        },
        req.user!,
      );
      if (!allowed) throw Forbidden();

      const url = await writeLogoFile('channel', id, file.buffer, file.originalname);
      const updated = await prisma.channel.update({ where: { id }, data: { logoUrl: url } });
      await audit({ actorId: req.user?.id, action: 'channel.logo', target: id });
      emitChannelsRefresh();
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
      const channel = await prisma.channel.findUnique({ where: { id }, include: { category: true } });
      if (!channel) throw NotFound('Channel not found');
      if (channel.type === 'DIRECT_MESSAGE') throw Forbidden();
      const allowed = await viewerCanAccessChannelLogo(
        {
          id: channel.id,
          type: channel.type,
          isPrivate: channel.isPrivate,
          teamId: channel.teamId,
          category: channel.category ? { staffOnly: channel.category.staffOnly } : null,
        },
        req.user!,
      );
      if (!allowed) throw Forbidden();

      await removeLogoFiles('channel', id);
      const updated = await prisma.channel.update({ where: { id }, data: { logoUrl: null } });
      await audit({ actorId: req.user?.id, action: 'channel.logo.clear', target: id });
      emitChannelsRefresh();
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
  '/',
  requirePermission(Permission.CHANNEL_CREATE),
  validate(schemas.createChannelSchema),
  async (req, res, next) => {
    try {
      const data = req.body as ReturnType<typeof schemas.createChannelSchema.parse>;
      if (data.type === 'DIRECT_MESSAGE') throw BadRequest('Invalid channel type');
      const baseSlug = slugify(data.name);
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const channel = await prisma.channel.create({
        data: {
          name: data.name,
          slug,
          topic: data.topic ?? null,
          type: data.type,
          categoryId: data.categoryId ?? null,
          isPrivate: data.isPrivate ?? false,
          iconKey: data.iconKey ?? null,
        },
      });
      await audit({ actorId: req.user?.id, action: 'channel.create', target: channel.id });
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
      const id = req.params.id;
      if (!id) throw NotFound();
      const data = req.body as ReturnType<typeof schemas.updateChannelSchema.parse>;
      const channel = await prisma.channel.update({ where: { id }, data });
      await audit({ actorId: req.user?.id, action: 'channel.update', target: channel.id, meta: data });
      emitChannelsRefresh();
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
      const id = req.params.id;
      if (!id) throw NotFound();
      const channel = await prisma.channel.findUnique({ where: { id } });
      if (!channel) throw NotFound();
      if (channel.type === 'DIRECT_MESSAGE') throw BadRequest('Cannot delete DM channels');
      await prisma.channel.delete({ where: { id } });
      await audit({
        actorId: req.user?.id,
        action: 'channel.delete',
        target: id,
        meta: { name: channel.name },
      });
      emitChannelsRefresh();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
