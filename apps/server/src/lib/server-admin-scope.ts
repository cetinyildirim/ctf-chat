import { Permission, permissionsFor, type Role } from '@sydt/shared';
import { prisma } from '../prisma.js';
import { BadRequest, NotFound } from './http-error.js';
import { requireServerMember } from './server-membership.js';

function requireServerId(serverId: string | null | undefined, label: string): string {
  if (!serverId) throw BadRequest(`${label} has no server scope`);
  return serverId;
}

/** Platform staff without ADMIN_DASHBOARD must belong to the target server. */
export async function assertPlatformAdminForServer(
  userId: string,
  serverId: string,
  role: Role,
): Promise<void> {
  if (permissionsFor(role).includes(Permission.ADMIN_DASHBOARD)) return;
  await requireServerMember(userId, serverId);
}

export async function assertPlatformAdminForCategory(
  userId: string,
  categoryId: string,
  role: Role,
): Promise<string> {
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { serverId: true },
  });
  if (!cat) throw NotFound('Category not found');
  const serverId = requireServerId(cat.serverId, 'Category');
  await assertPlatformAdminForServer(userId, serverId, role);
  return serverId;
}

export async function assertPlatformAdminForChannel(
  userId: string,
  channelId: string,
  role: Role,
): Promise<string | null> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { serverId: true, type: true },
  });
  if (!channel) throw NotFound('Channel not found');
  if (channel.serverId) {
    await assertPlatformAdminForServer(userId, channel.serverId, role);
  }
  return channel.serverId;
}

export async function assertTeamAdminScope(
  userId: string,
  teamId: string,
  role: Role,
): Promise<{ id: string; serverId: string }> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, serverId: true },
  });
  if (!team?.serverId) throw NotFound('Team not found');
  await assertPlatformAdminForServer(userId, team.serverId, role);
  return { id: team.id, serverId: team.serverId };
}
