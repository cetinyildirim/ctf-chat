import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ALL_ROLES, ROLE_RANK, Role, isStaff, schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../../lib/http-error.js';
import { auditRequest } from '../../lib/audit.js';
import { hashPassword } from '../../lib/password.js';
import { revokeAllRefreshTokens } from '../../lib/revoke-sessions.js';
import { permissionRoleOf } from '../../lib/user-role.js';
import {
  addUserToServer,
  joinAutoJoinServers,
  removeUserFromServer,
} from '../../lib/server-membership.js';
import { getIO } from '../../realtime/io.js';
import { room } from '../../realtime/rooms.js';
import { snapshot } from '../../realtime/presence.js';
import { logger } from '../../lib/logger.js';
import { serializeUser } from '../serializers.js';
import { generatePassword } from './ctfd-teams-import.service.js';

const router: Router = Router();

const roleSchema = z.enum(ALL_ROLES as [Role, ...Role[]]);
const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9_.-]+$/i)
  .transform((v) => v.toLowerCase());
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(200)
  .transform((v) => v.toLowerCase());
const displayNameSchema = z.string().trim().min(2).max(40);

const idParams = z.object({ id: z.string().cuid() });
const serverParams = z.object({ serverId: z.string().cuid() });
const userServerParams = z.object({ id: z.string().cuid(), serverId: z.string().cuid() });

const STATUS_FILTERS = ['active', 'disabled', 'banned', 'muted', 'mustChange'] as const;

type UserRow = Prisma.UserGetPayload<{ include: { team: true; _count: { select: { serverMembers: true } } } }>;

function serializeAdminUser(u: UserRow, onlineIds: Set<string>) {
  return {
    ...serializeUser(u),
    role: permissionRoleOf(u),
    status: onlineIds.has(u.id) ? 'ONLINE' : 'OFFLINE',
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
    isBanned: u.isBanned,
    bannedUntil: u.bannedUntil?.toISOString() ?? null,
    mutedUntil: u.mutedUntil && u.mutedUntil > new Date() ? u.mutedUntil.toISOString() : null,
    disabledAt: u.disabledAt?.toISOString() ?? null,
    disabledReason: u.disabledReason,
    mustChangePassword: u.mustChangePassword,
    serverCount: u._count.serverMembers,
  };
}

function onlineUserIds(): Set<string> {
  return new Set(snapshot().filter((p) => p.status !== 'OFFLINE').map((p) => p.userId));
}

/** Prisma filter for users whose effective platform role is `role`. */
function roleWhere(role: Role): Prisma.UserWhereInput {
  if (isStaff(role)) return { OR: [{ platformRole: role }, { role, platformRole: null }] };
  return { role, OR: [{ platformRole: null }, { platformRole: { notIn: staffRoles() } }] };
}

function staffRoles(): Role[] {
  return ALL_ROLES.filter((r) => isStaff(r));
}

function listWhere(query: Request['query']): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  if (q) {
    and.push({
      OR: [{ username: { contains: q } }, { displayName: { contains: q } }, { email: { contains: q } }],
    });
  }
  const role = roleSchema.safeParse(query.role);
  if (role.success) and.push(roleWhere(role.data));
  if (typeof query.serverId === 'string' && query.serverId) {
    and.push({ serverMembers: { some: { serverId: query.serverId, bannedAt: null } } });
  }
  if (query.noServerId && typeof query.noServerId === 'string') {
    and.push({ serverMembers: { none: { serverId: query.noServerId, bannedAt: null } } });
  }
  const status = STATUS_FILTERS.find((s) => s === query.status);
  if (status === 'active') and.push({ disabledAt: null, isBanned: false });
  else if (status === 'disabled') and.push({ disabledAt: { not: null } });
  else if (status === 'banned') and.push({ isBanned: true });
  else if (status === 'muted') and.push({ mutedUntil: { gt: new Date() } });
  else if (status === 'mustChange') and.push({ mustChangePassword: true });
  return and.length ? { AND: and } : {};
}

function intParam(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Non-super admins may only manage users ranked below themselves. */
async function loadManageableTarget(req: Request, targetId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw NotFound('User not found');
  const actorRole = req.user!.role;
  if (actorRole !== Role.SUPER_ADMIN && target.id !== req.user!.id) {
    if (ROLE_RANK[permissionRoleOf(target)] >= ROLE_RANK[actorRole]) {
      throw Forbidden('You cannot manage a user with an equal or higher role', 'ROLE_TOO_HIGH');
    }
  }
  return target;
}

function assertCanGrantRole(req: Request, role: Role) {
  const actorRole = req.user!.role;
  if (actorRole === Role.SUPER_ADMIN) return;
  if (ROLE_RANK[role] >= ROLE_RANK[actorRole]) {
    throw Forbidden('You cannot grant a role equal to or above your own', 'ROLE_TOO_HIGH');
  }
}

function roleColumns(role: Role) {
  return isStaff(role) ? { role, platformRole: role } : { role, platformRole: null };
}

async function assertUniqueIdentity(fields: { username?: string; email?: string }, exceptId?: string) {
  if (fields.username) {
    const hit = await prisma.user.findUnique({ where: { username: fields.username }, select: { id: true } });
    if (hit && hit.id !== exceptId) throw Conflict('Username is already taken', 'USERNAME_TAKEN');
  }
  if (fields.email) {
    const hit = await prisma.user.findUnique({ where: { email: fields.email }, select: { id: true } });
    if (hit && hit.id !== exceptId) throw Conflict('Email is already in use', 'EMAIL_TAKEN');
  }
}

function disconnectUser(userId: string) {
  try {
    getIO().in(room.user(userId)).disconnectSockets(true);
  } catch (err) {
    logger.warn({ err }, 'disconnect user sockets failed');
  }
}

async function assertServerAndRole(serverId: string, roleId?: string | null) {
  const server = await prisma.chatServer.findUnique({ where: { id: serverId }, select: { id: true, name: true } });
  if (!server) throw NotFound('Server not found');
  if (roleId) {
    const role = await prisma.serverRole.findFirst({ where: { id: roleId, serverId }, select: { id: true } });
    if (!role) throw BadRequest('Role does not belong to this server', 'BAD_SERVER_ROLE');
  }
  return server;
}

const userInclude = { team: true, _count: { select: { serverMembers: true } } } as const;

router.get('/', async (req, res, next) => {
  try {
    const where = listWhere(req.query);
    const pageSize = intParam(req.query.pageSize, 50, 10, 200);
    const page = intParam(req.query.page, 1, 1, 100_000);
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { username: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    const online = onlineUserIds();
    res.json({ users: rows.map((u) => serializeAdminUser(u, online)), total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  // Leading formula characters are neutralised so spreadsheets don't evaluate them.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

router.get('/export.csv', async (req, res, next) => {
  try {
    const rows = await prisma.user.findMany({
      where: listWhere(req.query),
      include: {
        team: true,
        serverMembers: { where: { bannedAt: null }, include: { server: { select: { name: true } } } },
      },
      orderBy: { username: 'asc' },
    });
    const header = [
      'username',
      'displayName',
      'email',
      'role',
      'team',
      'servers',
      'createdAt',
      'lastSeenAt',
      'disabled',
      'banned',
      'mustChangePassword',
    ];
    const lines = [header.join(',')];
    for (const u of rows) {
      lines.push(
        [
          u.username,
          u.displayName,
          u.email,
          permissionRoleOf(u),
          u.team?.name ?? '',
          u.serverMembers.map((m) => m.server.name).join(' | '),
          u.createdAt.toISOString(),
          u.lastSeenAt?.toISOString() ?? '',
          u.disabledAt ? 'yes' : 'no',
          u.isBanned ? 'yes' : 'no',
          u.mustChangePassword ? 'yes' : 'no',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    await auditRequest(req, { action: 'admin.users.export', meta: { count: rows.length } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sydt-users-${Date.now()}.csv"`);
    res.send(`\uFEFF${lines.join('\r\n')}`);
  } catch (err) {
    next(err);
  }
});

router.get('/servers', async (_req, res, next) => {
  try {
    const servers = await prisma.chatServer.findMany({
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        iconUrl: true,
        autoJoinNewUsers: true,
        roles: { select: { id: true, name: true, color: true }, orderBy: { position: 'desc' } },
        _count: { select: { members: { where: { bannedAt: null } } } },
      },
    });
    res.json({
      servers: servers.map((s) => ({
        id: s.id,
        name: s.name,
        iconUrl: s.iconUrl,
        autoJoinNewUsers: s.autoJoinNewUsers,
        memberCount: s._count.members,
        roles: s.roles,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/servers/:serverId/auto-join',
  validate(serverParams, 'params'),
  validate(z.object({ enabled: z.boolean() })),
  async (req, res, next) => {
    try {
      const serverId = req.params.serverId!;
      const { enabled } = req.body as { enabled: boolean };
      await assertServerAndRole(serverId);
      await prisma.chatServer.update({ where: { id: serverId }, data: { autoJoinNewUsers: enabled } });
      await auditRequest(req, { action: 'admin.server.auto_join', target: serverId, meta: { enabled } });
      res.json({ ok: true, enabled });
    } catch (err) {
      next(err);
    }
  },
);

const bulkSchema = z
  .object({
    action: z.enum(['add', 'move', 'remove']),
    source: z.discriminatedUnion('type', [
      z.object({ type: z.literal('all') }),
      z.object({ type: z.literal('users'), userIds: z.array(z.string().cuid()).min(1).max(5000) }),
      z.object({ type: z.literal('platformRole'), role: roleSchema }),
      z.object({
        type: z.literal('server'),
        serverId: z.string().cuid(),
        roleId: z.string().cuid().nullable().optional(),
      }),
    ]),
    /** Destination for add/move. */
    targetServerId: z.string().cuid().optional(),
    targetRoleId: z.string().cuid().nullable().optional(),
    /** Server the users leave for move/remove. */
    fromServerId: z.string().cuid().optional(),
    includeDisabled: z.boolean().optional(),
    dryRun: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.action !== 'remove' && !d.targetServerId) {
      ctx.addIssue({ code: 'custom', path: ['targetServerId'], message: 'Target server required' });
    }
    if (d.action !== 'add' && !d.fromServerId) {
      ctx.addIssue({ code: 'custom', path: ['fromServerId'], message: 'Source server required' });
    }
    if (d.action === 'move' && d.fromServerId === d.targetServerId) {
      ctx.addIssue({ code: 'custom', path: ['targetServerId'], message: 'Source and target must differ' });
    }
  });

async function resolveBulkUserIds(body: z.infer<typeof bulkSchema>): Promise<string[]> {
  const base: Prisma.UserWhereInput = body.includeDisabled ? {} : { disabledAt: null };
  const src = body.source;
  let where: Prisma.UserWhereInput;
  if (src.type === 'all') where = base;
  else if (src.type === 'users') where = { ...base, id: { in: src.userIds } };
  else if (src.type === 'platformRole') where = { AND: [base, roleWhere(src.role)] };
  else if (src.roleId) {
    where = { ...base, memberServerRoles: { some: { serverId: src.serverId, roleId: src.roleId } } };
  } else {
    where = { ...base, serverMembers: { some: { serverId: src.serverId, bannedAt: null } } };
  }
  if (body.action !== 'add') {
    where = { AND: [where, { serverMembers: { some: { serverId: body.fromServerId! } } }] };
  }
  const rows = await prisma.user.findMany({ where, select: { id: true } });
  return rows.map((r) => r.id);
}

router.post('/membership/bulk', validate(bulkSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof bulkSchema>;
    if (body.targetServerId) await assertServerAndRole(body.targetServerId, body.targetRoleId);
    if (body.fromServerId) await assertServerAndRole(body.fromServerId);
    if (body.source.type === 'server') await assertServerAndRole(body.source.serverId, body.source.roleId);

    const userIds = await resolveBulkUserIds(body);
    const alreadyInTarget = body.targetServerId
      ? await prisma.serverMember.count({
          where: { serverId: body.targetServerId, userId: { in: userIds }, bannedAt: null },
        })
      : 0;

    if (body.dryRun) {
      res.json({ matched: userIds.length, alreadyInTarget });
      return;
    }

    const stats = { matched: userIds.length, added: 0, unbanned: 0, existing: 0, removed: 0 };
    for (const userId of userIds) {
      if (body.targetServerId) {
        const r = await addUserToServer(userId, body.targetServerId, body.targetRoleId ?? null);
        if (r === 'added') stats.added += 1;
        else if (r === 'unbanned') stats.unbanned += 1;
        else stats.existing += 1;
      }
      if (body.fromServerId && body.action !== 'add') {
        if (await removeUserFromServer(userId, body.fromServerId)) stats.removed += 1;
      }
    }

    await auditRequest(req, {
      action: `admin.membership.${body.action}`,
      target: body.targetServerId ?? body.fromServerId ?? null,
      meta: {
        source: body.source.type === 'users' ? { type: 'users', count: body.source.userIds.length } : body.source,
        targetServerId: body.targetServerId ?? null,
        targetRoleId: body.targetRoleId ?? null,
        fromServerId: body.fromServerId ?? null,
        ...stats,
      },
    });
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema,
  /** Omitted = generate a temporary password. */
  password: schemas.newPasswordSchema.optional(),
  mustChangePassword: z.boolean().optional(),
  role: roleSchema.default(Role.SPECTATOR),
  serverId: z.string().cuid().optional(),
  serverRoleId: z.string().cuid().nullable().optional(),
});

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createSchema>;
    assertCanGrantRole(req, body.role);
    await assertUniqueIdentity({ username: body.username, email: body.email });
    if (body.serverId) await assertServerAndRole(body.serverId, body.serverRoleId);

    const temporaryPassword = body.password ? null : generatePassword();
    const user = await prisma.user.create({
      data: {
        email: body.email,
        username: body.username,
        displayName: body.displayName,
        passwordHash: await hashPassword(body.password ?? temporaryPassword!),
        mustChangePassword: body.mustChangePassword ?? true,
        ...roleColumns(body.role),
      },
    });
    if (body.serverId) await addUserToServer(user.id, body.serverId, body.serverRoleId ?? null);
    await joinAutoJoinServers(user.id);
    if (!body.serverId) {
      const { ensureUserHasHomeServer } = await import('../../lib/migrate-default-server.js');
      await ensureUserHasHomeServer(user.id);
    }

    await auditRequest(req, {
      action: 'admin.user.create',
      target: user.id,
      meta: { username: user.username, role: body.role, serverId: body.serverId ?? null },
    });
    res.status(201).json({ id: user.id, username: user.username, temporaryPassword });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', validate(idParams, 'params'), async (req, res, next) => {
  try {
    const id = req.params.id!;
    const user = await prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!user) throw NotFound('User not found');
    const [memberships, roles, teams, activeSessions] = await Promise.all([
      prisma.serverMember.findMany({
        where: { userId: id },
        include: { server: { select: { id: true, name: true, iconUrl: true } } },
        orderBy: { joinedAt: 'asc' },
      }),
      prisma.memberServerRole.findMany({
        where: { userId: id },
        include: { role: { select: { id: true, name: true, color: true } } },
      }),
      prisma.serverTeamMember.findMany({
        where: { userId: id },
        include: { team: { select: { id: true, name: true, color: true } } },
      }),
      prisma.refreshToken.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    res.json({
      user: serializeAdminUser(user, onlineUserIds()),
      activeSessions,
      servers: memberships.map((m) => ({
        serverId: m.serverId,
        name: m.server.name,
        iconUrl: m.server.iconUrl,
        joinedAt: m.joinedAt.toISOString(),
        bannedAt: m.bannedAt?.toISOString() ?? null,
        roles: roles.filter((r) => r.serverId === m.serverId).map((r) => r.role),
        team: teams.find((t) => t.serverId === m.serverId)?.team ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const profileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    username: usernameSchema.optional(),
    email: emailSchema.optional(),
  })
  .refine((d) => d.displayName !== undefined || d.username !== undefined || d.email !== undefined, {
    message: 'Nothing to update',
  });

router.patch('/:id/profile', validate(idParams, 'params'), validate(profileSchema), async (req, res, next) => {
  try {
    const target = await loadManageableTarget(req, req.params.id!);
    const body = req.body as z.infer<typeof profileSchema>;
    await assertUniqueIdentity({ username: body.username, email: body.email }, target.id);
    await prisma.user.update({ where: { id: target.id }, data: body });
    const changed = Object.fromEntries(
      Object.entries(body).map(([k, v]) => [k, { from: (target as Record<string, unknown>)[k], to: v }]),
    );
    await auditRequest(req, { action: 'admin.user.profile', target: target.id, meta: { changed } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const passwordSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('set'), password: schemas.newPasswordSchema, mustChangePassword: z.boolean().optional() }),
  z.object({ mode: z.literal('reset') }),
]);

router.post('/:id/password', validate(idParams, 'params'), validate(passwordSchema), async (req, res, next) => {
  try {
    const target = await loadManageableTarget(req, req.params.id!);
    const body = req.body as z.infer<typeof passwordSchema>;
    const temporaryPassword = body.mode === 'reset' ? generatePassword() : null;
    const mustChangePassword = body.mode === 'reset' ? true : (body.mustChangePassword ?? false);
    await prisma.user.update({
      where: { id: target.id },
      data: {
        passwordHash: await hashPassword(body.mode === 'set' ? body.password : temporaryPassword!),
        mustChangePassword,
      },
    });
    if (target.id !== req.user!.id) {
      await revokeAllRefreshTokens(target.id);
      disconnectUser(target.id);
    }
    await auditRequest(req, {
      action: body.mode === 'reset' ? 'admin.user.password_reset' : 'admin.user.password_set',
      target: target.id,
      meta: { username: target.username, mustChangePassword },
    });
    res.json({ ok: true, temporaryPassword });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/role',
  validate(idParams, 'params'),
  validate(z.object({ role: roleSchema })),
  async (req, res, next) => {
    try {
      const target = await loadManageableTarget(req, req.params.id!);
      if (target.id === req.user!.id) throw BadRequest('You cannot change your own role', 'SELF_ROLE');
      const { role } = req.body as { role: Role };
      assertCanGrantRole(req, role);
      const before = permissionRoleOf(target);
      if (before === Role.SUPER_ADMIN && role !== Role.SUPER_ADMIN) {
        const supers = await prisma.user.count({
          where: { OR: [{ role: Role.SUPER_ADMIN }, { platformRole: Role.SUPER_ADMIN }], disabledAt: null },
        });
        if (supers <= 1) throw BadRequest('At least one super admin must remain', 'LAST_SUPER_ADMIN');
      }
      await prisma.user.update({ where: { id: target.id }, data: roleColumns(role) });
      await revokeAllRefreshTokens(target.id);
      disconnectUser(target.id);
      await auditRequest(req, {
        action: 'admin.user.role',
        target: target.id,
        meta: { username: target.username, from: before, to: role },
      });
      res.json({ ok: true, role });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id/status',
  validate(idParams, 'params'),
  validate(z.object({ disabled: z.boolean(), reason: z.string().trim().max(500).nullable().optional() })),
  async (req, res, next) => {
    try {
      const target = await loadManageableTarget(req, req.params.id!);
      if (target.id === req.user!.id) throw BadRequest('You cannot deactivate yourself', 'SELF_DISABLE');
      const { disabled, reason } = req.body as { disabled: boolean; reason?: string | null };
      await prisma.user.update({
        where: { id: target.id },
        data: disabled
          ? { disabledAt: new Date(), disabledReason: reason || null, status: 'OFFLINE' }
          : { disabledAt: null, disabledReason: null },
      });
      if (disabled) {
        await revokeAllRefreshTokens(target.id);
        disconnectUser(target.id);
      }
      await auditRequest(req, {
        action: disabled ? 'admin.user.disable' : 'admin.user.enable',
        target: target.id,
        meta: { username: target.username, reason: reason ?? null },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.post('/:id/sessions/revoke', validate(idParams, 'params'), async (req, res, next) => {
  try {
    const target = await loadManageableTarget(req, req.params.id!);
    await revokeAllRefreshTokens(target.id);
    if (target.id !== req.user!.id) disconnectUser(target.id);
    await auditRequest(req, { action: 'admin.user.sessions_revoke', target: target.id, meta: { username: target.username } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.put(
  '/:id/servers/:serverId',
  validate(userServerParams, 'params'),
  validate(z.object({ roleId: z.string().cuid().nullable().optional() })),
  async (req, res, next) => {
    try {
      const target = await loadManageableTarget(req, req.params.id!);
      const serverId = req.params.serverId!;
      const { roleId } = req.body as { roleId?: string | null };
      await assertServerAndRole(serverId, roleId);
      const result = await addUserToServer(target.id, serverId, roleId ?? null);
      await auditRequest(req, {
        action: 'admin.membership.add',
        target: serverId,
        meta: { userId: target.id, username: target.username, roleId: roleId ?? null, result },
      });
      res.json({ ok: true, result });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/:id/servers/:serverId', validate(userServerParams, 'params'), async (req, res, next) => {
  try {
    const target = await loadManageableTarget(req, req.params.id!);
    const serverId = req.params.serverId!;
    const removed = await removeUserFromServer(target.id, serverId);
    if (!removed) throw NotFound('Membership not found');
    await auditRequest(req, {
      action: 'admin.membership.remove',
      target: serverId,
      meta: { userId: target.id, username: target.username },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
