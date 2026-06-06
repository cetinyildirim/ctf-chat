import { Permission, type ServerPermKey, mergeServerPermissions, parseServerPermissions, SERVER_PERM_KEYS } from '@sydt/shared';
import { prisma } from '../prisma.js';
import { Forbidden } from './http-error.js';

export async function getEffectiveServerPermissions(
  userId: string,
  serverId: string,
): Promise<Set<ServerPermKey>> {
  const rows = await prisma.memberServerRole.findMany({
    where: { userId, serverId },
    include: { role: true },
  });
  const maps = rows.map((r) => parseServerPermissions(r.role.permissionsJson));
  const merged = mergeServerPermissions(maps);
  return new Set(
    (Object.entries(merged) as [ServerPermKey, boolean][]).filter(([, v]) => v).map(([k]) => k),
  );
}

export async function assertServerPermission(
  userId: string,
  serverId: string,
  key: ServerPermKey,
  platformPermissions: string[],
): Promise<void> {
  if (platformPermissions.includes(Permission.ADMIN_DASHBOARD)) return;
  const perms = await getEffectiveServerPermissions(userId, serverId);
  if (!perms.has(key)) throw Forbidden('Missing server permission');
}

export async function canManageServerRoles(
  userId: string,
  serverId: string,
  platformPermissions: string[],
): Promise<boolean> {
  if (platformPermissions.includes(Permission.ADMIN_DASHBOARD)) return true;
  const perms = await getEffectiveServerPermissions(userId, serverId);
  return perms.has('manageRoles') || perms.has('manageServer');
}

/** Prevent assigning roles whose permissions exceed the actor's own. */
export async function assertCanAssignServerRoles(
  actorId: string,
  serverId: string,
  roleIds: string[],
  platformPermissions: string[],
): Promise<void> {
  if (await canManageServerRoles(actorId, serverId, platformPermissions)) return;

  const actorPerms = await getEffectiveServerPermissions(actorId, serverId);
  const roles = await prisma.serverRole.findMany({ where: { serverId, id: { in: roleIds } } });
  for (const role of roles) {
    const rolePerms = parseServerPermissions(role.permissionsJson);
    for (const key of SERVER_PERM_KEYS) {
      if (rolePerms[key] && !actorPerms.has(key)) {
        throw Forbidden('Cannot assign role with permissions you lack');
      }
    }
  }
}
