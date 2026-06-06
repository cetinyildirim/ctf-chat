import { Router } from 'express';
import { z } from 'zod';
import { schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeTeam, serializeUser } from '../serializers.js';
import { emitChannelsRefresh } from '../../realtime/broadcasters.js';
import { logoImageUpload } from '../../lib/upload.js';
import { removeLogoFiles, writeLogoFile } from '../../lib/logo-files.js';
import {
  assignUserAsTeamCaptain,
  createTeamWithSlug,
} from '../../lib/team-create.js';
import { removeUserFromServerTeam } from '../../lib/team-membership.js';
import { buildSessionUser } from '../../lib/session-user.js';
import { requireServerMember } from '../../lib/server-membership.js';

const router: Router = Router();

router.use(requireAuth);

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
