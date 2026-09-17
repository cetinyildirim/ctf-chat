import type { Role } from '@sydt/shared';
import { isStaff } from '@sydt/shared';
import { prisma } from '../prisma.js';
import { permissionRoleOf } from './user-role.js';

type TeamUserLite = {
  role: Role;
  teamId: string | null;
};

/**
 * Sync helper for callers that already resolved competition-scoped team ids.
 * Prefer `canUsersDirectMessageOnSharedTeam` for new code.
 */
export function canUsersDirectMessage(a: TeamUserLite, b: TeamUserLite): boolean {
  if (isStaff(a.role) || isStaff(b.role)) return true;
  if (!a.teamId || !b.teamId) return false;
  return a.teamId === b.teamId;
}

/**
 * Operators may DM: same competition-team members, or anyone involving staff.
 * Uses ServerTeamMember (not legacy global User.teamId).
 */
export async function canUsersDirectMessageOnSharedTeam(
  userIdA: string,
  userIdB: string,
): Promise<boolean> {
  const [a, b] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userIdA },
      select: { role: true, platformRole: true },
    }),
    prisma.user.findUnique({
      where: { id: userIdB },
      select: { role: true, platformRole: true },
    }),
  ]);
  if (!a || !b) return false;
  if (isStaff(permissionRoleOf(a)) || isStaff(permissionRoleOf(b))) return true;

  const aMemberships = await prisma.serverTeamMember.findMany({
    where: { userId: userIdA },
    select: { serverId: true, teamId: true },
  });
  if (aMemberships.length === 0) return false;

  const overlap = await prisma.serverTeamMember.findFirst({
    where: {
      userId: userIdB,
      OR: aMemberships.map((m) => ({ serverId: m.serverId, teamId: m.teamId })),
    },
    select: { userId: true },
  });
  return !!overlap;
}
