import { Router } from 'express';
import { z } from 'zod';
import { Permission, schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { serializeUser } from '../serializers.js';
import { NotFound } from '../../lib/http-error.js';
import { snapshot } from '../../realtime/presence.js';
import { buildSessionUser } from '../../lib/session-user.js';
import { logoImageUpload } from '../../lib/upload.js';
import { removeLogoFiles, writeLogoFile } from '../../lib/logo-files.js';
import { audit } from '../../lib/audit.js';
import { buildUserProfileCard } from './user-profile.service.js';

const router: Router = Router();

router.use(requireAuth);

const suggestQuery = z.object({
  q: z.string().min(1).max(64),
  serverId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

router.get('/suggest', validate(suggestQuery, 'query'), async (req, res, next) => {
  try {
    const { q, serverId } = req.query as z.infer<typeof suggestQuery>;
    const limit = (req.query as z.infer<typeof suggestQuery>).limit ?? 10;
    const needle = q.trim().toLowerCase();
    const meId = req.user!.id;

    let candidateIds: string[] | undefined;
    if (serverId) {
      const members = await prisma.serverMember.findMany({
        where: { serverId },
        select: { userId: true },
      });
      candidateIds = members.map((m) => m.userId).filter((id) => id !== meId);
    }

    const users = await prisma.user.findMany({
      where: {
        id: candidateIds ? { in: candidateIds } : { not: meId },
        isBanned: false,
        OR: [
          { username: { contains: needle } },
          { displayName: { contains: needle } },
        ],
      },
      include: { team: true },
      take: limit * 3,
    });

    const accepted = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: meId }, { addresseeId: meId }],
      },
    });
    const friendIds = new Set(
      accepted.map((f) => (f.requesterId === meId ? f.addresseeId : f.requesterId)),
    );
    const pending = await prisma.friendship.findMany({
      where: {
        status: 'PENDING',
        OR: [{ requesterId: meId }, { addresseeId: meId }],
      },
    });
    const pendingIds = new Set(
      pending.flatMap((f) => [f.requesterId, f.addresseeId]).filter((id) => id !== meId),
    );

    const filtered = users
      .filter((u) => {
        const hay = `${u.username} ${u.displayName}`.toLowerCase();
        return hay.includes(needle);
      })
      .filter((u) => !friendIds.has(u.id) && !pendingIds.has(u.id))
      .slice(0, limit);

    res.json({ users: filtered.map(serializeUser) });
  } catch (err) {
    next(err);
  }
});

router.get('/', requirePermission(Permission.USER_VIEW_ALL), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: { team: true },
      orderBy: [{ role: 'desc' }, { username: 'asc' }],
      take: 500,
    });
    res.json({ users: users.map(serializeUser) });
  } catch (err) {
    next(err);
  }
});

router.get('/online', async (_req, res, next) => {
  try {
    const presences = snapshot();
    const onlineIds = presences.filter((p) => p.status !== 'OFFLINE').map((p) => p.userId);
    if (onlineIds.length === 0) return res.json({ users: [], presences });
    const users = await prisma.user.findMany({
      where: { id: { in: onlineIds } },
      include: { team: true },
    });
    res.json({ users: users.map(serializeUser), presences });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', validate(schemas.updateMeSchema), async (req, res, next) => {
  try {
    const data = req.body as z.infer<typeof schemas.updateMeSchema>;
    const patch: {
      preferredLocale?: string;
      displayName?: string;
      bio?: string | null;
      preferredTheme?: string;
      notifyDefault?: string;
    } = {};
    if (data.locale !== undefined) patch.preferredLocale = data.locale;
    if (data.displayName !== undefined) patch.displayName = data.displayName.trim();
    if (data.bio !== undefined) patch.bio = data.bio.trim() === '' ? null : data.bio.trim();
    if (data.theme !== undefined) patch.preferredTheme = data.theme;
    if (data.defaultNotifyMode !== undefined) patch.notifyDefault = data.defaultNotifyMode;
    if (Object.keys(patch).length > 0) {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: patch,
      });
      const fields = Object.keys(patch).join(', ');
      await audit({
        actorId: req.user!.id,
        action: 'user.profile',
        target: req.user!.id,
        meta: { fields, summary: fields },
      });
    }
    res.json({ user: await buildSessionUser(req.user!.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/me/avatar', logoImageUpload.single('file'), async (req, res, next) => {
  try {
    const id = req.user!.id;
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Image file required' } });
      return;
    }
    const url = await writeLogoFile('user', id, file.buffer, file.originalname);
    await prisma.user.update({ where: { id }, data: { avatarUrl: url } });
    await audit({ actorId: id, action: 'user.avatar', target: id });
    res.json({ user: await buildSessionUser(id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/me/avatar', async (req, res, next) => {
  try {
    const id = req.user!.id;
    await removeLogoFiles('user', id);
    await prisma.user.update({ where: { id }, data: { avatarUrl: null } });
    await audit({ actorId: id, action: 'user.avatar.clear', target: id });
    res.json({ user: await buildSessionUser(id) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/profile', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound('User not found');
    const card = await buildUserProfileCard(req.user!.id, id);
    res.json({ card });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound('User not found');
    const user = await prisma.user.findUnique({ where: { id }, include: { team: true } });
    if (!user) throw NotFound('User not found');
    res.json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
