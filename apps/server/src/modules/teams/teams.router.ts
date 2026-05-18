import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { NotFound } from '../../lib/http-error.js';
import { serializeTeam, serializeUser } from '../serializers.js';
import { getScoreboard } from '../scoreboard/scoreboard.service.js';
import teamsMyRouter from './teams-my.router.js';

const router: Router = Router();

router.use(requireAuth);

router.use('/my', teamsMyRouter);

router.get('/', async (_req, res, next) => {
  try {
    const board = await getScoreboard();
    res.json({ teams: board.entries.map((e) => e.team) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound('Team not found');
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        members: { include: { team: true } },
        _count: { select: { members: true, solves: true } },
        solves: { select: { firstBlood: true } },
      },
    });
    if (!team) throw NotFound('Team not found');
    const bloodCount = team.solves.filter((s) => s.firstBlood).length;
    res.json({
      team: serializeTeam(team, {
        memberCount: team._count.members,
        solveCount: team._count.solves,
        bloodCount,
      }),
      members: team.members.map(serializeUser),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
