import { prisma } from '../prisma.js';
import { logger } from './logger.js';

const DEFAULT_SLUG = 'sydt-26';
const DEFAULT_NAME = 'SYDT 26';

/**
 * Cheap lookup for the competition open registration should land on.
 * Prefers the admin-configured server, then `sydt-26`, then the first server.
 * Does not run the legacy backfill in `ensureDefaultChatServer`.
 */
export async function resolveHomeServerId(): Promise<string> {
  try {
    const config = await prisma.appConfig.findUnique({
      where: { id: 'default' },
      select: { defaultRegistrationServerId: true },
    });
    if (config?.defaultRegistrationServerId) {
      const configured = await prisma.chatServer.findUnique({
        where: { id: config.defaultRegistrationServerId },
        select: { id: true },
      });
      if (configured) return configured.id;
    }
  } catch {
    // Column may not exist yet during a rolling migrate; fall through.
  }

  const preferred = await prisma.chatServer.findUnique({ where: { slug: DEFAULT_SLUG } });
  if (preferred) return preferred.id;

  const first = await prisma.chatServer.findFirst({ orderBy: { position: 'asc' } });
  if (first) return first.id;

  const created = await prisma.chatServer.create({
    data: { name: DEFAULT_NAME, slug: DEFAULT_SLUG, position: 0 },
  });
  logger.info({ serverId: created.id }, 'Created default chat server SYDT 26');
  const { ensureServerDefaultRole } = await import('./ensure-server-default-role.js');
  const { ensureCompetitionDefaults } = await import('./ticket-defaults.js');
  await ensureServerDefaultRole(created.id);
  await ensureCompetitionDefaults(created.id);
  return created.id;
}

/**
 * Places a user on the home competition when they have no active membership.
 * Used by register/login/session bootstrap so open sign-up is never stranded.
 */
export async function ensureUserHasHomeServer(userId: string): Promise<string | null> {
  const existing = await prisma.serverMember.findFirst({
    where: { userId, bannedAt: null },
    select: { serverId: true },
  });
  if (existing) return existing.serverId;

  const serverId = await resolveHomeServerId();
  const { serverMemberJoinFields } = await import('./server-membership.js');
  const { assignDefaultRoleToMember } = await import('./assign-default-server-role.js');
  const joinFields = await serverMemberJoinFields(serverId);
  await prisma.serverMember.upsert({
    where: { userId_serverId: { userId, serverId } },
    create: { userId, serverId, ...joinFields },
    update: { bannedAt: null },
  });
  await assignDefaultRoleToMember(userId, serverId);
  return serverId;
}

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
    if (t.serverId == null) {
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
  const { ensureCompetitionDefaults } = await import('./ticket-defaults.js');
  const allServers = await prisma.chatServer.findMany({ select: { id: true } });
  for (const s of allServers) {
    await ensureServerDefaultRole(s.id);
    await ensureCompetitionDefaults(s.id);
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

/** Backfill Incident.serverId from linked channel when missing. */
export async function backfillIncidentServerIds(): Promise<number> {
  const orphaned = await prisma.incident.findMany({
    where: { serverId: null, channelId: { not: null } },
    select: { id: true, channelId: true },
  });
  let updated = 0;
  for (const row of orphaned) {
    if (!row.channelId) continue;
    const channel = await prisma.channel.findUnique({
      where: { id: row.channelId },
      select: { serverId: true },
    });
    if (!channel?.serverId) continue;
    await prisma.incident.update({
      where: { id: row.id },
      data: { serverId: channel.serverId },
    });
    updated += 1;
  }
  if (updated > 0) logger.info({ updated }, 'Backfilled incident serverId from channels');
  return updated;
}
