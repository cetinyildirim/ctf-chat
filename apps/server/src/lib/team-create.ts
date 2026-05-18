import crypto from 'node:crypto';
import { Role } from '@sydt/shared';
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
  data: { name: string; tagline?: string | null; color?: string },
) {
  const slugBase = slugifyTeamName(data.name);
  let slug = slugBase || 'team';
  let n = 0;
  while (await prisma.team.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${++n}`;
  }
  const inviteCode = `INV-${(slugBase || 'team').slice(0, 6).toUpperCase().replace(/-/g, 'X')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const team = await prisma.team.create({
    data: {
      name: data.name.trim(),
      slug,
      tagline: data.tagline?.trim() ? data.tagline.trim() : null,
      color: data.color ?? '#22d3ee',
      inviteCode,
    },
    include: { _count: { select: { members: true } } },
  });
  await provisionTeamRoomsForTeamInCategories(prisma, { id: team.id, name: team.name });
  return team;
}

export async function assignUserAsTeamCaptain(
  prisma: PrismaClient,
  teamId: string,
  userId: string,
) {
  await prisma.user.update({
    where: { id: userId },
    data: { teamId, role: Role.TEAM_CAPTAIN },
  });
  await prisma.team.update({
    where: { id: teamId },
    data: { captainId: userId },
  });
}
