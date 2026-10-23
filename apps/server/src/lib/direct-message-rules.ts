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
 * Users may DM when staff is involved, they are friends, or they share a
 * server where neither is banned. Friendship is not required.
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

  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: userIdA, addresseeId: userIdB },
        { requesterId: userIdB, addresseeId: userIdA },
      ],
    },
    select: { id: true },
  });
  if (friendship) return true;

  const aServers = await prisma.serverMember.findMany({
    where: { userId: userIdA, bannedAt: null },
    select: { serverId: true },
  });
  if (aServers.length === 0) return false;

  const shared = await prisma.serverMember.findFirst({
    where: {
      userId: userIdB,
      bannedAt: null,
      serverId: { in: aServers.map((m) => m.serverId) },
    },
    select: { userId: true },
  });
  return !!shared;
}
