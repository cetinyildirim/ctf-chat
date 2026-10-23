import { prisma } from '../prisma.js';
import { Forbidden, NotFound } from './http-error.js';
import { assignServerRoleToMember } from './assign-default-server-role.js';
import { getIO } from '../realtime/io.js';
import { room } from '../realtime/rooms.js';
import { logger } from './logger.js';

export function isServerBanned(member: { bannedAt: Date | null } | null | undefined): boolean {
  return !!member?.bannedAt;
}

export async function requireServerMember(userId: string, serverId: string): Promise<void> {
  const server = await prisma.chatServer.findUnique({ where: { id: serverId }, select: { id: true } });
  if (!server) throw NotFound();
  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { bannedAt: true },
  });
  if (!member) throw Forbidden('Not a member of this server');
  if (member.bannedAt) throw Forbidden('Banned from this server');
}

export async function isServerMember(userId: string, serverId: string): Promise<boolean> {
  const member = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { userId: true, bannedAt: true },
  });
  return !!member && !member.bannedAt;
}

/** Fields applied when a user newly joins a server. */
export async function serverMemberJoinFields(serverId: string): Promise<{ mustChangePassword: boolean }> {
  const server = await prisma.chatServer.findUnique({
    where: { id: serverId },
    select: { requirePasswordChangeOnJoin: true },
  });
  return { mustChangePassword: server?.requirePasswordChangeOnJoin ?? false };
}

export type AddMemberResult = 'added' | 'unbanned' | 'existing';

/**
 * Adds a user to a server (or lifts a server ban). `roleId` replaces their
 * server role; without it new members get the default role and existing
 * members keep theirs.
 */
export async function addUserToServer(
  userId: string,
  serverId: string,
  roleId?: string | null,
): Promise<AddMemberResult> {
  const existing = await prisma.serverMember.findUnique({
    where: { userId_serverId: { userId, serverId } },
    select: { bannedAt: true },
  });
  let result: AddMemberResult = 'existing';
  if (!existing) {
    const joinFields = await serverMemberJoinFields(serverId);
    await prisma.serverMember.create({ data: { userId, serverId, ...joinFields } });
    result = 'added';
  } else if (existing.bannedAt) {
    await prisma.serverMember.update({
      where: { userId_serverId: { userId, serverId } },
      data: { bannedAt: null, bannedById: null, banReason: null },
    });
    result = 'unbanned';
  }
  if (roleId || result === 'added') {
    await assignServerRoleToMember(userId, serverId, roleId);
  }
  if (result !== 'existing') syncUserSocketsWithServer(userId, serverId, true);
  return result;
}

/** Removes a membership together with server roles and team seat. */
export async function removeUserFromServer(userId: string, serverId: string): Promise<boolean> {
  const { count } = await prisma.serverMember.deleteMany({ where: { userId, serverId } });
  if (count === 0) return false;
  await prisma.memberServerRole.deleteMany({ where: { userId, serverId } });
  await prisma.serverTeamMember.deleteMany({ where: { userId, serverId } });
  syncUserSocketsWithServer(userId, serverId, false);
  return true;
}

/** Joins every server flagged `autoJoinNewUsers`. */
export async function joinAutoJoinServers(userId: string): Promise<number> {
  const servers = await prisma.chatServer.findMany({
    where: { autoJoinNewUsers: true },
    select: { id: true },
  });
  let joined = 0;
  for (const s of servers) {
    const exists = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId, serverId: s.id } },
      select: { userId: true },
    });
    if (exists) continue;
    await addUserToServer(userId, s.id);
    joined += 1;
  }
  return joined;
}

function syncUserSocketsWithServer(userId: string, serverId: string, joined: boolean) {
  try {
    const io = getIO();
    const sockets = io.in(room.user(userId));
    if (joined) sockets.socketsJoin(room.server(serverId));
    else sockets.socketsLeave(room.server(serverId));
    io.to(room.user(userId)).emit('servers:refresh');
  } catch (err) {
    logger.warn({ err }, 'server membership socket sync failed');
  }
}
