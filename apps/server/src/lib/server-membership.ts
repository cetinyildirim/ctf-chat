import { prisma } from '../prisma.js';
import { Forbidden, NotFound } from './http-error.js';

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
