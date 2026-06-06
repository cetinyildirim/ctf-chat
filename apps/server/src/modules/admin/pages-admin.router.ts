import { Router } from 'express';
import { z } from 'zod';
import { schemas } from '@sydt/shared';
import type { PlatformPage as PlatformPageDto } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { Permission } from '@sydt/shared';
import { validate } from '../../middleware/validate.js';
import { BadRequest, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { slugFromTitle, uniquePageSlug } from '../../lib/slug-from-title.js';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const router: Router = Router();
router.use(requireAuth);
router.use(requirePermission(Permission.ADMIN_DASHBOARD));

const idSchema = z.object({ id: z.string().cuid() });

function serializePage(row: {
  id: string;
  title: string;
  slug: string;
  content: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: string | null;
}): PlatformPageDto {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    authorId: row.authorId,
  };
}

router.get('/', async (_req, res, next) => {
  try {
    const rows = await prisma.platformPage.findMany({ orderBy: { updatedAt: 'desc' } });
    res.json({ pages: rows.map(serializePage) });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(schemas.createPlatformPageSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof schemas.createPlatformPageSchema>;
    const rawSlug = body.slug?.trim() ?? '';
    if (rawSlug && !slugRegex.test(rawSlug)) throw BadRequest('Invalid slug format');
    const baseSlug = (rawSlug || slugFromTitle(body.title)).toLowerCase();
    const slug = await uniquePageSlug(baseSlug, async (s) => !!(await prisma.platformPage.findUnique({ where: { slug: s } })));
    const row = await prisma.platformPage.create({
      data: {
        title: body.title.trim(),
        slug,
        content: body.content ?? '',
        published: body.published ?? true,
        authorId: req.user!.id,
      },
    });
    await audit({ actorId: req.user!.id, action: 'admin.page.create', target: row.id, meta: { slug } });
    res.status(201).json({ page: serializePage(row) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', validate(idSchema, 'params'), validate(schemas.updatePlatformPageSchema), async (req, res, next) => {
  try {
    const id = req.params.id!;
    const body = req.body as z.infer<typeof schemas.updatePlatformPageSchema>;
    const existing = await prisma.platformPage.findUnique({ where: { id } });
    if (!existing) throw NotFound();

    let slug = existing.slug;
    if (body.slug !== undefined && body.slug.trim()) {
      const nextSlug = body.slug.trim().toLowerCase();
      if (!slugRegex.test(nextSlug)) throw BadRequest('Invalid slug format');
      const taken = await prisma.platformPage.findFirst({ where: { slug: nextSlug, NOT: { id } } });
      if (taken) throw BadRequest('Slug already in use');
      slug = nextSlug;
    } else if (body.title && !body.slug) {
      const auto = slugFromTitle(body.title);
      if (auto !== existing.slug) {
        slug = await uniquePageSlug(auto, async (s) => {
          const hit = await prisma.platformPage.findFirst({ where: { slug: s, NOT: { id } } });
          return !!hit;
        });
      }
    }

    const row = await prisma.platformPage.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        slug,
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.published !== undefined ? { published: body.published } : {}),
      },
    });
    await audit({ actorId: req.user!.id, action: 'admin.page.update', target: id });
    res.json({ page: serializePage(row) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const id = req.params.id!;
    const existing = await prisma.platformPage.findUnique({ where: { id } });
    if (!existing) throw NotFound();
    await prisma.platformPage.delete({ where: { id } });
    await audit({ actorId: req.user!.id, action: 'admin.page.delete', target: id });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
