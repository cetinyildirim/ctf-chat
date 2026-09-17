import { prisma } from '../prisma.js';
import { ensureServerDefaultRole } from './ensure-server-default-role.js';

export async function assignDefaultRoleToMember(userId: string, serverId: string) {
  return assignServerRoleToMember(userId, serverId);
}

export async function assignServerRoleToMember(
  userId: string,
  serverId: string,
  roleId?: string | null,
) {
  let targetRoleId = roleId?.trim() || null;
  if (targetRoleId) {
    const role = await prisma.serverRole.findFirst({ where: { id: targetRoleId, serverId } });
    if (!role) throw new Error('Invalid server role');
  } else {
    const role = await ensureServerDefaultRole(serverId);
    targetRoleId = role.id;
  }

  await prisma.memberServerRole.deleteMany({ where: { userId, serverId } });
  await prisma.memberServerRole.create({
    data: { userId, serverId, roleId: targetRoleId },
  });
}
