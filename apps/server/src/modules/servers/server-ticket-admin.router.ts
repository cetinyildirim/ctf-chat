/**
 * Ticket configuration for one competition, mounted at /api/servers/:id.
 *
 * Covers the admin surface from the spec: categories (§8), tags (§24) and
 * competition lifecycle/ticket policy (§27-28). Everything here needs
 * TICKET_MANAGE_META and is scoped to the server in the path, so an organizer
 * admin of one competition cannot reconfigure another one.
 */
import { Router } from 'express';
import { z } from 'zod';
import { Permission, schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, NotFound } from '../../lib/http-error.js';
import { auditRequest } from '../../lib/audit.js';
import { adminMutationLimiter } from '../../middleware/ratelimit.js';
import { ensureCompetitionDefaults } from '../../lib/ticket-defaults.js';
import { serializeCompetition, serializeTicketCategory, serializeTicketTag } from '../serializers.js';
import { resolveTicketAccess } from '../tickets/ticket-access.js';

const router: Router = Router({ mergeParams: true });
router.use(requireAuth);

const serverIdSchema = z.object({ id: z.string().cuid() });
const childIdSchema = serverIdSchema.extend({ childId: z.string().cuid() });

/** Membership check first, then the permission: no cross-competition edits. */
async function assertMetaAccess(req: { user?: { id: string; role: string } | undefined; params: Record<string, string | undefined> }) {
  const serverId = req.params.id;
  if (!serverId) throw NotFound();
  // Throws NotFound when the viewer is not a member of this competition.
  await resolveTicketAccess(req.user as never, serverId);
  return serverId;
}

function keyFromName(name: string): string {
  return (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 32) || 'CATEGORY'
  );
}

router.get('/ticket-categories', validate(serverIdSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = await assertMetaAccess(req);
    const categories = await prisma.ticketCategory.findMany({
      where: { serverId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { tickets: true } } },
    });
    res.json({
      categories: categories.map((c) => ({
        ...serializeTicketCategory(c),
        ticketCount: c._count.tickets,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/ticket-categories',
  adminMutationLimiter,
  requirePermission(Permission.TICKET_MANAGE_META),
  validate(serverIdSchema, 'params'),
  validate(schemas.ticketCategorySchema),
  async (req, res, next) => {
    try {
      const serverId = await assertMetaAccess(req);
      const body = req.body as z.infer<typeof schemas.ticketCategorySchema>;
      const key = body.key ?? keyFromName(body.name);

      const clash = await prisma.ticketCategory.findFirst({ where: { serverId, key } });
      if (clash) throw BadRequest('A category with this key already exists');

      const last = await prisma.ticketCategory.aggregate({
        where: { serverId },
        _max: { position: true },
      });
      const category = await prisma.ticketCategory.create({
        data: {
          serverId,
          key,
          name: body.name,
          position: body.position ?? (last._max.position ?? -1) + 1,
          isActive: body.isActive ?? true,
          requiresChallenge: body.requiresChallenge ?? false,
        },
      });
      await auditRequest(req, {
        action: 'ticket.category_create',
        target: category.id,
        meta: { serverId, key, name: body.name },
      });
      res.status(201).json({ category: serializeTicketCategory(category) });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/ticket-categories/:childId',
  adminMutationLimiter,
  requirePermission(Permission.TICKET_MANAGE_META),
  validate(childIdSchema, 'params'),
  validate(schemas.ticketCategorySchema.partial()),
  async (req, res, next) => {
    try {
      const serverId = await assertMetaAccess(req);
      const existing = await prisma.ticketCategory.findFirst({
        where: { id: req.params.childId!, serverId },
      });
      if (!existing) throw NotFound('Category not found');

      const body = req.body as Partial<z.infer<typeof schemas.ticketCategorySchema>>;
      const category = await prisma.ticketCategory.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.position !== undefined ? { position: body.position } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.requiresChallenge !== undefined
            ? { requiresChallenge: body.requiresChallenge }
            : {}),
        },
      });
      await auditRequest(req, {
        action: 'ticket.category_update',
        target: category.id,
        meta: { serverId, changes: body },
      });
      res.json({ category: serializeTicketCategory(category) });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Categories in use are deactivated rather than deleted, so historical tickets
 * keep their classification (spec §48 data retention).
 */
router.delete(
  '/ticket-categories/:childId',
  adminMutationLimiter,
  requirePermission(Permission.TICKET_MANAGE_META),
  validate(childIdSchema, 'params'),
  async (req, res, next) => {
    try {
      const serverId = await assertMetaAccess(req);
      const existing = await prisma.ticketCategory.findFirst({
        where: { id: req.params.childId!, serverId },
        include: { _count: { select: { tickets: true } } },
      });
      if (!existing) throw NotFound('Category not found');

      if (existing._count.tickets > 0) {
        const category = await prisma.ticketCategory.update({
          where: { id: existing.id },
          data: { isActive: false },
        });
        await auditRequest(req, {
          action: 'ticket.category_deactivate',
          target: category.id,
          meta: { serverId, ticketCount: existing._count.tickets },
        });
        res.json({ category: serializeTicketCategory(category), deactivated: true });
        return;
      }

      await prisma.ticketCategory.delete({ where: { id: existing.id } });
      await auditRequest(req, {
        action: 'ticket.category_delete',
        target: existing.id,
        meta: { serverId, key: existing.key },
      });
      res.json({ ok: true, deactivated: false });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/ticket-tags', validate(serverIdSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = await assertMetaAccess(req);
    const tags = await prisma.tag.findMany({
      where: { serverId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { tickets: true } } },
    });
    res.json({
      tags: tags.map((t) => ({ ...serializeTicketTag(t), ticketCount: t._count.tickets })),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/ticket-tags',
  adminMutationLimiter,
  requirePermission(Permission.TICKET_MANAGE_META),
  validate(serverIdSchema, 'params'),
  validate(schemas.ticketTagSchema),
  async (req, res, next) => {
    try {
      const serverId = await assertMetaAccess(req);
      const body = req.body as z.infer<typeof schemas.ticketTagSchema>;
      const name = body.name.toUpperCase();

      const clash = await prisma.tag.findFirst({ where: { serverId, name } });
      if (clash) throw BadRequest('A tag with this name already exists');

      const tag = await prisma.tag.create({
        data: { serverId, name, ...(body.color ? { color: body.color } : {}) },
      });
      await auditRequest(req, {
        action: 'ticket.tag_create',
        target: tag.id,
        meta: { serverId, name },
      });
      res.status(201).json({ tag: serializeTicketTag(tag) });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/ticket-tags/:childId',
  adminMutationLimiter,
  requirePermission(Permission.TICKET_MANAGE_META),
  validate(childIdSchema, 'params'),
  async (req, res, next) => {
    try {
      const serverId = await assertMetaAccess(req);
      const existing = await prisma.tag.findFirst({ where: { id: req.params.childId!, serverId } });
      if (!existing) throw NotFound('Tag not found');

      await prisma.tag.delete({ where: { id: existing.id } });
      await auditRequest(req, {
        action: 'ticket.tag_delete',
        target: existing.id,
        meta: { serverId, name: existing.name },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/competition', validate(serverIdSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = await assertMetaAccess(req);
    const { competition } = await ensureCompetitionDefaults(serverId);
    res.json({ competition: serializeCompetition(competition) });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/competition',
  adminMutationLimiter,
  requirePermission(Permission.TICKET_MANAGE_META),
  validate(serverIdSchema, 'params'),
  validate(schemas.patchCompetitionSchema),
  async (req, res, next) => {
    try {
      const serverId = await assertMetaAccess(req);
      const body = req.body as z.infer<typeof schemas.patchCompetitionSchema>;
      const { competition } = await ensureCompetitionDefaults(serverId);

      // Cross-field validation against the stored values, not just the payload.
      const startsAt = body.startsAt !== undefined ? body.startsAt : competition.startsAt;
      const endsAt = body.endsAt !== undefined ? body.endsAt : competition.endsAt;
      if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
        throw BadRequest('Competition must start before it ends');
      }

      const updated = await prisma.competitionSettings.update({
        where: { serverId },
        data: {
          ...(body.startsAt !== undefined
            ? { startsAt: body.startsAt ? new Date(body.startsAt) : null }
            : {}),
          ...(body.endsAt !== undefined
            ? { endsAt: body.endsAt ? new Date(body.endsAt) : null }
            : {}),
          ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.ticketPolicy !== undefined ? { ticketPolicy: body.ticketPolicy } : {}),
          ...(body.archived !== undefined
            ? { archivedAt: body.archived ? new Date() : null }
            : {}),
        },
      });
      await auditRequest(req, {
        action: 'competition.update',
        target: serverId,
        meta: { serverId, changes: body },
      });
      res.json({ competition: serializeCompetition(updated) });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
