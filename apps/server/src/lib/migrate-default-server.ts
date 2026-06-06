import { prisma } from '../prisma.js';
import { logger } from './logger.js';

const DEFAULT_SLUG = 'sydt-26';
const DEFAULT_NAME = 'SYDT 26';

export async function ensureDefaultChatServer(): Promise<string> {
  let server = await prisma.chatServer.findUnique({ where: { slug: DEFAULT_SLUG } });
  if (!server) {
    server = await prisma.chatServer.create({
      data: { name: DEFAULT_NAME, slug: DEFAULT_SLUG, position: 0 },
    });
    logger.info({ serverId: server.id }, 'Created default chat server SYDT 26');
  }

  await prisma.category.updateMany({
    where: { serverId: null },
    data: { serverId: server.id },
  });
  await prisma.channel.updateMany({
    where: { serverId: null, NOT: { type: 'DIRECT_MESSAGE' } },
    data: { serverId: server.id },
  });

  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    await prisma.serverMember.upsert({
      where: { userId_serverId: { userId: u.id, serverId: server.id } },
      create: { userId: u.id, serverId: server.id },
      update: {},
    });
  }

  const allTeams = await prisma.team.findMany({ select: { id: true, serverId: true } });
  for (const t of allTeams) {
    if (t.serverId !== server.id) {
      await prisma.team.update({ where: { id: t.id }, data: { serverId: server.id } });
    }
  }

  const usersWithTeam = await prisma.user.findMany({
    where: { teamId: { not: null } },
    select: { id: true, teamId: true },
  });
  for (const u of usersWithTeam) {
    if (!u.teamId) continue;
    const team = await prisma.team.findUnique({ where: { id: u.teamId }, select: { serverId: true } });
    const sid = team?.serverId ?? server.id;
    await prisma.serverTeamMember.upsert({
      where: { userId_serverId: { userId: u.id, serverId: sid } },
      create: { userId: u.id, serverId: sid, teamId: u.teamId },
      update: { teamId: u.teamId },
    });
  }

  const { ensureServerDefaultRole } = await import('./ensure-server-default-role.js');
  const { assignDefaultRoleToMember } = await import('./assign-default-server-role.js');
  const allServers = await prisma.chatServer.findMany({ select: { id: true } });
  for (const s of allServers) {
    await ensureServerDefaultRole(s.id);
    const members = await prisma.serverMember.findMany({
      where: { serverId: s.id },
      select: { userId: true },
    });
    for (const m of members) {
      await assignDefaultRoleToMember(m.userId, s.id).catch(() => undefined);
    }
  }

  return server.id;
}
