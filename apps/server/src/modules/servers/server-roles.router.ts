import { Router } from 'express';
import { z } from 'zod';
import {
  Permission,
  Role,
  SERVER_PERM_KEYS,
  permissionsFor,
  schemas,
  parseServerPermissions,
} from '@sydt/shared';
import type { ServerRole as ServerRoleDto } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import {
  assertServerPermission,
  assertCanAssignServerRoles,
  canManageServerRoles,
  getEffectiveServerPermissions,
} from '../../lib/server-permissions.js';
import { revokeAllRefreshTokens } from '../../lib/revoke-sessions.js';
import { ensureServerDefaultRole } from '../../lib/ensure-server-default-role.js';
import { ensureServerAdminRole } from '../../lib/ensure-server-admin-role.js';
import { requireServerMember } from '../../lib/server-membership.js';
import { serializeUser } from '../serializers.js';

const router: Router = Router({ mergeParams: true });
router.use(requireAuth);

const idSchema = z.object({ id: z.string().cuid() });
const roleIdSchema = idSchema.extend({ roleId: z.string().cuid() });
const userIdSchema = idSchema.extend({ userId: z.string().cuid() });

function platformPerms(role: string) {
  return permissionsFor(role as Role);
}

function serializeRole(
  row: {
    id: string;
    serverId: string;
    name: string;
    color: string;
    position: number;
    hoist: boolean;
    permissionsJson: string;
  },
  memberCount: number,
): ServerRoleDto {
  return {
    id: row.id,
    serverId: row.serverId,
    name: row.name,
    color: row.color,
    position: row.position,
    hoist: row.hoist,
    permissions: parseServerPermissions(row.permissionsJson) as Record<string, boolean>,
    memberCount,
  };
}

router.get('/my-permissions', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    const me = req.user!;
    if (platformPerms(me.role).includes(Permission.ADMIN_DASHBOARD)) {
      res.json({ permissions: [...SERVER_PERM_KEYS] });
      return;
    }
    await requireServerMember(me.id, serverId);
    const perms = await getEffectiveServerPermissions(me.id, serverId);
    res.json({ permissions: [...perms] });
  } catch (err) {
    next(err);
  }
});

router.get('/roles', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    const me = req.user!;
    const pp = platformPerms(me.role);
    const canManage = await canManageServerRoles(me.id, serverId, pp);
    if (!canManage) await requireServerMember(me.id, serverId);
    await ensureServerDefaultRole(serverId);
    await ensureServerAdminRole(serverId);
    const rows = await prisma.serverRole.findMany({
      where: { serverId },
      orderBy: { position: 'asc' },
      include: { _count: { select: { assignments: true } } },
    });
    res.json({
      roles: rows.map((r) => serializeRole(r, r._count.assignments)),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/roles',
  validate(idSchema, 'params'),
  validate(schemas.createServerRoleSchema),
  async (req, res, next) => {
    try {
      const serverId = req.params.id!;
      const body = req.body as z.infer<typeof schemas.createServerRoleSchema>;
      const ok = await canManageServerRoles(req.user!.id, serverId, platformPerms(req.user!.role));
      if (!ok) throw Forbidden();

      const maxPos = await prisma.serverRole.findFirst({
        where: { serverId },
        orderBy: { position: 'desc' },
      });
      const row = await prisma.serverRole.create({
        data: {
          serverId,
          name: body.name.trim(),
          color: body.color ?? '#a78bfa',
          position: body.position ?? (maxPos?.position ?? 0) + 1,
          hoist: body.hoist ?? false,
          permissionsJson: JSON.stringify(body.permissions ?? {}),
        },
        include: { _count: { select: { assignments: true } } },
      });
      await audit({
        actorId: req.user!.id,
        action: 'server.role.create',
        target: row.id,
        meta: { serverId, name: row.name },
      });
      res.status(201).json({ role: serializeRole(row, 0) });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/roles/:roleId',
  validate(roleIdSchema, 'params'),
  validate(schemas.updateServerRoleSchema),
  async (req, res, next) => {
    try {
      const { id: serverId, roleId } = req.params;
      const body = req.body as z.infer<typeof schemas.updateServerRoleSchema>;
      const ok = await canManageServerRoles(req.user!.id, serverId!, platformPerms(req.user!.role));
      if (!ok) throw Forbidden();

      const existing = await prisma.serverRole.findFirst({ where: { id: roleId, serverId } });
      if (!existing) throw NotFound();

      const row = await prisma.serverRole.update({
        where: { id: roleId! },
        data: {
          name: body.name?.trim(),
          color: body.color,
          position: body.position,
          hoist: body.hoist,
          permissionsJson: body.permissions ? JSON.stringify(body.permissions) : undefined,
        },
        include: { _count: { select: { assignments: true } } },
      });
      res.json({ role: serializeRole(row, row._count.assignments) });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/roles/:roleId', validate(roleIdSchema, 'params'), async (req, res, next) => {
  try {
    const { id: serverId, roleId } = req.params;
    const ok = await canManageServerRoles(req.user!.id, serverId!, platformPerms(req.user!.role));
    if (!ok) throw Forbidden();

    const existing = await prisma.serverRole.findFirst({ where: { id: roleId, serverId } });
    if (!existing) throw NotFound();
    if (existing.name === 'Default') throw BadRequest('Cannot delete Default role');

    await prisma.serverRole.delete({ where: { id: roleId! } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/members/by-role', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    const viewer = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: req.user!.id, serverId } },
    });
    if (!viewer) throw Forbidden();

    await ensureServerDefaultRole(serverId);
    await ensureServerAdminRole(serverId);
    const roles = await prisma.serverRole.findMany({
      where: { serverId },
      orderBy: { position: 'desc' },
    });
    const assignments = await prisma.memberServerRole.findMany({
      where: { serverId },
      include: { user: { include: { team: true } } },
    });
    const rolePosition = new Map(roles.map((r) => [r.id, r.position]));
    const byRole = new Map<string, ReturnType<typeof serializeUser>[]>();
    for (const r of roles) byRole.set(r.id, []);
    const assignedUserIds = new Set<string>();
    const userBestRole = new Map<string, string>();
    for (const a of assignments) {
      const current = userBestRole.get(a.userId);
      const nextPos = rolePosition.get(a.roleId) ?? 0;
      const curPos = current ? (rolePosition.get(current) ?? 0) : -1;
      if (!current || nextPos > curPos) userBestRole.set(a.userId, a.roleId);
    }
    const userById = new Map(assignments.map((a) => [a.userId, a.user]));
    for (const [userId, roleId] of userBestRole) {
      assignedUserIds.add(userId);
      const list = byRole.get(roleId);
      const user = userById.get(userId);
      if (list && user) list.push(serializeUser(user));
    }
    const unassignedRows = await prisma.serverMember.findMany({
      where:
        assignedUserIds.size > 0
          ? { serverId, userId: { notIn: [...assignedUserIds] } }
          : { serverId },
      include: { user: { include: { team: true } } },
    });
    res.json({
      groups: roles.map((r) => ({
        role: serializeRole(r, byRole.get(r.id)?.length ?? 0),
        members: byRole.get(r.id) ?? [],
      })),
      unassigned: unassignedRows.map((m) => serializeUser(m.user)),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/members/:userId/roles', validate(userIdSchema, 'params'), async (req, res, next) => {
  try {
    const serverId = req.params.id!;
    const userId = req.params.userId!;
    const pp = platformPerms(req.user!.role);
    const ok = await canManageServerRoles(req.user!.id, serverId, pp);
    if (!ok) throw Forbidden();

    const assigned = await prisma.memberServerRole.findMany({
      where: { serverId, userId },
      include: { role: { select: { id: true, position: true } } },
    });
    const best = assigned.sort((a, b) => b.role.position - a.role.position)[0];
    res.json({ roleIds: best ? [best.roleId] : [] });
  } catch (err) {
    next(err);
  }
});

router.put(
  '/members/:userId/roles',
  validate(userIdSchema, 'params'),
  validate(schemas.setMemberRolesSchema),
  async (req, res, next) => {
    try {
      const serverId = req.params.id!;
      const userId = req.params.userId!;
      const body = req.body as z.infer<typeof schemas.setMemberRolesSchema>;
      const pp = platformPerms(req.user!.role);
      const canManage = await canManageServerRoles(req.user!.id, serverId, pp);
      if (!canManage) await assertServerPermission(req.user!.id, serverId, 'assignRoles', pp);

      const member = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId, serverId } },
      });
      if (!member) throw BadRequest('User is not a member of this server');

      const roles = await prisma.serverRole.findMany({
        where: { serverId, id: { in: body.roleIds } },
      });
      if (roles.length !== body.roleIds.length) throw BadRequest('Invalid role for this server');

      await assertCanAssignServerRoles(req.user!.id, serverId, body.roleIds, pp);

      await prisma.$transaction([
        prisma.memberServerRole.deleteMany({ where: { userId, serverId } }),
        ...body.roleIds.map((roleId) =>
          prisma.memberServerRole.create({ data: { userId, serverId, roleId } }),
        ),
      ]);

      await audit({
        actorId: req.user!.id,
        action: 'server.member.roles',
        target: userId,
        meta: { serverId, roleIds: body.roleIds },
      });

      await revokeAllRefreshTokens(userId);

      res.json({ roleIds: body.roleIds });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
