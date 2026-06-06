import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { provisionTeamRoomsForTeamInCategories } from '../modules/categories/category-team-rooms.service.js';

export function slugifyTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export async function createTeamWithSlug(
  prisma: PrismaClient,
  data: { serverId: string; name: string; tagline?: string | null; color?: string },
) {
  const slugBase = slugifyTeamName(data.name);
  let slug = slugBase || 'team';
  let n = 0;
  while (await prisma.team.findFirst({ where: { serverId: data.serverId, slug } })) {
    slug = `${slugBase}-${++n}`;
  }
  const inviteCode = `INV-${(slugBase || 'team').slice(0, 6).toUpperCase().replace(/-/g, 'X')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const team = await prisma.team.create({
    data: {
      serverId: data.serverId,
      name: data.name.trim(),
      slug,
      tagline: data.tagline?.trim() ? data.tagline.trim() : null,
      color: data.color ?? '#22d3ee',
      inviteCode,
    },
    include: { _count: { select: { members: true } } },
  });
  await provisionTeamRoomsForTeamInCategories(prisma, {
    id: team.id,
    name: team.name,
    serverId: data.serverId,
  });
  return team;
}

export async function assignUserAsTeamCaptain(
  prisma: PrismaClient,
  teamId: string,
  userId: string,
  serverId: string,
) {
  const { assignUserToServerTeam } = await import('./team-membership.js');
  await assignUserToServerTeam(prisma, { userId, serverId, teamId, asCaptain: true });
}
