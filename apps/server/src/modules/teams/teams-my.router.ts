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

const router: Router = Router();

router.use(requireAuth);

router.post('/', validate(schemas.createTeamByUserSchema), async (req, res, next) => {
  try {
    const data = req.body as z.infer<typeof schemas.createTeamByUserSchema>;
    const userId = req.user!.id;
    const me = await prisma.user.findUnique({ where: { id: userId } });
    if (!me) throw NotFound();
    if (me.teamId) throw BadRequest('You are already on a team');

    const team = await createTeamWithSlug(prisma, {
      name: data.name,
      tagline: data.tagline,
      color: data.color,
    });
    await assignUserAsTeamCaptain(prisma, team.id, userId);

    await audit({
      actorId: userId,
      action: 'team.create',
      target: team.id,
      meta: { name: team.name, byUser: true },
    });
    emitChannelsRefresh();

    const fresh = await prisma.team.findUniqueOrThrow({
      where: { id: team.id },
      include: { _count: { select: { members: true } } },
    });
    res.status(201).json({
      team: serializeTeam(fresh, { memberCount: fresh._count.members }),
      me: serializeUser(
        await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          include: { team: true },
        }),
      ),
    });
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
    emitChannelsRefresh();
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
    emitChannelsRefresh();
    res.json({ team: serializeTeam(updated, { memberCount: updated._count.members }) });
  } catch (err) {
    next(err);
  }
});

export default router;
