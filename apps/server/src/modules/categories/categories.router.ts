import { Router } from 'express';
import { schemas, Permission } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { logoImageUpload } from '../../lib/upload.js';
import { removeLogoFiles, writeLogoFile } from '../../lib/logo-files.js';
import { emitChannelsRefresh } from '../../realtime/broadcasters.js';
import { provisionTeamRoomsForCategory } from './category-team-rooms.service.js';

const router: Router = Router();

router.use(requireAuth);

router.post(
  '/',
  requirePermission(Permission.CATEGORY_MANAGE),
  validate(schemas.createCategorySchema),
  async (req, res, next) => {
    try {
      const data = req.body as ReturnType<typeof schemas.createCategorySchema.parse>;
      const maxPos = await prisma.category.findFirst({ orderBy: { position: 'desc' } });
      const position =
        data.position !== undefined ? data.position : (maxPos?.position ?? 0) + 1;
      const cat = await prisma.category.create({
        data: {
          name: data.name.trim(),
          position,
          staffOnly: data.staffOnly ?? false,
        },
      });
      await provisionTeamRoomsForCategory(prisma, cat);
      await audit({ actorId: req.user?.id, action: 'category.create', target: cat.id });
      emitChannelsRefresh();
      res.status(201).json({
        category: {
          id: cat.id,
          name: cat.name,
          position: cat.position,
          logoUrl: cat.logoUrl,
          staffOnly: cat.staffOnly,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id',
  requirePermission(Permission.CATEGORY_MANAGE),
  validate(schemas.updateCategorySchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const data = req.body as ReturnType<typeof schemas.updateCategorySchema.parse>;
      const cat = await prisma.category.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.position !== undefined ? { position: data.position } : {}),
          ...(data.staffOnly !== undefined ? { staffOnly: data.staffOnly } : {}),
        },
      });
      await audit({ actorId: req.user?.id, action: 'category.update', target: id, meta: data });
      emitChannelsRefresh();
      res.json({
        category: {
          id: cat.id,
          name: cat.name,
          position: cat.position,
          logoUrl: cat.logoUrl,
          staffOnly: cat.staffOnly,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/logo',
  requirePermission(Permission.CATEGORY_MANAGE),
  logoImageUpload.single('file'),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Image file required' } });
        return;
      }
      const exists = await prisma.category.findUnique({ where: { id } });
      if (!exists) throw NotFound('Category not found');
      const url = await writeLogoFile('category', id, file.buffer, file.originalname);
      const cat = await prisma.category.update({
        where: { id },
        data: { logoUrl: url },
      });
      await audit({ actorId: req.user?.id, action: 'category.logo', target: id });
      emitChannelsRefresh();
      res.json({
        category: {
          id: cat.id,
          name: cat.name,
          position: cat.position,
          logoUrl: cat.logoUrl,
          staffOnly: cat.staffOnly,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  requirePermission(Permission.CATEGORY_MANAGE),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const exists = await prisma.category.findUnique({ where: { id } });
      if (!exists) throw NotFound('Category not found');
      await prisma.category.delete({ where: { id } });
      await audit({ actorId: req.user?.id, action: 'category.delete', target: id, meta: { name: exists.name } });
      emitChannelsRefresh();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id/logo',
  requirePermission(Permission.CATEGORY_MANAGE),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const exists = await prisma.category.findUnique({ where: { id } });
      if (!exists) throw NotFound('Category not found');
      await removeLogoFiles('category', id);
      const cat = await prisma.category.update({
        where: { id },
        data: { logoUrl: null },
      });
      await audit({ actorId: req.user?.id, action: 'category.logo.clear', target: id });
      emitChannelsRefresh();
      res.json({
        category: {
          id: cat.id,
          name: cat.name,
          position: cat.position,
          logoUrl: null,
          staffOnly: cat.staffOnly,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
