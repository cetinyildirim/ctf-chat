import { Router } from 'express';
import { z } from 'zod';
import { schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeTeam } from '../serializers.js';
import { emitChannelsRefresh } from '../../realtime/broadcasters.js';
import { logoImageUpload } from '../../lib/upload.js';
import { removeLogoFiles, writeLogoFile } from '../../lib/logo-files.js';
import {
  assignUserAsTeamCaptain,
  createTeamWithSlug,
} from '../../lib/team-create.js';
import { removeUserFromServerTeam, assignUserToServerTeam } from '../../lib/team-membership.js';
import { buildSessionUser } from '../../lib/session-user.js';
import { requireServerMember, serverMemberJoinFields } from '../../lib/server-membership.js';
import { assignDefaultRoleToMember } from '../../lib/assign-default-server-role.js';
import { inviteAcceptLimiter } from '../../middleware/ratelimit.js';

const router: Router = Router();

router.use(requireAuth);

async function findTeamByInviteCode(inviteCode: string, serverId?: string) {
  const code = inviteCode.trim();
  const matches = await prisma.team.findMany({
    where: {
      inviteCode: code,
      serverId: serverId ?? { not: null },
    },
    select: {
      id: true,
      name: true,
      color: true,
      logoUrl: true,
      serverId: true,
      inviteCode: true,
      server: { select: { id: true, name: true, slug: true, iconUrl: true } },
      _count: { select: { serverMembers: true } },
    },
  });
  if (matches.length === 0) throw BadRequest('Invalid team invite code', 'BAD_TEAM_CODE');
  if (matches.length > 1 && !serverId) {
    throw BadRequest('Ambiguous invite code; specify the competition server', 'AMBIGUOUS_TEAM_CODE');
  }
  return matches[0]!;
}

/** Preview a team invite before joining (logged-in users). */
router.get(
  '/join-preview',
  validate(z.object({ inviteCode: z.string().trim().min(4).max(64), serverId: z.string().cuid().optional() }), 'query'),
  async (req, res, next) => {
    try {
      const query = req.query as { inviteCode: string; serverId?: string };
      const team = await findTeamByInviteCode(query.inviteCode, query.serverId);
      const userId = req.user!.id;
      const existing = team.serverId
        ? await prisma.serverTeamMember.findUnique({
            where: { userId_serverId: { userId, serverId: team.serverId } },
          })
        : null;
      res.json({
        team: {
          id: team.id,
          name: team.name,
          color: team.color,
          logoUrl: team.logoUrl,
          memberCount: team._count.serverMembers,
          server: team.server,
        },
        alreadyOnTeam: existing?.teamId === team.id,
        alreadyOnOtherTeam: !!existing && existing.teamId !== team.id,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Join an existing team with its invite code. Used by open-registration users
 * who signed up without a team and later receive a captain/admin invite.
 */
router.post(
  '/join',
  inviteAcceptLimiter,
  validate(schemas.joinTeamByInviteSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof schemas.joinTeamByInviteSchema>;
      const userId = req.user!.id;
      const team = await findTeamByInviteCode(body.inviteCode, body.serverId);
      if (!team.serverId || !team.server) throw BadRequest('This team is not attached to a competition');

      const serverId = team.serverId;
      const existing = await prisma.serverTeamMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
      });
      if (existing?.teamId === team.id) {
        const fresh = await prisma.team.findUniqueOrThrow({
          where: { id: team.id },
          include: { _count: { select: { serverMembers: true } } },
        });
        res.json({
          team: serializeTeam(fresh, { memberCount: fresh._count.serverMembers }),
          me: await buildSessionUser(userId),
          alreadyMember: true,
        });
        return;
      }
      if (existing) throw BadRequest('You are already on a different team in this competition');

      // Ensure competition membership (open registrants may be on another home server).
      const serverMember = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
      });
      if (serverMember?.bannedAt) throw Forbidden('You are banned from this server');
      if (!serverMember) {
        const joinFields = await serverMemberJoinFields(serverId);
        await prisma.serverMember.create({
          data: { userId, serverId, ...joinFields },
        });
        await assignDefaultRoleToMember(userId, serverId);
      }

      await assignUserToServerTeam(prisma, { userId, serverId, teamId: team.id });
      await audit({
        actorId: userId,
        action: 'team.join',
        target: team.id,
        meta: { serverId, inviteCode: team.inviteCode },
      });
      emitChannelsRefresh(serverId);

      const fresh = await prisma.team.findUniqueOrThrow({
        where: { id: team.id },
        include: { _count: { select: { serverMembers: true } } },
      });
      res.json({
        team: serializeTeam(fresh, { memberCount: fresh._count.serverMembers }),
        me: await buildSessionUser(userId),
        alreadyMember: false,
      });
    } catch (err) {
      next(err);
    }
  },
);

/** Captain (or staff managing their team) can read the invite code to share with members. */
router.get('/invite', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const team = await prisma.team.findFirst({
      where: { captainId: userId },
      select: { id: true, inviteCode: true, name: true, serverId: true },
    });
    if (!team) throw Forbidden('Only the team captain can view the invite code');
    res.json({ inviteCode: team.inviteCode, teamId: team.id, serverId: team.serverId });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(schemas.createTeamByUserSchema), async (req, res, next) => {
  try {
    const data = req.body as z.infer<typeof schemas.createTeamByUserSchema>;
    const userId = req.user!.id;
    const me = await prisma.user.findUnique({ where: { id: userId } });
    if (!me) throw NotFound();
    await requireServerMember(userId, data.serverId);
    const existingOnServer = await prisma.serverTeamMember.findUnique({
      where: { userId_serverId: { userId, serverId: data.serverId } },
    });
    if (existingOnServer) throw BadRequest('You are already on a team in this server');

    const team = await createTeamWithSlug(prisma, {
      serverId: data.serverId,
      name: data.name,
      tagline: data.tagline,
      color: data.color,
    });
    await assignUserAsTeamCaptain(prisma, team.id, userId, data.serverId);

    await audit({
      actorId: userId,
      action: 'team.create',
      target: team.id,
      meta: { name: team.name, byUser: true },
    });
    emitChannelsRefresh(data.serverId);

    const fresh = await prisma.team.findUniqueOrThrow({
      where: { id: team.id },
      include: { _count: { select: { members: true } } },
    });
    res.status(201).json({
      team: serializeTeam(fresh, { memberCount: fresh._count.members }),
      me: await buildSessionUser(userId),
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/membership', validate(schemas.leaveServerTeamSchema), async (req, res, next) => {
  try {
    const { serverId } = req.body as z.infer<typeof schemas.leaveServerTeamSchema>;
    const userId = req.user!.id;
    await removeUserFromServerTeam(prisma, userId, serverId);
    await audit({ actorId: userId, action: 'team.leave', meta: { serverId } });
    emitChannelsRefresh(serverId);
    res.json({ me: await buildSessionUser(userId) });
  } catch (err) {
    next(err);
  }
});

async function captainTeam(userId: string) {
  const team = await prisma.team.findFirst({ where: { captainId: userId } });
  if (!team) throw Forbidden('Only the team captain can manage the team logo');
  return team;
}

router.post('/logo', logoImageUpload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Image file required' } });
      return;
    }
    const team = await captainTeam(req.user!.id);
    const url = await writeLogoFile('team', team.id, file.buffer, file.originalname);
    const updated = await prisma.team.update({
      where: { id: team.id },
      data: { logoUrl: url },
      include: { _count: { select: { members: true } } },
    });
    await audit({
      actorId: req.user?.id,
      action: 'team.logo',
      target: team.id,
      meta: { name: team.name, byCaptain: true },
    });
    if (team.serverId) emitChannelsRefresh(team.serverId);
    res.json({ team: serializeTeam(updated, { memberCount: updated._count.members }) });
  } catch (err) {
    next(err);
  }
});

router.delete('/logo', async (req, res, next) => {
  try {
    const team = await captainTeam(req.user!.id);
    await removeLogoFiles('team', team.id);
    const updated = await prisma.team.update({
      where: { id: team.id },
      data: { logoUrl: null },
      include: { _count: { select: { members: true } } },
    });
    await audit({ actorId: req.user?.id, action: 'team.logo.clear', target: team.id });
    if (team.serverId) emitChannelsRefresh(team.serverId);
    res.json({ team: serializeTeam(updated, { memberCount: updated._count.members }) });
  } catch (err) {
    next(err);
  }
});

export default router;
