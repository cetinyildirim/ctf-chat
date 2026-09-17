import {
  Permission,
  permissionsFor,
  type ServerPermKey,
  mergeServerPermissions,
  parseServerPermissions,
  SERVER_PERM_KEYS,
  SERVER_ROLE_DEFAULT_PERMISSIONS,
} from '@sydt/shared';
import { prisma } from '../prisma.js';
import { Forbidden } from './http-error.js';
import type { AuthUser } from '../middleware/auth.js';

export async function getEffectiveServerPermissions(
  userId: string,
  serverId: string,
): Promise<Set<ServerPermKey>> {
  const rows = await prisma.memberServerRole.findMany({
    where: { userId, serverId },
    include: { role: true },
  });
  if (rows.length === 0) {
    // Members without an assigned role still get the safe default set (matches join bootstrap).
    return new Set(
      (Object.entries(SERVER_ROLE_DEFAULT_PERMISSIONS) as [ServerPermKey, boolean][])
        .filter(([, v]) => v)
        .map(([k]) => k),
    );
  }
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

/**
 * Enforce Discord-style server perms on competition channels.
 * DM / unscoped channels skip this (platform RBAC only).
 */
export async function assertChannelServerPermission(
  user: AuthUser,
  channel: { serverId: string | null },
  key: ServerPermKey,
): Promise<void> {
  if (!channel.serverId) return;
  await assertServerPermission(user.id, channel.serverId, key, permissionsFor(user.role));
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
