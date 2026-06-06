import { type PrismaClient, type Prisma } from '@prisma/client';
import { ChannelType } from '@sydt/shared';

type DbClient = PrismaClient | Prisma.TransactionClient;

function slugifySegment(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

/**
 * Ensures each team has a private TEAM_PRIVATE channel under the category.
 * Visible to that team's members plus staff via existing isPrivate rules. Idempotent.
 */
export async function provisionTeamRoomsForCategory(db: DbClient, category: { id: string; name: string; staffOnly: boolean }) {
  if (category.staffOnly) return;

  const catServerId =
    (
      await db.category.findUnique({
        where: { id: category.id },
        select: { serverId: true },
      })
    )?.serverId ?? null;
  const teams = await db.team.findMany({
    where: catServerId ? { serverId: catServerId } : undefined,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  let nextPos =
    (
      await db.channel.findFirst({
        where: { categoryId: category.id },
        orderBy: { position: 'desc' },
        select: { position: true },
      })
    )?.position ?? 0;
  nextPos += 1;

  for (const team of teams) {
    const existing = await db.channel.findFirst({
      where: { categoryId: category.id, teamId: team.id, type: ChannelType.TEAM_PRIVATE },
    });
    if (existing) continue;

    const slugBase = `${slugifySegment(team.name)}-${team.id.slice(-6)}-${category.id.slice(-4)}`;
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

    await db.channel.create({
      data: {
        name: team.name,
        slug,
        type: ChannelType.TEAM_PRIVATE,
        topic: `${category.name} · ${team.name}`,
        categoryId: category.id,
        isPrivate: true,
        teamId: team.id,
        position: nextPos,
      },
    });
    nextPos += 1;
  }
}

/** After creating a single team via admin: add TEAM_PRIVATE slots for all non-staff categories on the same server. */
export async function provisionTeamRoomsForTeamInCategories(
  db: DbClient,
  team: { id: string; name: string; serverId: string },
) {
  const cats = await db.category.findMany({
    where: { staffOnly: false, serverId: team.serverId },
  });
  for (const category of cats) {
    let nextPos =
      (
        await db.channel.findFirst({
          where: { categoryId: category.id },
          orderBy: { position: 'desc' },
          select: { position: true },
        })
      )?.position ?? 0;
    nextPos += 1;

    const existing = await db.channel.findFirst({
      where: { categoryId: category.id, teamId: team.id, type: ChannelType.TEAM_PRIVATE },
    });
    if (existing) continue;

    const slugBase = `${slugifySegment(team.name)}-${team.id.slice(-6)}-${category.id.slice(-4)}`;
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

    await db.channel.create({
      data: {
        name: team.name,
        slug,
        type: ChannelType.TEAM_PRIVATE,
        topic: `${category.name} · ${team.name}`,
        categoryId: category.id,
        isPrivate: true,
        teamId: team.id,
        position: nextPos,
      },
    });
  }
}

export async function provisionTeamRoomsForNonStaffCategories(prisma: PrismaClient) {
  const cats = await prisma.category.findMany({ where: { staffOnly: false } });
  for (const cat of cats) {
    await provisionTeamRoomsForCategory(prisma, cat);
  }
}
