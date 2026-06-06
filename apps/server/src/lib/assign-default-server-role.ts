import { prisma } from '../prisma.js';
import { ensureServerDefaultRole } from './ensure-server-default-role.js';

export async function assignDefaultRoleToMember(userId: string, serverId: string) {
  const role = await ensureServerDefaultRole(serverId);
  await prisma.memberServerRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    create: { userId, serverId, roleId: role.id },
    update: {},
  });
}
