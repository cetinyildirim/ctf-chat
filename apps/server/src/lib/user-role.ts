import { Role, effectivePermissionRole, isStaff } from '@sydt/shared';
import { prisma } from '../prisma.js';

type UserRoleRow = {
  id?: string;
  role: string;
  platformRole: string | null;
  teamId?: string | null;
  username?: string;
  email?: string;
};

export function permissionRoleOf(user: UserRoleRow): Role {
  return effectivePermissionRole({
    role: user.role as Role,
    platformRole: (user.platformRole as Role | null) ?? null,
  });
}

/** Restore staff who were downgraded to team roles before platformRole existed */
export async function repairUserPlatformRole(userId: string): Promise<UserRoleRow> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const perm = permissionRoleOf(user);
  if (user.platformRole && isStaff(user.platformRole as Role) && !isStaff(user.role as Role)) {
    return prisma.user.update({
      where: { id: userId },
      data: { role: user.platformRole },
    });
  }

  if (isStaff(perm) && !user.platformRole) {
    return prisma.user.update({
      where: { id: userId },
      data: { platformRole: user.role },
    });
  }

  return user;
}

export async function authPayloadForUser(userId: string) {
  const user = await repairUserPlatformRole(userId);
  const full = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, username: true, teamId: true },
  });
  return {
    id: full.id,
    username: full.username,
    role: permissionRoleOf(user),
    teamId: full.teamId,
  };
}
