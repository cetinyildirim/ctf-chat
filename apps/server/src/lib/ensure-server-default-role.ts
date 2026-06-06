import { SERVER_ROLE_DEFAULT_PERMISSIONS } from '@sydt/shared';
import { prisma } from '../prisma.js';

export async function ensureServerDefaultRole(serverId: string) {
  const existing = await prisma.serverRole.findFirst({ where: { serverId, name: 'Default' } });
  if (existing) return existing;
  return prisma.serverRole.create({
    data: {
      serverId,
      name: 'Default',
      color: '#99aab5',
      position: 0,
      permissionsJson: JSON.stringify(SERVER_ROLE_DEFAULT_PERMISSIONS),
    },
  });
}
