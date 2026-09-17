import { Router } from 'express';
import { Permission, schemas, isAdmin } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeIncident } from '../serializers.js';
import { emitIncidentCreated, emitIncidentUpdated } from '../../realtime/broadcasters.js';
import { requireServerMember } from '../../lib/server-membership.js';

const router: Router = Router();

const include = {
  openedBy: { include: { team: true } },
  assignedTo: { include: { team: true } },
};

router.use(requireAuth, requirePermission(Permission.INCIDENT_VIEW));

router.get('/', async (req, res, next) => {
  try {
    const serverId = typeof req.query.serverId === 'string' ? req.query.serverId : undefined;
    if (serverId && !isAdmin(req.user!.role)) {
      await requireServerMember(req.user!.id, serverId);
    }
    const incidents = await prisma.incident.findMany({
      where: serverId
        ? { OR: [{ serverId }, { serverId: null }] }
        : undefined,
      include,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ incidents: incidents.map(serializeIncident) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw NotFound();
    const incident = await prisma.incident.findUnique({ where: { id }, include });
    if (!incident) throw NotFound();
    res.json({ incident: serializeIncident(incident) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requirePermission(Permission.INCIDENT_CREATE),
  validate(schemas.createIncidentSchema),
  async (req, res, next) => {
    try {
      const data = req.body as ReturnType<typeof schemas.createIncidentSchema.parse>;

      let serverId = data.serverId ?? null;
      let channelId = data.channelId ?? null;

      if (channelId) {
        const channel = await prisma.channel.findUnique({
          where: { id: channelId },
          select: { id: true, serverId: true },
        });
        if (!channel) throw BadRequest('Channel not found');
        channelId = channel.id;
        if (!serverId) serverId = channel.serverId;
      }

      if (serverId) {
        const server = await prisma.chatServer.findUnique({ where: { id: serverId }, select: { id: true } });
        if (!server) throw BadRequest('Server not found');
        if (!isAdmin(req.user!.role)) {
          await requireServerMember(req.user!.id, serverId);
        }
      }

      const incident = await prisma.incident.create({
        data: {
          title: data.title,
          description: data.description,
          severity: data.severity,
          assignedToId: data.assignedToId ?? null,
          openedById: req.user!.id,
          serverId,
          channelId,
        },
        include,
      });
      const serialized = serializeIncident(incident);
      emitIncidentCreated(serialized);
      await audit({ actorId: req.user?.id, action: 'incident.create', target: incident.id });
      res.status(201).json({ incident: serialized });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id',
  requirePermission(Permission.INCIDENT_MANAGE),
  validate(schemas.updateIncidentSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (!id) throw NotFound();
      const data = req.body as ReturnType<typeof schemas.updateIncidentSchema.parse>;
      const mergedStatus = data.status;
      const resolvedClosed =
        mergedStatus === 'RESOLVED' || mergedStatus === 'POSTMORTEM'
          ? { resolvedAt: new Date() as Date }
          : mergedStatus !== undefined
            ? { resolvedAt: null as null }
            : {};

      const incident = await prisma.incident.update({
        where: { id },
        data: {
          ...data,
          ...resolvedClosed,
        },
        include,
      });
      const serialized = serializeIncident(incident);
      emitIncidentUpdated(serialized);
      res.json({ incident: serialized });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
