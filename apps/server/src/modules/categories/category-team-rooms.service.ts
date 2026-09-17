import { type PrismaClient, type Prisma } from '@prisma/client';
import { ChannelType } from '@sydt/shared';

type DbClient = PrismaClient | Prisma.TransactionClient;

const GENERAL_CHANNEL_NAME = 'General';

const migratedServers = new Map<string, number>();
const MIGRATE_TTL_MS = 60_000;

function slugifySegment(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

/**
 * Ensures a team has its own private category (named after the team) with a
 * default General channel. Idempotent.
 */
export async function ensureTeamWorkspace(
  db: DbClient,
  team: { id: string; name: string; serverId: string },
) {
  let category = await db.category.findFirst({
    where: { serverId: team.serverId, teamId: team.id },
  });

  if (!category) {
    const maxPos =
      (
        await db.category.findFirst({
          where: { serverId: team.serverId },
          orderBy: { position: 'desc' },
          select: { position: true },
        })
      )?.position ?? 0;

    category = await db.category.create({
      data: {
        name: team.name,
        serverId: team.serverId,
        teamId: team.id,
        staffOnly: false,
        position: maxPos + 1,
      },
    });
  } else if (category.name !== team.name) {
    category = await db.category.update({
      where: { id: category.id },
      data: { name: team.name },
    });
  }

  const existingGeneral = await db.channel.findFirst({
    where: {
      categoryId: category.id,
      teamId: team.id,
      type: ChannelType.TEAM_PRIVATE,
      name: GENERAL_CHANNEL_NAME,
    },
  });
  if (existingGeneral) return { category, channel: existingGeneral };

  const anyInCategory = await db.channel.findFirst({
    where: { categoryId: category.id, teamId: team.id, type: ChannelType.TEAM_PRIVATE },
  });
  if (anyInCategory) return { category, channel: anyInCategory };

  const slug = `${slugifySegment(team.name)}-general-${team.id.slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;
  const channel = await db.channel.create({
    data: {
      name: GENERAL_CHANNEL_NAME,
      slug,
      type: ChannelType.TEAM_PRIVATE,
      topic: `${team.name} · ${GENERAL_CHANNEL_NAME}`,
      categoryId: category.id,
      serverId: team.serverId,
      isPrivate: true,
      teamId: team.id,
      position: 0,
    },
  });

  return { category, channel };
}

/** @deprecated Prefer ensureTeamWorkspace — kept for call-site compatibility. */
export async function provisionTeamRoomsForTeamInCategories(
  db: DbClient,
  team: { id: string; name: string; serverId: string },
) {
  await ensureTeamWorkspace(db, team);
}

/**
 * No-op for challenge/public categories: team rooms live under the team
 * category, not under every competition category.
 */
export async function provisionTeamRoomsForCategory(
  _db: DbClient,
  _category: { id: string; name: string; staffOnly: boolean },
) {
  /* intentionally empty */
}

/** Remove legacy per-category team rooms, then ensure each team has a workspace. */
export async function provisionTeamRoomsForNonStaffCategories(
  prisma: PrismaClient,
  serverId?: string,
) {
  if (serverId) {
    const last = migratedServers.get(serverId) ?? 0;
    if (Date.now() - last < MIGRATE_TTL_MS) return;
    migratedServers.set(serverId, Date.now());
  }

  const legacy = await prisma.channel.findMany({
    where: {
      type: ChannelType.TEAM_PRIVATE,
      ...(serverId ? { serverId } : {}),
    },
    select: { id: true, teamId: true, category: { select: { teamId: true } } },
  });
  const toDelete = legacy
    .filter((ch) => !ch.category?.teamId || ch.category.teamId !== ch.teamId)
    .map((ch) => ch.id);
  if (toDelete.length) {
    await prisma.channel.deleteMany({ where: { id: { in: toDelete } } });
  }

  const teams = await prisma.team.findMany({
    where: serverId ? { serverId } : { serverId: { not: null } },
    select: { id: true, name: true, serverId: true },
  });
  for (const team of teams) {
    if (!team.serverId) continue;
    await ensureTeamWorkspace(prisma, {
      id: team.id,
      name: team.name,
      serverId: team.serverId,
    });
  }
}
