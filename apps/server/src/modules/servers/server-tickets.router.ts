/**
 * Competition-scoped ticket endpoints, mounted at /api/servers/:id.
 *
 * Listing and creation live here because both need the competition as explicit
 * context; per-ticket operations live in modules/tickets (the scope is derived
 * from the ticket itself there).
 */
import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  Permission,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  canTransitionTicketStatus,
  schemas,
} from '@sydt/shared';
import type { Prisma } from '@prisma/client';
import type { TicketMeta, TicketStatus } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { parseOrThrow, validate } from '../../middleware/validate.js';
import { ticketAttachmentUpload } from '../../lib/upload.js';
import {
  MAX_TICKET_ATTACHMENTS,
  TICKET_ATTACHMENT_FIELD,
  attachFilesToTicketEvent,
  discardUploads,
  isMultipart,
  uploadedFiles,
} from '../tickets/ticket-attachments.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/http-error.js';
import { auditRequest } from '../../lib/audit.js';
import { ticketCreateLimiter } from '../../middleware/ratelimit.js';
import { ensureCompetitionDefaults } from '../../lib/ticket-defaults.js';
import { serializeCompetition, serializeTicketCategory, serializeTicketTag } from '../serializers.js';
import { emitTicketCreated, emitTicketUpdated } from '../../realtime/broadcasters.js';
import {
  TICKET_INCLUDE,
  resolveTicketAccess,
  ticketScopeWhere,
} from '../tickets/ticket-access.js';
import {
  allocateTicketNumber,
  priorityRankOf,
  projectTicketList,
  recordTicketEvent,
  statusTimestamps,
  ticketEventTypeForStatus,
} from '../tickets/ticket-service.js';
import {
  notifyTicketAssigned,
  notifyTicketCreated,
  notifyTicketStatus,
} from '../tickets/ticket-notify.js';

const router: Router = Router({ mergeParams: true });
router.use(requireAuth);

const serverIdSchema = z.object({ id: z.string().cuid() });

/** Only engages multer when the request actually carries files. */
const ticketMultipart: RequestHandler = (req, res, next) => {
  if (!isMultipart(req)) return next();
  return ticketAttachmentUpload.array(TICKET_ATTACHMENT_FIELD, MAX_TICKET_ATTACHMENTS)(
    req,
    res,
    next,
  );
};

function serverIdOf(req: { params: Record<string, string | undefined> }): string {
  const id = req.params.id;
  if (!id) throw NotFound();
  return id;
}

/** Filters supplied by the client are intersected with the scope clause. */
function buildFilters(
  query: z.infer<typeof schemas.ticketQuerySchema>,
  access: Awaited<ReturnType<typeof resolveTicketAccess>>,
): Prisma.TicketWhereInput {
  const and: Prisma.TicketWhereInput[] = [ticketScopeWhere(access)];

  if (query.status?.length) and.push({ status: { in: query.status } });
  if (query.priority?.length) and.push({ priority: { in: query.priority } });
  if (query.categoryId) and.push({ categoryId: query.categoryId });
  if (query.challengeId) and.push({ challengeId: query.challengeId });
  if (query.tagId) and.push({ tags: { some: { tagId: query.tagId } } });
  if (query.from) and.push({ createdAt: { gte: new Date(query.from) } });
  if (query.to) and.push({ createdAt: { lte: new Date(query.to) } });
  if (query.q) {
    and.push({
      OR: [
        { code: { contains: query.q } },
        { title: { contains: query.q } },
        { body: { contains: query.q } },
      ],
    });
  }

  // Organizer-only filters: silently ignored for competitors so they cannot use
  // them to probe other teams.
  if (access.canViewAll) {
    if (query.teamId) and.push({ teamId: query.teamId });
    if (query.unassigned) and.push({ assignedToId: null });
    else if (query.assignedToId) and.push({ assignedToId: query.assignedToId });
  }

  if (query.scope === 'mine') and.push({ openedById: access.viewerId });
  else if (query.scope === 'team') {
    if (!access.teamId) and.push({ id: '__none__' });
    else and.push({ teamId: access.teamId });
  }

  return { AND: and };
}

function orderFor(sort: 'updated' | 'created' | 'priority'): Prisma.TicketOrderByWithRelationInput[] {
  if (sort === 'created') return [{ createdAt: 'desc' }, { id: 'desc' }];
  if (sort === 'priority') return [{ priorityRank: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }];
  return [{ updatedAt: 'desc' }, { id: 'desc' }];
}

router.get(
  '/tickets',
  validate(serverIdSchema, 'params'),
  validate(schemas.ticketQuerySchema, 'query'),
  async (req, res, next) => {
    try {
      const serverId = serverIdOf(req);
      const access = await resolveTicketAccess(req.user!, serverId);
      const query = req.query as unknown as z.infer<typeof schemas.ticketQuerySchema>;
      const where = buildFilters(query, access);

      const [rows, total] = await Promise.all([
        prisma.ticket.findMany({
          where,
          orderBy: orderFor(query.sort),
          take: query.limit + 1,
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
          include: TICKET_INCLUDE,
        }),
        prisma.ticket.count({ where }),
      ]);

      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      res.json({
        tickets: await projectTicketList(page, access),
        nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
        total,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/tickets/meta', validate(serverIdSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = serverIdOf(req);
    const access = await resolveTicketAccess(req.user!, serverId);
    const { competition } = await ensureCompetitionDefaults(serverId);

    const [categories, tags, challenges, team] = await Promise.all([
      prisma.ticketCategory.findMany({
        where: { serverId, isActive: true },
        orderBy: { position: 'asc' },
      }),
      prisma.tag.findMany({ where: { serverId }, orderBy: { name: 'asc' } }),
      prisma.challenge.findMany({
        where: {
          isReleased: true,
          discussionChannel: { serverId },
        },
        select: { id: true, title: true, category: true },
        orderBy: { title: 'asc' },
        take: 500,
      }),
      access.teamId
        ? prisma.team.findUnique({
            where: { id: access.teamId },
            select: { id: true, name: true, color: true },
          })
        : Promise.resolve(null),
    ]);

    const meta: TicketMeta = {
      categories: categories.map(serializeTicketCategory),
      tags: tags.map(serializeTicketTag),
      statuses: [...TICKET_STATUSES],
      priorities: [...TICKET_PRIORITIES],
      challenges: challenges.map((c) => ({ id: c.id, title: c.title, category: c.category })),
      competition: serializeCompetition(competition),
      canCreate: ticketCreationAllowed(competition, access).allowed,
      canViewAll: access.canViewAll,
      team,
    };
    res.json(meta);
  } catch (err) {
    next(err);
  }
});

/** Competition state gate for opening new tickets (spec: competition pause). */
export function ticketCreationAllowed(
  competition: { ticketPolicy: string; status: string },
  access: { canViewAll: boolean; isPlatformAdmin: boolean },
): { allowed: boolean; reason?: string } {
  if (access.isPlatformAdmin) return { allowed: true };
  if (competition.ticketPolicy === 'CLOSED') {
    return { allowed: false, reason: 'Ticket creation is closed for this competition' };
  }
  if (competition.ticketPolicy === 'ORGANIZER_ONLY' && !access.canViewAll) {
    return { allowed: false, reason: 'Only organizers may open tickets right now' };
  }
  if (competition.status === 'FINISHED' && !access.canViewAll) {
    return { allowed: false, reason: 'Competition has finished' };
  }
  return { allowed: true };
}

/**
 * Multipart bodies deliver every field as a string, so the payload is
 * normalized before it reaches the shared zod schema.
 */
function ticketCreateInput(req: Request): z.infer<typeof schemas.createTicketSchema> {
  if (!isMultipart(req)) {
    return parseOrThrow(schemas.createTicketSchema, req.body);
  }
  const raw = req.body as Record<string, string | undefined>;
  return parseOrThrow(schemas.createTicketSchema, {
    title: raw.title,
    body: raw.body,
    ...(raw.priority ? { priority: raw.priority } : {}),
    ...(raw.categoryId ? { categoryId: raw.categoryId } : {}),
    ...(raw.challengeId ? { challengeId: raw.challengeId } : {}),
    ...(raw.tagIds
      ? { tagIds: raw.tagIds.split(',').map((s) => s.trim()).filter(Boolean) }
      : {}),
  });
}

router.post(
  '/tickets',
  ticketCreateLimiter,
  requirePermission(Permission.TICKET_CREATE),
  validate(serverIdSchema, 'params'),
  ticketMultipart,
  async (req, res, next) => {
    const files = uploadedFiles(req);
    try {
      const serverId = serverIdOf(req);
      const access = await resolveTicketAccess(req.user!, serverId);
      const body = ticketCreateInput(req);
      const { competition } = await ensureCompetitionDefaults(serverId);

      const gate = ticketCreationAllowed(competition, access);
      if (!gate.allowed) throw Forbidden(gate.reason);

      // Category, challenge and tags must belong to this competition.
      const category = body.categoryId
        ? await prisma.ticketCategory.findFirst({
            where: { id: body.categoryId, serverId, isActive: true },
          })
        : null;
      if (body.categoryId && !category) throw BadRequest('Unknown ticket category');

      let challengeId: string | null = null;
      if (body.challengeId) {
        const challenge = await prisma.challenge.findFirst({
          where: { id: body.challengeId, discussionChannel: { serverId } },
          select: { id: true },
        });
        if (!challenge) throw BadRequest('Unknown challenge for this competition');
        challengeId = challenge.id;
      }
      if (category?.requiresChallenge && !challengeId) {
        throw BadRequest('This category requires a challenge');
      }

      const tagIds = body.tagIds?.length
        ? (
            await prisma.tag.findMany({
              where: { serverId, id: { in: body.tagIds } },
              select: { id: true },
            })
          ).map((t) => t.id)
        : [];

      const { seq, code } = await allocateTicketNumber(serverId);

      const ticket = await prisma.ticket.create({
        data: {
          serverId,
          seq,
          code,
          title: body.title,
          body: body.body,
          priority: body.priority,
          priorityRank: priorityRankOf(body.priority),
          categoryId: category?.id ?? null,
          challengeId,
          // Never trust a client-supplied team: it comes from membership only.
          teamId: access.teamId,
          openedById: req.user!.id,
          status: 'OPEN',
          events: {
            create: { type: 'CREATED', authorId: req.user!.id, body: body.body },
          },
          ...(tagIds.length ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {}),
        },
        include: { ...TICKET_INCLUDE, events: { select: { id: true } } },
      });

      if (files.length > 0) {
        const createdEvent = ticket.events[0];
        try {
          await attachFilesToTicketEvent({
            ticketEventId: createdEvent!.id,
            uploadedById: req.user!.id,
            files,
          });
        } catch (err) {
          // A rejected file must not leave a ticket without its evidence.
          await prisma.ticket.delete({ where: { id: ticket.id } }).catch(() => undefined);
          throw err;
        }
        await auditRequest(req, {
          action: 'ticket.attachment_upload',
          target: ticket.id,
          meta: { code, count: files.length },
        });
      }

      const stored = await prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        include: TICKET_INCLUDE,
      });
      const [serialized] = await projectTicketList([stored], access);
      emitTicketCreated(serialized!);
      await notifyTicketCreated(serialized!);
      await auditRequest(req, {
        action: 'ticket.create',
        target: ticket.id,
        meta: { serverId, code, priority: body.priority, categoryId: category?.id ?? null },
      });
      res.status(201).json({ ticket: serialized });
    } catch (err) {
      await discardUploads(files);
      next(err);
    }
  },
);

/**
 * Bulk organizer actions (spec §23). The ticket ids from the request are
 * intersected with the viewer's scope, so an id from another competition is
 * silently dropped instead of being acted on. Every run is audited as one
 * BULK_ACTION entry with the resolved id list.
 */
router.post(
  '/tickets/bulk',
  requirePermission(Permission.TICKET_BULK),
  validate(serverIdSchema, 'params'),
  validate(schemas.ticketBulkSchema),
  async (req, res, next) => {
    try {
      const serverId = serverIdOf(req);
      const access = await resolveTicketAccess(req.user!, serverId);
      if (!access.canViewAll) throw Forbidden();

      const body = req.body as z.infer<typeof schemas.ticketBulkSchema>;
      const { status, priority, assignedToId, addTagIds } = body.action;
      if (
        status === undefined &&
        priority === undefined &&
        assignedToId === undefined &&
        !addTagIds?.length
      ) {
        throw BadRequest('No bulk action supplied');
      }

      const targets = await prisma.ticket.findMany({
        where: { AND: [ticketScopeWhere(access), { id: { in: body.ticketIds } }] },
        include: TICKET_INCLUDE,
      });
      if (targets.length === 0) throw NotFound('No matching tickets');

      if (assignedToId) {
        const member = await prisma.serverMember.findFirst({
          where: { userId: assignedToId, serverId, bannedAt: null },
          select: { userId: true },
        });
        if (!member) throw BadRequest('Assignee is not a member of this competition');
      }
      const tagIds = addTagIds?.length
        ? (
            await prisma.tag.findMany({
              where: { serverId, id: { in: addTagIds } },
              select: { id: true },
            })
          ).map((t) => t.id)
        : [];

      const applied: string[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];

      for (const ticket of targets) {
        const data: Prisma.TicketUpdateInput = {};

        if (status !== undefined && status !== ticket.status) {
          if (!canTransitionTicketStatus(ticket.status as TicketStatus, status)) {
            skipped.push({ id: ticket.id, reason: `${ticket.status} -> ${status} not allowed` });
            continue;
          }
          Object.assign(data, { status }, statusTimestamps(status, ticket));
        }
        if (priority !== undefined && priority !== ticket.priority) {
          data.priority = priority;
          data.priorityRank = priorityRankOf(priority);
        }
        if (assignedToId !== undefined && assignedToId !== ticket.assignedToId) {
          data.assignedTo = assignedToId ? { connect: { id: assignedToId } } : { disconnect: true };
        }

        if (Object.keys(data).length > 0) {
          await prisma.ticket.update({ where: { id: ticket.id }, data });
        }
        for (const tagId of tagIds) {
          await prisma.ticketTag.upsert({
            where: { ticketId_tagId: { ticketId: ticket.id, tagId } },
            create: { ticketId: ticket.id, tagId },
            update: {},
          });
        }

        if (status !== undefined && status !== ticket.status) {
          await recordTicketEvent({
            ticketId: ticket.id,
            type: ticketEventTypeForStatus(status),
            authorId: req.user!.id,
            meta: { from: ticket.status, to: status, bulk: true },
          });
        }
        if (priority !== undefined && priority !== ticket.priority) {
          await recordTicketEvent({
            ticketId: ticket.id,
            type: 'PRIORITY_CHANGE',
            authorId: req.user!.id,
            meta: { from: ticket.priority, to: priority, bulk: true },
          });
        }
        if (assignedToId !== undefined && assignedToId !== ticket.assignedToId) {
          await recordTicketEvent({
            ticketId: ticket.id,
            type: assignedToId ? 'ASSIGNED' : 'UNASSIGNED',
            authorId: req.user!.id,
            meta: { assignedToId, bulk: true },
          });
        }
        applied.push(ticket.id);
      }

      const fresh = await prisma.ticket.findMany({
        where: { id: { in: applied } },
        include: TICKET_INCLUDE,
      });
      const serialized = await projectTicketList(fresh, access);
      for (const ticket of serialized) {
        emitTicketUpdated(ticket);
        if (status !== undefined) {
          const before = targets.find((t) => t.id === ticket.id);
          if (before && before.status !== ticket.status) {
            await notifyTicketStatus(ticket, before.status, req.user!.id);
          }
        }
        if (assignedToId) await notifyTicketAssigned(ticket, req.user!.id);
      }

      await auditRequest(req, {
        action: 'ticket.bulk_action',
        target: serverId,
        meta: {
          serverId,
          action: body.action,
          requested: body.ticketIds.length,
          applied,
          skipped,
        },
      });

      res.json({ tickets: serialized, applied: applied.length, skipped });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
