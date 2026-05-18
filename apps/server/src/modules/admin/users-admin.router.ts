import { Router } from 'express';
import { z } from 'zod';
import { Permission } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAnyPermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeUser } from '../serializers.js';

const router: Router = Router();
router.use(requireAnyPermission(Permission.USER_BAN, Permission.USER_MUTE, Permission.USER_VIEW_ALL));

const idSchema = z.object({ id: z.string().cuid() });

const moderationSchema = z.object({
  isBanned: z.boolean().optional(),
  mutedUntil: z.union([z.string().datetime(), z.null()]).optional(),
  muteMinutes: z.number().int().min(1).max(60 * 24 * 365).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { username: { contains: q } },
              { displayName: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : undefined,
      take: 50,
      orderBy: { username: 'asc' },
      include: { team: true },
    });
    res.json({
      users: users.map((u) => ({
        ...serializeUser(u),
        isBanned: u.isBanned,
        mutedUntil: u.mutedUntil?.toISOString() ?? null,
        mutedSince: u.mutedSince?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

function parseMeta(json: string | null): Record<string, unknown> {
  try {
    return JSON.parse(json ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function moderationKind(meta: Record<string, unknown>): 'mute' | 'unmute' | 'ban' | 'unban' | 'other' {
  if (typeof meta.muteMinutes === 'number' && meta.muteMinutes > 0) return 'mute';
  if (typeof meta.mutedUntil === 'string' && meta.mutedUntil.length > 0) return 'mute';
  if (meta.mutedUntil === null && meta.mutedSince === null) return 'unmute';
  if (meta.isBanned === true) return 'ban';
  if (meta.isBanned === false) return 'unban';
  return 'other';
}

router.get('/mutes/history', async (_req, res, next) => {
  try {
    const rows = await prisma.auditLog.findMany({
      where: { action: 'user.moderation' },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { actor: { include: { team: true } } },
    });
    const now = Date.now();
    const entries = rows
      .map((r) => {
        const meta = parseMeta(r.metaJson);
        const kind = moderationKind(meta);
        const mutedUntil =
          typeof meta.mutedUntil === 'string' && meta.mutedUntil ? meta.mutedUntil : null;
        const mutedSince =
          typeof meta.mutedSince === 'string' && meta.mutedSince ? meta.mutedSince : null;
        const muteMinutes = typeof meta.muteMinutes === 'number' ? meta.muteMinutes : null;
        const active = mutedUntil ? new Date(mutedUntil).getTime() > now : false;
        return {
          id: r.id,
          at: r.createdAt.toISOString(),
          userId: r.target,
          username: typeof meta.username === 'string' ? meta.username : '—',
          displayName: typeof meta.displayName === 'string' ? meta.displayName : '—',
          teamName: typeof meta.teamName === 'string' ? meta.teamName : null,
          kind,
          muteMinutes,
          mutedSince,
          mutedUntil,
          isBanned: typeof meta.isBanned === 'boolean' ? meta.isBanned : null,
          status:
            kind === 'mute' ? (active ? 'active' : 'ended') : kind === 'unmute' ? 'ended' : '—',
          actor: r.actor ? serializeUser(r.actor) : null,
        };
      })
      .filter((e) => e.kind === 'mute' || e.kind === 'unmute');
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

router.get('/muted', async (_req, res, next) => {
  try {
    const now = new Date();
    const users = await prisma.user.findMany({
      where: { mutedUntil: { gt: now } },
      orderBy: { mutedUntil: 'asc' },
      include: { team: true },
    });
    res.json({
      users: users.map((u) => ({
        ...serializeUser(u),
        isBanned: u.isBanned,
        mutedUntil: u.mutedUntil!.toISOString(),
        mutedSince: u.mutedSince?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/moderation', validate(idSchema, 'params'), validate(moderationSchema), async (req, res, next) => {
  try {
    const id = req.params.id!;
    const data = req.body as z.infer<typeof moderationSchema>;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw NotFound();

    let mutedUntil: Date | null | undefined = undefined;
    let mutedSince: Date | null | undefined = undefined;
    if (data.mutedUntil !== undefined) {
      mutedUntil = data.mutedUntil === null ? null : new Date(data.mutedUntil);
      mutedSince = mutedUntil === null ? null : new Date();
    } else if (data.muteMinutes !== undefined) {
      const since = new Date();
      mutedSince = since;
      mutedUntil = new Date(since.getTime() + data.muteMinutes * 60_000);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(data.isBanned !== undefined ? { isBanned: data.isBanned } : {}),
        ...(mutedUntil !== undefined ? { mutedUntil } : {}),
        ...(mutedSince !== undefined ? { mutedSince } : {}),
      },
      include: { team: true },
    });

    await audit({
      actorId: req.user?.id,
      action: 'user.moderation',
      target: id,
      meta: {
        username: updated.username,
        displayName: updated.displayName,
        teamName: updated.team?.name ?? null,
        isBanned: updated.isBanned,
        mutedUntil: updated.mutedUntil?.toISOString() ?? null,
        mutedSince: updated.mutedSince?.toISOString() ?? null,
        muteMinutes: data.muteMinutes ?? null,
      },
    });

    res.json({
      user: {
        ...serializeUser(updated),
        isBanned: updated.isBanned,
        mutedUntil: updated.mutedUntil?.toISOString() ?? null,
        mutedSince: updated.mutedSince?.toISOString() ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
