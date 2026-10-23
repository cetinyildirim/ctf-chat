import { Router } from 'express';
import { z } from 'zod';
import { Permission, can } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAnyPermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { Forbidden, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeUser } from '../serializers.js';
import { revokeAllRefreshTokens, revokeSessionsIfAuthProfileChanged } from '../../lib/revoke-sessions.js';
import {
  notifyUserBanned,
  notifyUserMuted,
  notifyUserUnbanned,
  notifyUserUnmuted,
} from '../../lib/moderation-notify.js';

const router: Router = Router();
router.use(requireAnyPermission(Permission.USER_BAN, Permission.USER_MUTE, Permission.USER_VIEW_ALL));

const idSchema = z.object({ id: z.string().cuid() });

const moderationSchema = z.object({
  isBanned: z.boolean().optional(),
  mutedUntil: z.union([z.string().datetime(), z.null()]).optional(),
  muteMinutes: z.number().int().min(1).max(60 * 24 * 365).optional(),
  /** With isBanned=true: ban length; omitted or null = indefinite. */
  banMinutes: z.number().int().min(1).max(60 * 24 * 365).nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
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
        bannedUntil: u.bannedUntil?.toISOString() ?? null,
        banReason: u.banReason,
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
  if (meta.action === 'mute' || meta.action === 'unmute' || meta.action === 'ban' || meta.action === 'unban') {
    return meta.action;
  }
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
    const actor = req.user!;
    if (data.isBanned !== undefined && !can(actor.role, Permission.USER_BAN)) {
      throw Forbidden('Missing permission to ban users');
    }
    if (
      (data.mutedUntil !== undefined || data.muteMinutes !== undefined) &&
      !can(actor.role, Permission.USER_MUTE)
    ) {
      throw Forbidden('Missing permission to mute users');
    }
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw NotFound();

    const now = new Date();
    const reason = data.reason?.trim() || null;
    let mutedUntil: Date | null | undefined = undefined;
    let mutedSince: Date | null | undefined = undefined;
    if (data.mutedUntil !== undefined) {
      mutedUntil = data.mutedUntil === null ? null : new Date(data.mutedUntil);
      mutedSince = mutedUntil === null ? null : now;
    } else if (data.muteMinutes !== undefined) {
      mutedSince = now;
      mutedUntil = new Date(now.getTime() + data.muteMinutes * 60_000);
    }

    let bannedUntil: Date | null | undefined = undefined;
    if (data.isBanned === true) {
      bannedUntil = data.banMinutes ? new Date(now.getTime() + data.banMinutes * 60_000) : null;
    } else if (data.isBanned === false) {
      bannedUntil = null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(data.isBanned !== undefined ? { isBanned: data.isBanned, banReason: data.isBanned ? reason : null } : {}),
        ...(bannedUntil !== undefined ? { bannedUntil } : {}),
        ...(mutedUntil !== undefined ? { mutedUntil, muteReason: mutedUntil ? reason : null } : {}),
        ...(mutedSince !== undefined ? { mutedSince } : {}),
      },
      include: { team: true },
    });

    const action =
      data.isBanned === true
        ? 'ban'
        : data.isBanned === false
          ? 'unban'
          : mutedUntil
            ? 'mute'
            : mutedUntil === null
              ? 'unmute'
              : null;

    if (data.isBanned === true && updated.isBanned) {
      await revokeAllRefreshTokens(id);
    } else {
      await revokeSessionsIfAuthProfileChanged(id, existing, updated);
    }

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
        bannedUntil: updated.bannedUntil?.toISOString() ?? null,
        banMinutes: data.banMinutes ?? null,
        reason,
        action,
      },
    });

    if (action === 'mute' && updated.mutedUntil) {
      const minutes = Math.max(1, Math.round((updated.mutedUntil.getTime() - now.getTime()) / 60_000));
      await notifyUserMuted(id, { until: updated.mutedUntil, minutes, reason });
    } else if (action === 'unmute' && existing.mutedUntil && existing.mutedUntil > now) {
      await notifyUserUnmuted(id);
    } else if (action === 'ban' && !existing.isBanned) {
      await notifyUserBanned(id, { until: updated.bannedUntil, minutes: data.banMinutes ?? null, reason });
    } else if (action === 'unban' && existing.isBanned) {
      await notifyUserUnbanned(id, { expired: false });
    }

    res.json({
      user: {
        ...serializeUser(updated),
        isBanned: updated.isBanned,
        bannedUntil: updated.bannedUntil?.toISOString() ?? null,
        banReason: updated.banReason,
        mutedUntil: updated.mutedUntil?.toISOString() ?? null,
        mutedSince: updated.mutedSince?.toISOString() ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
