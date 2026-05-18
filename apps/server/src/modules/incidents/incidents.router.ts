import { Router } from 'express';
import { Permission, schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeIncident } from '../serializers.js';
import { emitIncidentCreated, emitIncidentUpdated } from '../../realtime/broadcasters.js';

const router: Router = Router();

const include = {
  openedBy: { include: { team: true } },
  assignedTo: { include: { team: true } },
};

router.use(requireAuth, requirePermission(Permission.INCIDENT_VIEW));

router.get('/', async (_req, res, next) => {
  try {
    const incidents = await prisma.incident.findMany({
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
      const incident = await prisma.incident.create({
        data: {
          title: data.title,
          description: data.description,
          severity: data.severity,
          assignedToId: data.assignedToId ?? null,
          openedById: req.user!.id,
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
