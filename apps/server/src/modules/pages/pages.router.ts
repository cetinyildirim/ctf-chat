import { Router } from 'express';
import { z } from 'zod';
import type { PlatformPage as PlatformPageDto } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { NotFound } from '../../lib/http-error.js';
import { validate } from '../../middleware/validate.js';

const router: Router = Router();

const slugSchema = z.object({ slug: z.string().min(1).max(80) });

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

router.get('/:slug', validate(slugSchema, 'params'), async (req, res, next) => {
  try {
    const slug = req.params.slug!.toLowerCase();
    const row = await prisma.platformPage.findFirst({
      where: { slug, published: true },
    });
    if (!row) throw NotFound();
    res.json({ page: serializePage(row) });
  } catch (err) {
    next(err);
  }
});

export default router;
