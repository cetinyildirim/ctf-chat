import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getPlatformBranding, getUploadMaxMb } from '../../lib/platform-settings.js';

const router: Router = Router();

router.get('/branding', async (_req, res, next) => {
  try {
    const branding = await getPlatformBranding();
    res.json(branding);
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const branding = await getPlatformBranding();
    res.json({ uploadMaxMb: branding.uploadMaxMb });
  } catch (err) {
    next(err);
  }
});

export default router;
