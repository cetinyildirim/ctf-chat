import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getScoreboard, getSolveTimeline } from './scoreboard.service.js';

const router: Router = Router();

router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try {
    const snap = await getScoreboard();
    res.json(snap);
  } catch (err) {
    next(err);
  }
});

router.get('/timeline', async (_req, res, next) => {
  try {
    const points = await getSolveTimeline(500);
    res.json({ points });
  } catch (err) {
    next(err);
  }
});

export default router;
