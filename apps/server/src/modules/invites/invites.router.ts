import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { emitChannelsRefresh } from '../../realtime/broadcasters.js';
import { assertUserCanUsePlatform } from '../../lib/user-moderation.js';
import { assignDefaultRoleToMember } from '../../lib/assign-default-server-role.js';
import { inviteAcceptLimiter } from '../../middleware/ratelimit.js';

const router: Router = Router();

const codeSchema = z.object({ code: z.string().min(4).max(32) });

function serializeServerBrief(s: {
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

function inviteExpired(row: { expiresAt: Date | null; maxUses: number | null; uses: number }) {
  if (row.expiresAt && row.expiresAt < new Date()) return true;
  if (row.maxUses != null && row.uses >= row.maxUses) return true;
  return false;
}

async function loadInvite(code: string) {
  const row = await prisma.serverInvite.findUnique({
    where: { code },
    include: {
      server: true,
      channel: { select: { id: true, name: true } },
    },
  });
  if (!row) throw NotFound('Invite not found');
  return row;
}

/** Preview invite (requires login to know membership state). */
router.get('/:code', validate(codeSchema, 'params'), requireAuth, async (req, res, next) => {
  try {
    const code = req.params.code!.trim();
    const userId = req.user!.id;
    const row = await loadInvite(code);
    const expired = inviteExpired(row);
    const existing = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId: row.serverId } },
      select: { bannedAt: true },
    });
    res.json({
      invite: {
        code: row.code,
        server: serializeServerBrief(row.server),
        channelId: row.channelId,
        channelName: row.channel?.name ?? null,
        uses: row.uses,
        maxUses: row.maxUses,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        expired,
        alreadyMember: !!existing && !existing.bannedAt,
        bannedFromServer: !!existing?.bannedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Join server via invite code. */
router.post('/:code/accept', inviteAcceptLimiter, validate(codeSchema, 'params'), requireAuth, async (req, res, next) => {
  try {
    const code = req.params.code!.trim();
    const userId = req.user!.id;
    await assertUserCanUsePlatform(userId);

    const row = await loadInvite(code);
    if (inviteExpired(row)) throw BadRequest('This invite has expired or reached its use limit');

    const existing = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId: row.serverId } },
    });

    if (existing?.bannedAt) throw Forbidden('You are banned from this server');

    if (!existing) {
      await prisma.$transaction([
        prisma.serverMember.create({
          data: { userId, serverId: row.serverId },
        }),
        prisma.serverInvite.update({
          where: { id: row.id },
          data: { uses: { increment: 1 } },
        }),
      ]);
      await assignDefaultRoleToMember(userId, row.serverId);
      await audit({
        actorId: userId,
        action: 'server.invite.accept',
        target: row.serverId,
        meta: { code, channelId: row.channelId },
      });
    }

    emitChannelsRefresh(row.serverId);

    res.json({
      server: serializeServerBrief(row.server),
      channelId: row.channelId,
      joined: !existing,
      alreadyMember: !!existing,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
