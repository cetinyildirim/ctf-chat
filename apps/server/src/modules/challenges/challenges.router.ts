import { Router } from 'express';
import { Permission, schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeChallenge, serializeHint } from '../serializers.js';

const router: Router = Router();

router.use(requireAuth);

router.get('/', validate(schemas.listChallengesQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filters = req.query as ReturnType<typeof schemas.listChallengesQuerySchema.parse>;
    const where: Record<string, unknown> = { isReleased: true };
    if (filters.category) where.category = filters.category;
    if (filters.difficulty) where.difficulty = filters.difficulty;
    if (filters.q) where.title = { contains: filters.q };

    const challenges = await prisma.challenge.findMany({
      where,
      include: {
        _count: { select: { solves: true, hints: true } },
        discussionChannel: true,
        author: { select: { displayName: true } },
      },
      orderBy: [{ category: 'asc' }, { difficulty: 'asc' }, { points: 'asc' }],
    });

    const teamId = req.user!.teamId;
    let mySolves = new Set<string>();
    if (teamId) {
      const solves = await prisma.solve.findMany({
        where: { teamId },
        select: { challengeId: true },
      });
      mySolves = new Set(solves.map((s) => s.challengeId));
    }

    const all = challenges.map((c) =>
      serializeChallenge(c, { mySolves, authorName: c.author?.displayName ?? null }),
    );

    let filtered = all;
    if (filters.solved === 'true') filtered = all.filter((c) => c.isSolvedByMyTeam);
    if (filters.solved === 'false') filtered = all.filter((c) => !c.isSolvedByMyTeam);

    res.json({ challenges: filtered });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound();
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: {
        _count: { select: { solves: true, hints: true } },
        discussionChannel: true,
        hints: { orderBy: { order: 'asc' } },
        author: { select: { displayName: true } },
        solves: {
          orderBy: { solvedAt: 'asc' },
          include: { team: { select: { id: true, name: true, color: true } } },
        },
      },
    });
    if (!challenge) throw NotFound('Challenge not found');

    const teamId = req.user!.teamId;
    let unlockedHintIds = new Set<string>();
    let mySolves = new Set<string>();
    if (teamId) {
      const [unlocks, solves] = await Promise.all([
        prisma.hintUnlock.findMany({
          where: { teamId, hint: { challengeId: id } },
          select: { hintId: true },
        }),
        prisma.solve.findMany({ where: { teamId }, select: { challengeId: true } }),
      ]);
      unlockedHintIds = new Set(unlocks.map((u) => u.hintId));
      mySolves = new Set(solves.map((s) => s.challengeId));
    }

    const serialized = serializeChallenge(challenge, {
      mySolves,
      authorName: challenge.author?.displayName ?? null,
    });

    res.json({
      challenge: serialized,
      hints: challenge.hints.map((h) => serializeHint(h, { unlocked: unlockedHintIds.has(h.id) })),
      solves: challenge.solves.map((s) => ({
        team: s.team,
        solvedAt: s.solvedAt.toISOString(),
        firstBlood: s.firstBlood,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/hints/:hintId/unlock',
  requirePermission(Permission.CHALLENGE_REQUEST_HINT),
  async (req, res, next) => {
    try {
      const hintId = req.params.hintId;
      if (!hintId) throw NotFound();
      const teamId = req.user!.teamId;
      if (!teamId) throw BadRequest('Only team members can request hints', 'NO_TEAM');
      const hint = await prisma.hint.findUnique({ where: { id: hintId } });
      if (!hint) throw NotFound('Hint not found');
      const existing = await prisma.hintUnlock.findUnique({
        where: { hintId_teamId: { hintId, teamId } },
      });
      if (existing) {
        return res.json({ hint: serializeHint(hint, { unlocked: true }) });
      }
      await prisma.hintUnlock.create({
        data: { hintId, teamId, userId: req.user!.id },
      });
      await audit({
        actorId: req.user?.id,
        action: 'hint.unlock',
        target: hintId,
        meta: { teamId, cost: hint.cost },
      });
      res.json({ hint: serializeHint(hint, { unlocked: true }) });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
