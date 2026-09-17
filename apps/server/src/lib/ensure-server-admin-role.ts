import { SERVER_PERM_KEYS } from '@sydt/shared';
import { prisma } from '../prisma.js';

export async function ensureServerAdminRole(serverId: string) {
  const roles = await prisma.serverRole.findMany({ where: { serverId } });
  const existing = roles.find((role) => role.name.toLowerCase() === 'admin');
  if (existing) return existing;

  const maxPos = await prisma.serverRole.findFirst({
    where: { serverId },
    orderBy: { position: 'desc' },
  });
  const allPerms = Object.fromEntries(SERVER_PERM_KEYS.map((key) => [key, true]));

  return prisma.serverRole.create({
    data: {
      serverId,
      name: 'Admin',
      color: '#f59e0b',
      position: (maxPos?.position ?? 0) + 1,
      permissionsJson: JSON.stringify(allPerms),
    },
  });
}
