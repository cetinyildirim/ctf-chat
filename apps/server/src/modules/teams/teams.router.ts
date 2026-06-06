import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { NotFound } from '../../lib/http-error.js';
import { serializeTeam, serializeUser } from '../serializers.js';
import { getScoreboard } from '../scoreboard/scoreboard.service.js';
import { ctfdScoreboardUrl, fetchCtfdTeamStats } from '../../lib/ctfd-client.js';
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
    const board = await getScoreboard();
    const entry = board.entries.find((e) => e.team.id === id);
    res.json({
      team: serializeTeam(team, {
        memberCount: team._count.members,
        solveCount: entry?.solveCount ?? team._count.solves,
        bloodCount: entry?.bloodCount ?? bloodCount,
        score: entry?.score ?? 0,
        rank: entry?.rank ?? 0,
      }),
      members: team.members.map(serializeUser),
      scoreboard: {
        totalChallenges: board.totalChallenges,
        totalTeams: board.totalTeams,
        generatedAt: board.generatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/ctfd', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound('Team not found');
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) throw NotFound('Team not found');
    if (!team.serverId) {
      res.json({ configured: false, scoreboardUrl: null, stats: null, linked: false });
      return;
    }
    const server = await prisma.chatServer.findUnique({ where: { id: team.serverId } });
    if (!server?.ctfdBaseUrl) {
      res.json({ configured: false, scoreboardUrl: null, stats: null, linked: false });
      return;
    }
    const stats = await fetchCtfdTeamStats(server.ctfdBaseUrl, server.ctfdAccessToken, {
      ctfdTeamId: team.ctfdTeamId,
      teamName: team.name,
    });
    res.json({
      configured: true,
      scoreboardUrl: ctfdScoreboardUrl(server.ctfdBaseUrl),
      stats,
      linked: !!stats,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
