import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { NotFound } from '../../lib/http-error.js';
import { prisma } from '../../prisma.js';
import { resolveLogoFile, streamLogoFile } from '../../lib/logo-files.js';
import { isStaff } from '@sydt/shared';
import { loadChannel, assertCanAccessChannel } from '../messages/access.js';

const router: Router = Router();

router.use(requireAuth);

router.get('/category/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound();
    const cat = await prisma.category.findUnique({ where: { id } });
    if (!cat) throw NotFound();
    if (cat.staffOnly && !isStaff(req.user!.role)) throw NotFound();
    const resolved = await resolveLogoFile('category', id);
    if (!resolved) throw NotFound();
    streamLogoFile(resolved.abs, resolved.mime, res);
  } catch (err) {
    next(err);
  }
});

router.get('/channel/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound();
    const channel = await loadChannel(id);
    await assertCanAccessChannel(channel, req.user!);
    const resolved = await resolveLogoFile('channel', id);
    if (!resolved) throw NotFound();
    streamLogoFile(resolved.abs, resolved.mime, res);
  } catch (err) {
    next(err);
  }
});

router.get('/team/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound();
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) throw NotFound();
    const resolved = await resolveLogoFile('team', id);
    if (!resolved) throw NotFound();
    streamLogoFile(resolved.abs, resolved.mime, res);
  } catch (err) {
    next(err);
  }
});

router.get('/server/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound();
    const resolved = await resolveLogoFile('server', id);
    if (!resolved) throw NotFound();
    streamLogoFile(resolved.abs, resolved.mime, res);
  } catch (err) {
    next(err);
  }
});

router.get('/user/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound();
    const u = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!u) throw NotFound();
    const resolved = await resolveLogoFile('user', id);
    if (!resolved) throw NotFound();
    streamLogoFile(resolved.abs, resolved.mime, res);
  } catch (err) {
    next(err);
  }
});

export default router;
