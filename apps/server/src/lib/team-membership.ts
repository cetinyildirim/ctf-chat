import type { PrismaClient } from '@prisma/client';
import { Role, isStaff } from '@sydt/shared';
import { permissionRoleOf } from './user-role.js';

type Db = PrismaClient | import('@prisma/client').Prisma.TransactionClient;

export async function getUserTeamOnServer(db: Db, userId: string, serverId: string) {
  const row = await db.serverTeamMember.findUnique({
    where: { userId_serverId: { userId, serverId } },
    include: { team: true },
  });
  return row?.team ?? null;
}

export async function assignUserToServerTeam(
  db: Db,
  args: { userId: string; serverId: string; teamId: string; asCaptain?: boolean },
) {
  const team = await db.team.findFirst({ where: { id: args.teamId, serverId: args.serverId } });
  if (!team) throw new Error('Team not in server');

  const user = await db.user.findUnique({ where: { id: args.userId } });
  if (!user) throw new Error('User not found');

  await db.serverTeamMember.upsert({
    where: { userId_serverId: { userId: args.userId, serverId: args.serverId } },
    create: { userId: args.userId, serverId: args.serverId, teamId: args.teamId },
    update: { teamId: args.teamId },
  });

  const staff = isStaff(permissionRoleOf(user));
  // User.teamId is a legacy display cache for single-competition UX; ACL must use ServerTeamMember.
  const userUpdate: { teamId: string; role?: Role; platformRole?: Role | null } = {
    teamId: args.teamId,
  };

  if (staff) {
    if (!user.platformRole && isStaff(user.role as Role)) {
      userUpdate.platformRole = user.role as Role;
    }
  } else {
    userUpdate.role = args.asCaptain ? Role.TEAM_CAPTAIN : Role.TEAM_MEMBER;
  }

  // Do not revoke refresh tokens here. Self-service join/leave (SPECTATOR ↔ TEAM_MEMBER)
  // must keep the current browser session; HTTP auth already reloads role from DB.
  // Admin routes that need a forced re-login call revokeAllRefreshTokens explicitly.
  await db.user.update({ where: { id: args.userId }, data: userUpdate });

  if (args.asCaptain) {
    await db.team.update({ where: { id: args.teamId }, data: { captainId: args.userId } });
  }
}

export async function removeUserFromServerTeam(db: Db, userId: string, serverId: string) {
  const membership = await db.serverTeamMember.findUnique({
    where: { userId_serverId: { userId, serverId } },
    include: { team: true },
  });
  if (!membership) return;

  await db.serverTeamMember.delete({
    where: { userId_serverId: { userId, serverId } },
  });

  if (membership.team.captainId === userId) {
    await db.team.update({ where: { id: membership.teamId }, data: { captainId: null } });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const staff = isStaff(permissionRoleOf(user));
  if (user.teamId === membership.teamId) {
    const other = await db.serverTeamMember.findFirst({ where: { userId } });
    if (staff) {
      await db.user.update({
        where: { id: userId },
        data: { teamId: other?.teamId ?? null },
      });
    } else {
      await db.user.update({
        where: { id: userId },
        data: {
          teamId: other?.teamId ?? null,
          role: other ? Role.TEAM_MEMBER : Role.SPECTATOR,
        },
      });
    }
  }
}
