import { Router } from 'express';
import { z } from 'zod';
import { Permission, Role, schemas } from '@sydt/shared';
import crypto from 'node:crypto';
import { prisma } from '../../prisma.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeTeam, serializeUser } from '../serializers.js';
import { emitChannelsRefresh } from '../../realtime/broadcasters.js';
import { revokeAllRefreshTokensForUsers, revokeAllRefreshTokens } from '../../lib/revoke-sessions.js';
import { logoImageUpload } from '../../lib/upload.js';
import { removeLogoFiles, writeLogoFile } from '../../lib/logo-files.js';
import { provisionTeamRoomsForTeamInCategories } from '../categories/category-team-rooms.service.js';
import { assignUserToServerTeam, removeUserFromServerTeam } from '../../lib/team-membership.js';
import { permissionRoleOf } from '../../lib/user-role.js';
import { isStaff } from '@sydt/shared';
import { assertPlatformAdminForServer, assertTeamAdminScope } from '../../lib/server-admin-scope.js';

const router: Router = Router();

router.use(requirePermission(Permission.TEAM_MANAGE));

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

const serverIdQuery = z.object({ serverId: z.string().cuid() });

router.get('/', validate(serverIdQuery, 'query'), async (req, res, next) => {
  try {
    const me = req.user!;
    const { serverId } = req.query as z.infer<typeof serverIdQuery>;
    await assertPlatformAdminForServer(me.id, serverId, me.role);
    const teams = await prisma.team.findMany({
      where: { serverId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { serverMembers: true } },
        captain: { include: { team: true } },
      },
    });
    res.json({
      teams: teams.map((t) => ({
        ...serializeTeam(t, { memberCount: t._count.serverMembers }),
        captain: t.captain ? serializeUser(t.captain) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(serverIdQuery, 'query'), validate(schemas.adminCreateTeamSchema), async (req, res, next) => {
  try {
    const me = req.user!;
    const { serverId } = req.query as z.infer<typeof serverIdQuery>;
    await assertPlatformAdminForServer(me.id, serverId, me.role);
    const data = req.body as z.infer<typeof schemas.adminCreateTeamSchema>;
    const slugBase = slugify(data.name);
    let slug = slugBase || 'team';
    let n = 0;
    while (await prisma.team.findFirst({ where: { serverId, slug } })) {
      slug = `${slugBase}-${++n}`;
    }
    const team = await prisma.team.create({
      data: {
        serverId,
        name: data.name.trim(),
        slug,
        tagline: data.tagline?.trim() ? data.tagline.trim() : null,
        color: data.color ?? '#22d3ee',
        inviteCode: `INV-${slugBase.slice(0, 6).toUpperCase().replace(/-/g, 'X')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      },
      include: { _count: { select: { serverMembers: true } } },
    });
    await provisionTeamRoomsForTeamInCategories(prisma, { id: team.id, name: team.name, serverId });
    await audit({
      actorId: req.user?.id,
      action: 'team.create',
      target: team.id,
      meta: { name: team.name },
    });
    emitChannelsRefresh(serverId);
    res.status(201).json({ team: serializeTeam(team, { memberCount: 0 }) });
  } catch (err) {
    next(err);
  }
});

const idSchema = z.object({ id: z.string().cuid() });

router.get('/:id/invite', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const me = req.user!;
    const id = req.params.id;
    if (!id) throw NotFound();
    await assertTeamAdminScope(me.id, id, me.role);
    const team = await prisma.team.findUnique({
      where: { id },
      select: { inviteCode: true },
    });
    if (!team) throw NotFound();
    res.json({ inviteCode: team.inviteCode as string });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', validate(idSchema, 'params'), validate(schemas.adminPatchTeamSchema), async (req, res, next) => {
  try {
    const me = req.user!;
    const id = req.params.id;
    if (!id) throw NotFound();
    await assertTeamAdminScope(me.id, id, me.role);
    const data = req.body as z.infer<typeof schemas.adminPatchTeamSchema>;
    const existing = await prisma.team.findUnique({
      where: { id },
      include: { _count: { select: { serverMembers: true } } },
    });
    if (!existing) throw NotFound();
    const patched = await prisma.team.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.tagline !== undefined ? { tagline: data.tagline === null ? null : data.tagline.trim() || null } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
      },
      include: { _count: { select: { serverMembers: true } } },
    });
    await audit({
      actorId: req.user?.id,
      action: 'team.update',
      target: id,
      meta: data as Record<string, unknown>,
    });
    if (existing.serverId) emitChannelsRefresh(existing.serverId);
    res.json({ team: serializeTeam(patched, { memberCount: patched._count.serverMembers }) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const me = req.user!;
    const id = req.params.id;
    if (!id) throw NotFound();
    const { serverId } = await assertTeamAdminScope(me.id, id, me.role);
    const existing = await prisma.team.findUnique({ where: { id } });
    if (!existing) throw NotFound();

    const memberIds = (
      await prisma.user.findMany({ where: { teamId: id }, select: { id: true } })
    ).map((u) => u.id);

    await prisma.channel.deleteMany({ where: { teamId: id } });
    await prisma.category.deleteMany({ where: { teamId: id } });
    await prisma.user.updateMany({
      where: { teamId: id, role: Role.TEAM_CAPTAIN },
      data: { role: Role.TEAM_MEMBER },
    });
    await prisma.user.updateMany({ where: { teamId: id }, data: { teamId: null } });
    await prisma.team.update({
      where: { id },
      data: { captainId: null },
    });
    await prisma.team.delete({ where: { id } });
    await revokeAllRefreshTokensForUsers(memberIds);
    await audit({ actorId: req.user?.id, action: 'team.delete', target: id });
    emitChannelsRefresh(serverId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/members', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const me = req.user!;
    const id = req.params.id;
    if (!id) throw NotFound();
    await assertTeamAdminScope(me.id, id, me.role);
    const members = await prisma.serverTeamMember.findMany({
      where: { teamId: id },
      include: { user: { include: { team: true } } },
      orderBy: { user: { username: 'asc' } },
    });
    res.json({ users: members.map((m) => serializeUser(m.user)) });
  } catch (err) {
    next(err);
  }
});

async function resolveMemberUserId(body: z.infer<typeof schemas.adminAssignMemberSchema>): Promise<string> {
  const raw = (body.username ?? body.userId ?? '').trim().replace(/^@/, '');
  if (!raw) throw BadRequest('Username or user id required');
  const byId = await prisma.user.findUnique({ where: { id: raw } });
  if (byId) return byId.id;
  const byUsername = await prisma.user.findUnique({ where: { username: raw } });
  if (byUsername) return byUsername.id;
  const byLower = await prisma.user.findFirst({ where: { username: raw.toLowerCase() } });
  if (byLower) return byLower.id;
  throw NotFound('User not found');
}

router.post('/:id/members', validate(idSchema, 'params'), validate(schemas.adminAssignMemberSchema), async (req, res, next) => {
  try {
    const me = req.user!;
    const teamId = req.params.id;
    if (!teamId) throw NotFound();
    const { serverId } = await assertTeamAdminScope(me.id, teamId, me.role);
    const userId = await resolveMemberUserId(req.body as z.infer<typeof schemas.adminAssignMemberSchema>);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw NotFound();
    const candidate = await prisma.user.findUnique({ where: { id: userId } });
    if (!candidate) throw NotFound();

    await assignUserToServerTeam(prisma, {
      userId,
      serverId,
      teamId,
      asCaptain: false,
    });
    if (candidate.role === Role.OBSERVER || candidate.role === Role.SPECTATOR) {
      await prisma.user.update({ where: { id: userId }, data: { role: Role.TEAM_MEMBER } });
      await revokeAllRefreshTokens(userId);
    }
    await audit({
      actorId: req.user?.id,
      action: 'team.member_add',
      target: teamId,
      meta: { userId, username: candidate.username },
    });
    emitChannelsRefresh(serverId);

    const members = await prisma.serverTeamMember.findMany({
      where: { teamId },
      include: { user: { include: { team: true } } },
      orderBy: { user: { username: 'asc' } },
    });
    res.json({ users: members.map((m) => serializeUser(m.user)) });
  } catch (err) {
    next(err);
  }
});

const memberParamsSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
});

router.delete('/:id/members/:userId', validate(memberParamsSchema, 'params'), async (req, res, next) => {
  try {
    const me = req.user!;
    const teamId = req.params.id;
    const userId = req.params.userId;
    if (!teamId || !userId) throw NotFound();
    const { serverId } = await assertTeamAdminScope(me.id, teamId, me.role);
    const membership = await prisma.serverTeamMember.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!membership || membership.teamId !== teamId) throw BadRequest('User is not on this team');

    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw NotFound();

    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (team?.captainId === userId) {
        await prisma.team.update({ where: { id: teamId }, data: { captainId: null } });
      }
    }

    await removeUserFromServerTeam(prisma, userId, serverId);
    await audit({
      actorId: req.user?.id,
      action: 'team.member_remove',
      target: teamId,
      meta: { userId, username: u.username },
    });
    emitChannelsRefresh(serverId);

    const members = await prisma.serverTeamMember.findMany({
      where: { teamId },
      include: { user: { include: { team: true } } },
      orderBy: { user: { username: 'asc' } },
    });
    res.json({ users: members.map((m) => serializeUser(m.user)) });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/captain',
  validate(idSchema, 'params'),
  validate(schemas.adminSetCaptainSchema),
  async (req, res, next) => {
    try {
      const me = req.user!;
      const teamId = req.params.id;
      if (!teamId) throw NotFound();
      const { serverId } = await assertTeamAdminScope(me.id, teamId, me.role);
      const data = req.body as z.infer<typeof schemas.adminSetCaptainSchema>;
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { _count: { select: { serverMembers: true } } },
      });
      if (!team) throw NotFound();

      const nextCaptainId = data.userId;
      const prevCaptainId = team.captainId;

      if (!nextCaptainId) {
        if (prevCaptainId) {
          const prev = await prisma.user.findUnique({ where: { id: prevCaptainId } });
          if (prev && !isStaff(permissionRoleOf(prev))) {
            await prisma.user.update({
              where: { id: prevCaptainId },
              data: { role: Role.TEAM_MEMBER },
            });
          }
        }
        await prisma.team.update({ where: { id: teamId }, data: { captainId: null } });
        if (prevCaptainId) await revokeAllRefreshTokens(prevCaptainId);
        emitChannelsRefresh(serverId);
        const t2 = await prisma.team.findUniqueOrThrow({
          where: { id: teamId },
          include: { _count: { select: { serverMembers: true } } },
        });
        return res.json({ team: serializeTeam(t2, { memberCount: t2._count.serverMembers }) });
      }

      const newCap = await prisma.user.findUnique({ where: { id: nextCaptainId } });
      if (!newCap || newCap.teamId !== teamId) throw BadRequest('Captain must belong to team');

      if (prevCaptainId && prevCaptainId !== nextCaptainId) {
        const prev = await prisma.user.findUnique({ where: { id: prevCaptainId } });
        if (prev && !isStaff(permissionRoleOf(prev))) {
          await prisma.user.update({
            where: { id: prevCaptainId },
            data: { role: Role.TEAM_MEMBER },
          });
        }
      }

      if (!isStaff(permissionRoleOf(newCap))) {
        await prisma.user.update({
          where: { id: nextCaptainId },
          data: { role: Role.TEAM_CAPTAIN },
        });
      }
      await prisma.team.update({
        where: { id: teamId },
        data: { captainId: nextCaptainId },
      });
      await audit({
        actorId: req.user?.id,
        action: 'team.captain',
        target: teamId,
        meta: { captainId: nextCaptainId },
      });
      const revokeIds = [prevCaptainId, nextCaptainId].filter((x): x is string => !!x);
      await revokeAllRefreshTokensForUsers(revokeIds);
      emitChannelsRefresh(serverId);
      const t2 = await prisma.team.findUniqueOrThrow({
        where: { id: teamId },
        include: { _count: { select: { serverMembers: true } } },
      });
      res.json({ team: serializeTeam(t2, { memberCount: t2._count.serverMembers }) });
    } catch (err) {
      next(err);
    }
  },
);

router.post('/:id/invite/regenerate', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const me = req.user!;
    const teamId = req.params.id;
    if (!teamId) throw NotFound();
    const { serverId } = await assertTeamAdminScope(me.id, teamId, me.role);
    const existing = await prisma.team.findUnique({ where: { id: teamId } });
    if (!existing) throw NotFound();
    let inviteCode = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      inviteCode = `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const clash = await prisma.team.findFirst({
        where: { serverId, inviteCode },
      });
      if (!clash) break;
      inviteCode = '';
    }
    if (!inviteCode) throw BadRequest('Could not generate invite code');

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { inviteCode },
      include: { _count: { select: { serverMembers: true } } },
    });
    await audit({ actorId: req.user?.id, action: 'team.invite_regen', target: teamId });
    res.json({
      team: serializeTeam(updated, { memberCount: updated._count.serverMembers }),
      inviteCode,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/logo', validate(idSchema, 'params'), logoImageUpload.single('file'), async (req, res, next) => {
  try {
    const me = req.user!;
    const id = req.params.id;
    if (!id) throw NotFound();
    await assertTeamAdminScope(me.id, id, me.role);
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Image file required' } });
      return;
    }
    const team = await prisma.team.findUnique({ where: { id }, include: { _count: { select: { serverMembers: true } } } });
    if (!team) throw NotFound();
    const url = await writeLogoFile('team', id, file.buffer, file.originalname);
    const updated = await prisma.team.update({
      where: { id },
      data: { logoUrl: url },
      include: { _count: { select: { serverMembers: true } } },
    });
    await audit({ actorId: req.user?.id, action: 'team.logo', target: id, meta: { name: team.name } });
    res.json({ team: serializeTeam(updated, { memberCount: updated._count.serverMembers }) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/logo', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const me = req.user!;
    const id = req.params.id;
    if (!id) throw NotFound();
    await assertTeamAdminScope(me.id, id, me.role);
    const team = await prisma.team.findUnique({ where: { id }, include: { _count: { select: { serverMembers: true } } } });
    if (!team) throw NotFound();
    await removeLogoFiles('team', id);
    const updated = await prisma.team.update({
      where: { id },
      data: { logoUrl: null },
      include: { _count: { select: { serverMembers: true } } },
    });
    await audit({ actorId: req.user?.id, action: 'team.logo.clear', target: id });
    res.json({ team: serializeTeam(updated, { memberCount: updated._count.serverMembers }) });
  } catch (err) {
    next(err);
  }
});

export default router;
