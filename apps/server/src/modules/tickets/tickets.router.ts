import { Router } from 'express';
import { Permission, isStaff, schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeTicket, serializeTicketEvent } from '../serializers.js';
import { emitTicketCreated, emitTicketUpdated } from '../../realtime/broadcasters.js';

const router: Router = Router();

const include = {
  openedBy: { include: { team: true } },
  claimedBy: { include: { team: true } },
  team: true,
};

function ticketCode(): string {
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `T-${ts}${rnd}`;
}

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const me = req.user!;
    const staff = isStaff(me.role);
    const tickets = await prisma.ticket.findMany({
      where: staff
        ? {}
        : me.teamId
        ? { OR: [{ openedById: me.id }, { teamId: me.teamId }] }
        : { openedById: me.id },
      orderBy: { updatedAt: 'desc' },
      include,
      take: 200,
    });
    res.json({ tickets: tickets.map(serializeTicket) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound();
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        ...include,
        events: {
          orderBy: { createdAt: 'asc' },
          include: { author: { include: { team: true } } },
        },
      },
    });
    if (!ticket) throw NotFound('Ticket not found');
    const me = req.user!;
    const staff = isStaff(me.role);
    const isMine =
      ticket.openedById === me.id || (me.teamId && ticket.teamId === me.teamId);
    if (!staff && !isMine) throw Forbidden();
    const events = ticket.events
      .filter((e) => staff || e.type !== 'INTERNAL_NOTE')
      .map(serializeTicketEvent);
    res.json({ ticket: serializeTicket(ticket), events });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requirePermission(Permission.TICKET_CREATE),
  validate(schemas.createTicketSchema),
  async (req, res, next) => {
    try {
      const data = req.body as ReturnType<typeof schemas.createTicketSchema.parse>;
      const ticket = await prisma.ticket.create({
        data: {
          code: ticketCode(),
          title: data.title,
          body: data.body,
          severity: data.severity,
          challengeId: data.challengeId ?? null,
          teamId: req.user!.teamId,
          openedById: req.user!.id,
          events: {
            create: { type: 'CREATED', authorId: req.user!.id, body: data.body },
          },
        },
        include,
      });
      const serialized = serializeTicket(ticket);
      emitTicketCreated(serialized);
      await audit({ actorId: req.user?.id, action: 'ticket.create', target: ticket.id });
      res.status(201).json({ ticket: serialized });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/comment',
  validate(schemas.ticketCommentSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const data = req.body as ReturnType<typeof schemas.ticketCommentSchema.parse>;
      const ticket = await prisma.ticket.findUnique({ where: { id }, include });
      if (!ticket) throw NotFound();
      const me = req.user!;
      const staff = isStaff(me.role);
      const isMine =
        ticket.openedById === me.id || (me.teamId && ticket.teamId === me.teamId);
      if (!staff && !isMine) throw Forbidden();
      if (data.internal && !staff) throw Forbidden('Only staff may post internal notes');

      const event = await prisma.ticketEvent.create({
        data: {
          ticketId: id,
          type: data.internal ? 'INTERNAL_NOTE' : 'COMMENT',
          authorId: me.id,
          body: data.body,
        },
        include: { author: { include: { team: true } } },
      });
      const updated = await prisma.ticket.update({
        where: { id },
        data: { updatedAt: new Date() },
        include,
      });
      const serialized = serializeTicket(updated);
      const evSerialized = serializeTicketEvent(event);
      emitTicketUpdated(serialized, evSerialized);
      res.json({ ticket: serialized, event: evSerialized });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/claim',
  requirePermission(Permission.TICKET_CLAIM),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const ticket = await prisma.ticket.update({
        where: { id },
        data: {
          claimedById: req.user!.id,
          status: 'CLAIMED',
          events: {
            create: { type: 'CLAIMED', authorId: req.user!.id },
          },
        },
        include,
      });
      const serialized = serializeTicket(ticket);
      emitTicketUpdated(serialized);
      await audit({ actorId: req.user?.id, action: 'ticket.claim', target: id });
      res.json({ ticket: serialized });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/status',
  requirePermission(Permission.TICKET_RESOLVE),
  validate(schemas.ticketStatusSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const { status } = req.body as ReturnType<typeof schemas.ticketStatusSchema.parse>;
      const ticket = await prisma.ticket.update({
        where: { id },
        data: {
          status,
          resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date() : null,
          events: {
            create: {
              type: status === 'RESOLVED' ? 'RESOLVED' : status === 'CLOSED' ? 'CLOSED' : 'STATUS_CHANGE',
              authorId: req.user!.id,
              metaJson: JSON.stringify({ to: status }),
            },
          },
        },
        include,
      });
      const serialized = serializeTicket(ticket);
      emitTicketUpdated(serialized);
      await audit({ actorId: req.user?.id, action: 'ticket.status', target: id, meta: { status } });
      res.json({ ticket: serialized });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/severity',
  requirePermission(Permission.TICKET_RESOLVE),
  validate(schemas.ticketSeveritySchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const { severity } = req.body as ReturnType<typeof schemas.ticketSeveritySchema.parse>;
      const ticket = await prisma.ticket.update({
        where: { id },
        data: {
          severity,
          events: {
            create: {
              type: 'SEVERITY_CHANGE',
              authorId: req.user!.id,
              metaJson: JSON.stringify({ to: severity }),
            },
          },
        },
        include,
      });
      const serialized = serializeTicket(ticket);
      emitTicketUpdated(serialized);
      res.json({ ticket: serialized });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
