/**
 * Per-ticket endpoints, mounted at /api/tickets.
 *
 * Every handler resolves authorization through ticket-access.ts, which derives
 * the competition scope from the ticket itself - the client never supplies it.
 * Listing and creation live in modules/servers/server-tickets.router.ts.
 */
import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import { Permission, canTransitionTicketStatus, schemas, type TicketStatus } from '@sydt/shared';
import type { Ticket } from '@sydt/shared';
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
} from './ticket-attachments.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/http-error.js';
import { auditRequest } from '../../lib/audit.js';
import { publishAnnouncementById } from '../../lib/announcement-publish.js';
import { ticketReplyLimiter } from '../../middleware/ratelimit.js';
import { serializeTicketEvent } from '../serializers.js';
import { emitTicketComment, emitTicketUpdated } from '../../realtime/broadcasters.js';
import {
  TICKET_INCLUDE,
  assertCanReply,
  loadAccessibleTicket,
  type TicketAccess,
} from './ticket-access.js';
import {
  dispatchTicketWebhook,
  notifyTicketAssigned,
  notifyTicketPriority,
  notifyTicketReply,
  notifyTicketStatus,
} from './ticket-notify.js';
import {
  priorityRankOf,
  projectTicketList,
  recordTicketEvent,
  replyMetrics,
  statusTimestamps,
  ticketEventTypeForStatus,
} from './ticket-service.js';

const router: Router = Router();
router.use(requireAuth);

const idSchema = z.object({ id: z.string().cuid() });

/** Only engages multer when the request actually carries files. */
const ticketMultipart: RequestHandler = (req, res, next) => {
  if (!isMultipart(req)) return next();
  return ticketAttachmentUpload.array(TICKET_ATTACHMENT_FIELD, MAX_TICKET_ATTACHMENTS)(
    req,
    res,
    next,
  );
};

/** Re-reads and serializes the ticket for the given viewer after a mutation. */
async function reload(ticketId: string, access: TicketAccess): Promise<Ticket> {
  const fresh = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: TICKET_INCLUDE,
  });
  const [serialized] = await projectTicketList([fresh], access);
  return serialized!;
}

router.get('/:id', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const { ticket, access } = await loadAccessibleTicket(req.params.id!, req.user!);

    const events = await prisma.ticketEvent.findMany({
      where: {
        ticketId: ticket.id,
        // Internal notes are excluded in the query, not in the response mapper.
        ...(access.canSeeInternal ? {} : { type: { not: 'INTERNAL_NOTE' } }),
      },
      orderBy: { createdAt: 'asc' },
      include: { author: { include: { team: true } }, attachments: true },
    });

    const relations = await prisma.ticketRelation.findMany({
      where: { ticketId: ticket.id },
      include: {
        relatedTicket: {
          select: { id: true, code: true, title: true, status: true, priority: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const [serialized] = await projectTicketList([ticket], access);
    await auditRequest(req, {
      action: 'ticket.view',
      target: ticket.id,
      meta: { serverId: ticket.serverId, code: ticket.code },
    });

    res.json({
      ticket: serialized,
      events: events.map(serializeTicketEvent),
      relations: relations.map((r) => ({
        id: r.id,
        kind: r.kind,
        ticket: r.relatedTicket,
        createdAt: r.createdAt.toISOString(),
      })),
      viewer: {
        canSeeInternal: access.canSeeInternal,
        canViewAll: access.canViewAll,
        canAssign: access.canAssign,
        canClaim: access.canClaim,
        canManageFields: access.canManageFields,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Multipart replies deliver `internal` as the string "true"/"false". */
function commentInput(req: Request): z.infer<typeof schemas.ticketCommentSchema> {
  if (!isMultipart(req)) return parseOrThrow(schemas.ticketCommentSchema, req.body);
  const raw = req.body as Record<string, string | undefined>;
  return parseOrThrow(schemas.ticketCommentSchema, {
    body: raw.body,
    internal: raw.internal === 'true',
  });
}

router.post(
  '/:id/comment',
  ticketReplyLimiter,
  validate(idSchema, 'params'),
  ticketMultipart,
  async (req, res, next) => {
    const files = uploadedFiles(req);
    try {
      const { ticket, access } = await loadAccessibleTicket(req.params.id!, req.user!);
      const data = commentInput(req);
      assertCanReply(ticket, access, data.internal);

      let event = await recordTicketEvent({
        ticketId: ticket.id,
        type: data.internal ? 'INTERNAL_NOTE' : 'COMMENT',
        authorId: req.user!.id,
        body: data.body,
      });

      if (files.length > 0) {
        await attachFilesToTicketEvent({
          ticketEventId: event.id,
          uploadedById: req.user!.id,
          files,
        });
        // Re-read so the response and socket payload carry the attachments.
        event = await prisma.ticketEvent.findUniqueOrThrow({
          where: { id: event.id },
          include: { author: { include: { team: true } }, attachments: true },
        });
        await auditRequest(req, {
          action: 'ticket.attachment_upload',
          target: ticket.id,
          meta: { code: ticket.code, count: files.length, internal: data.internal },
        });
      }

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: replyMetrics(ticket, {
          fromOrganizer: access.canViewAll,
          internal: data.internal,
        }),
      });

      const serialized = await reload(ticket.id, access);
      const evSerialized = serializeTicketEvent(event);

      if (data.internal) {
        // Internal notes must never reach competitor sockets or notifications.
        emitTicketUpdated(serialized, evSerialized, { staffOnly: true });
      } else {
        emitTicketComment(serialized, evSerialized);
        await notifyTicketReply(serialized, evSerialized, access.canViewAll);
      }

      await auditRequest(req, {
        action: data.internal ? 'ticket.internal_note' : 'ticket.comment',
        target: ticket.id,
        meta: { serverId: ticket.serverId, code: ticket.code },
      });
      res.json({ ticket: serialized, event: evSerialized });
    } catch (err) {
      await discardUploads(files);
      next(err);
    }
  },
);

/**
 * Organizer field updates. Each field is authorized on its own so a viewer with
 * only TICKET_ASSIGN cannot also move status or priority.
 */
async function applyTicketPatch(
  req: Request,
  ticketId: string,
  body: z.infer<typeof schemas.patchTicketSchema>,
): Promise<Ticket> {
  const { ticket, access } = await loadAccessibleTicket(ticketId, req.user!);
  if (!access.canViewAll) throw Forbidden();

  const data: Record<string, unknown> = {};
  const events: Array<{ type: string; meta: Record<string, unknown> }> = [];

  if (body.status !== undefined && body.status !== ticket.status) {
    if (!access.canManageFields) throw Forbidden('Missing ticket status permission');
    const nextStatus = body.status as TicketStatus;
    if (!canTransitionTicketStatus(ticket.status as TicketStatus, nextStatus)) {
      throw BadRequest(`Cannot move ticket from ${ticket.status} to ${nextStatus}`);
    }
    Object.assign(data, { status: nextStatus }, statusTimestamps(nextStatus, ticket));
    events.push({
      type: ticketEventTypeForStatus(nextStatus),
      meta: { from: ticket.status, to: nextStatus },
    });
  }

  if (body.priority !== undefined && body.priority !== ticket.priority) {
    if (!access.canManageFields) throw Forbidden('Missing ticket priority permission');
    data.priority = body.priority;
    data.priorityRank = priorityRankOf(body.priority);
    events.push({ type: 'PRIORITY_CHANGE', meta: { from: ticket.priority, to: body.priority } });
  }

  if (body.categoryId !== undefined && body.categoryId !== ticket.categoryId) {
    if (!access.canManageFields) throw Forbidden('Missing ticket category permission');
    if (body.categoryId) {
      const category = await prisma.ticketCategory.findFirst({
        where: { id: body.categoryId, serverId: ticket.serverId },
        select: { id: true },
      });
      if (!category) throw BadRequest('Unknown ticket category');
    }
    data.categoryId = body.categoryId;
    events.push({ type: 'CATEGORY_CHANGE', meta: { to: body.categoryId } });
  }

  if (body.challengeId !== undefined && body.challengeId !== ticket.challengeId) {
    if (!access.canManageFields) throw Forbidden('Missing ticket challenge permission');
    if (body.challengeId) {
      const challenge = await prisma.challenge.findFirst({
        where: { id: body.challengeId, discussionChannel: { serverId: ticket.serverId } },
        select: { id: true },
      });
      if (!challenge) throw BadRequest('Unknown challenge for this competition');
    }
    data.challengeId = body.challengeId;
    events.push({ type: 'CHALLENGE_CHANGE', meta: { to: body.challengeId } });
  }

  if (body.assignedToId !== undefined && body.assignedToId !== ticket.assignedToId) {
    const self = body.assignedToId === req.user!.id;
    if (!access.canAssign && !(self && access.canClaim)) {
      throw Forbidden('Missing ticket assign permission');
    }
    if (body.assignedToId) {
      // The assignee must belong to this competition.
      const assignee = await prisma.serverMember.findFirst({
        where: { userId: body.assignedToId, serverId: ticket.serverId, bannedAt: null },
        select: { userId: true },
      });
      if (!assignee) throw BadRequest('Assignee is not a member of this competition');
    }
    data.assignedToId = body.assignedToId;
    events.push({
      type: body.assignedToId ? 'ASSIGNED' : 'UNASSIGNED',
      meta: { assignedToId: body.assignedToId },
    });
  }

  if (body.tagIds !== undefined) {
    if (!access.canManageFields) throw Forbidden('Missing ticket tag permission');
    const tags = await prisma.tag.findMany({
      where: { serverId: ticket.serverId, id: { in: body.tagIds } },
      select: { id: true },
    });
    await prisma.ticketTag.deleteMany({ where: { ticketId: ticket.id } });
    if (tags.length > 0) {
      await prisma.ticketTag.createMany({
        data: tags.map((t) => ({ ticketId: ticket.id, tagId: t.id })),
      });
    }
    events.push({ type: 'TAGS_CHANGE', meta: { tagIds: tags.map((t) => t.id) } });
  }

  if (Object.keys(data).length > 0) {
    await prisma.ticket.update({ where: { id: ticket.id }, data });
  }
  for (const ev of events) {
    await recordTicketEvent({
      ticketId: ticket.id,
      type: ev.type,
      authorId: req.user!.id,
      meta: ev.meta,
    });
  }

  const serialized = await reload(ticket.id, access);
  emitTicketUpdated(serialized);

  if (data.status) await notifyTicketStatus(serialized, ticket.status, req.user!.id);
  if (data.priority) await notifyTicketPriority(serialized, ticket.priority);
  if (data.assignedToId) await notifyTicketAssigned(serialized, req.user!.id);
  if (!data.status && !data.priority && !data.assignedToId) {
    await dispatchTicketWebhook(serialized, 'ticket.updated');
  }

  await auditRequest(req, {
    action: 'ticket.update',
    target: ticket.id,
    meta: { serverId: ticket.serverId, code: ticket.code, changes: body },
  });
  return serialized;
}

router.patch(
  '/:id',
  validate(idSchema, 'params'),
  validate(schemas.patchTicketSchema),
  async (req, res, next) => {
    try {
      const ticket = await applyTicketPatch(
        req,
        req.params.id!,
        req.body as z.infer<typeof schemas.patchTicketSchema>,
      );
      res.json({ ticket });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/claim',
  requirePermission(Permission.TICKET_CLAIM),
  validate(idSchema, 'params'),
  async (req, res, next) => {
    try {
      const { ticket, access } = await loadAccessibleTicket(req.params.id!, req.user!);
      if (!access.canViewAll) throw Forbidden();
      if (ticket.assignedToId && ticket.assignedToId !== req.user!.id) {
        throw BadRequest('Ticket is already assigned');
      }

      const movesToProgress = ticket.status === 'OPEN' || ticket.status === 'REOPENED';
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          assignedToId: req.user!.id,
          ...(movesToProgress ? { status: 'IN_PROGRESS', resolvedAt: null, closedAt: null } : {}),
        },
      });
      await recordTicketEvent({
        ticketId: ticket.id,
        type: 'ASSIGNED',
        authorId: req.user!.id,
        meta: { assignedToId: req.user!.id, self: true },
      });

      const serialized = await reload(ticket.id, access);
      emitTicketUpdated(serialized);
      await notifyTicketAssigned(serialized, req.user!.id);
      if (movesToProgress) await notifyTicketStatus(serialized, ticket.status, req.user!.id);
      await auditRequest(req, {
        action: 'ticket.claim',
        target: ticket.id,
        meta: { serverId: ticket.serverId, code: ticket.code },
      });
      res.json({ ticket: serialized });
    } catch (err) {
      next(err);
    }
  },
);

/** Competitor-facing reopen: the only status change a reporter may trigger. */
router.post(
  '/:id/reopen',
  ticketReplyLimiter,
  validate(idSchema, 'params'),
  validate(schemas.reopenTicketSchema),
  async (req, res, next) => {
    try {
      const { ticket, access } = await loadAccessibleTicket(req.params.id!, req.user!);
      const body = req.body as z.infer<typeof schemas.reopenTicketSchema>;
      if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
        throw BadRequest('Only resolved or closed tickets can be reopened');
      }

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'REOPENED',
          resolvedAt: null,
          closedAt: null,
          reopenCount: { increment: 1 },
          ...(access.canViewAll ? {} : { lastCompetitorReplyAt: new Date() }),
        },
      });
      const event = await recordTicketEvent({
        ticketId: ticket.id,
        type: 'REOPENED',
        authorId: req.user!.id,
        body: body.body,
        meta: { from: ticket.status },
      });

      const serialized = await reload(ticket.id, access);
      const evSerialized = serializeTicketEvent(event);
      emitTicketUpdated(serialized, evSerialized);
      await notifyTicketStatus(serialized, ticket.status, req.user!.id);
      await auditRequest(req, {
        action: 'ticket.reopen',
        target: ticket.id,
        meta: { serverId: ticket.serverId, code: ticket.code, from: ticket.status },
      });
      res.json({ ticket: serialized, event: evSerialized });
    } catch (err) {
      next(err);
    }
  },
);

router.post('/:id/read', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const { ticket, access } = await loadAccessibleTicket(req.params.id!, req.user!);
    const now = new Date();
    await prisma.ticketRead.upsert({
      where: { ticketId_userId: { ticketId: ticket.id, userId: access.viewerId } },
      create: { ticketId: ticket.id, userId: access.viewerId, lastReadAt: now },
      update: { lastReadAt: now },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Ticket relations (spec §22). Both sides must live in the same competition,
 * and the inverse edge is written too so PARENT/CHILD stays navigable from
 * either ticket.
 */
const INVERSE_RELATION: Record<string, string> = {
  RELATED: 'RELATED',
  DUPLICATE: 'DUPLICATE',
  PARENT: 'CHILD',
  CHILD: 'PARENT',
};

router.post(
  '/:id/relations',
  validate(idSchema, 'params'),
  validate(schemas.ticketRelationSchema),
  async (req, res, next) => {
    try {
      const { ticket, access } = await loadAccessibleTicket(req.params.id!, req.user!);
      if (!access.canManageFields) throw Forbidden('Missing ticket manage permission');
      const body = req.body as z.infer<typeof schemas.ticketRelationSchema>;
      if (body.relatedTicketId === ticket.id) throw BadRequest('Cannot relate a ticket to itself');

      // Resolved through the viewer's scope so relations cannot be used to
      // confirm the existence of tickets in other competitions.
      const related = await prisma.ticket.findFirst({
        where: { id: body.relatedTicketId, serverId: ticket.serverId },
        select: { id: true, code: true, title: true, status: true, priority: true },
      });
      if (!related) throw NotFound('Related ticket not found');

      await prisma.ticketRelation.upsert({
        where: {
          ticket_relation_unique: {
            ticketId: ticket.id,
            relatedTicketId: related.id,
            kind: body.kind,
          },
        },
        create: {
          ticketId: ticket.id,
          relatedTicketId: related.id,
          kind: body.kind,
          createdById: req.user!.id,
        },
        update: {},
      });
      const inverse = INVERSE_RELATION[body.kind]!;
      await prisma.ticketRelation.upsert({
        where: {
          ticket_relation_unique: {
            ticketId: related.id,
            relatedTicketId: ticket.id,
            kind: inverse,
          },
        },
        create: {
          ticketId: related.id,
          relatedTicketId: ticket.id,
          kind: inverse,
          createdById: req.user!.id,
        },
        update: {},
      });

      await recordTicketEvent({
        ticketId: ticket.id,
        type: 'RELATION_ADDED',
        authorId: req.user!.id,
        meta: { kind: body.kind, relatedTicketId: related.id, relatedCode: related.code },
      });
      await auditRequest(req, {
        action: 'ticket.relation_add',
        target: ticket.id,
        meta: { serverId: ticket.serverId, kind: body.kind, relatedTicketId: related.id },
      });

      res.status(201).json({
        relation: { kind: body.kind, ticket: related },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id/relations/:relationId',
  validate(idSchema.extend({ relationId: z.string().cuid() }), 'params'),
  async (req, res, next) => {
    try {
      const { ticket, access } = await loadAccessibleTicket(req.params.id!, req.user!);
      if (!access.canManageFields) throw Forbidden('Missing ticket manage permission');

      const relation = await prisma.ticketRelation.findFirst({
        where: { id: req.params.relationId!, ticketId: ticket.id },
      });
      if (!relation) throw NotFound('Relation not found');

      await prisma.ticketRelation.deleteMany({
        where: {
          OR: [
            { id: relation.id },
            {
              ticketId: relation.relatedTicketId,
              relatedTicketId: relation.ticketId,
              kind: INVERSE_RELATION[relation.kind] ?? relation.kind,
            },
          ],
        },
      });
      await auditRequest(req, {
        action: 'ticket.relation_remove',
        target: ticket.id,
        meta: { serverId: ticket.serverId, relationId: relation.id },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Raises a competition announcement from a ticket (spec §26), for the case
 * where one reported problem affects several teams. The announcement body is
 * organizer-written: the ticket text is never copied automatically, since it may
 * contain another team's findings.
 */
router.post(
  '/:id/announce',
  requirePermission(Permission.TICKET_ANNOUNCE),
  validate(idSchema, 'params'),
  validate(schemas.ticketAnnounceSchema),
  async (req, res, next) => {
    try {
      const { ticket, access } = await loadAccessibleTicket(req.params.id!, req.user!);
      if (!access.canViewAll) throw Forbidden();
      const body = req.body as z.infer<typeof schemas.ticketAnnounceSchema>;

      const created = await prisma.announcement.create({
        data: {
          title: body.title,
          body: body.body,
          severity: body.severity,
          authorId: req.user!.id,
          serverId: ticket.serverId,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          sourceTicketId: ticket.id,
        },
        select: { id: true },
      });
      const announcement = await publishAnnouncementById(created.id);

      let event = null;
      if (body.replyOnTicket) {
        event = await recordTicketEvent({
          ticketId: ticket.id,
          type: 'COMMENT',
          authorId: req.user!.id,
          body: `📣 ${body.title}\n\n${body.body}`,
          meta: { announcementId: created.id },
        });
      }
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: replyMetrics(ticket, { fromOrganizer: true, internal: !body.replyOnTicket }),
      });

      const serialized = await reload(ticket.id, access);
      if (event) {
        const evSerialized = serializeTicketEvent(event);
        emitTicketComment(serialized, evSerialized);
        await notifyTicketReply(serialized, evSerialized, true);
      }
      await auditRequest(req, {
        action: 'ticket.announce',
        target: ticket.id,
        meta: { serverId: ticket.serverId, announcementId: created.id, severity: body.severity },
      });

      res.status(201).json({ announcement, ticket: serialized });
    } catch (err) {
      next(err);
    }
  },
);

// Legacy routes used by the current UI until the new screens land; both funnel
// into the same authorized patch logic.
router.post(
  '/:id/status',
  requirePermission(Permission.TICKET_RESOLVE),
  validate(idSchema, 'params'),
  validate(schemas.ticketStatusSchema),
  async (req, res, next) => {
    try {
      const { status } = req.body as z.infer<typeof schemas.ticketStatusSchema>;
      const ticket = await applyTicketPatch(req, req.params.id!, { status });
      res.json({ ticket });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/severity',
  requirePermission(Permission.TICKET_RESOLVE),
  validate(idSchema, 'params'),
  validate(schemas.ticketSeveritySchema),
  async (req, res, next) => {
    try {
      const { severity } = req.body as z.infer<typeof schemas.ticketSeveritySchema>;
      const ticket = await applyTicketPatch(req, req.params.id!, { priority: severity });
      res.json({ ticket });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
