import { FriendshipStatus } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { NotFound } from '../../lib/http-error.js';
import { serializeUser } from '../serializers.js';
import { snapshot } from '../../realtime/presence.js';

async function friendIdsFor(userId: string): Promise<Set<string>> {
  const rows = await prisma.friendship.findMany({
    where: {
      status: FriendshipStatus.ACCEPTED,
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.requesterId === userId ? r.addresseeId : r.requesterId);
  }
  return ids;
}

export async function buildUserProfileCard(viewerId: string, targetUserId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { team: true },
  });
  if (!target) throw NotFound('User not found');

  const viewerFriends = await friendIdsFor(viewerId);
  const targetFriends = await friendIdsFor(targetUserId);
  const mutualIds = [...targetFriends].filter((id) => viewerFriends.has(id) && id !== viewerId);

  const mutualUsers =
    mutualIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: mutualIds.slice(0, 50) } },
          include: { team: true },
          orderBy: { displayName: 'asc' },
        })
      : [];

  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { teamId: true },
  });

  let sharedChannels: { id: string; name: string; type: string }[] = [];
  if (viewer?.teamId && target.teamId && viewer.teamId === target.teamId) {
    const teamChannels = await prisma.channel.findMany({
      where: { teamId: viewer.teamId, type: 'TEAM_PRIVATE' },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
      take: 30,
    });
    sharedChannels = teamChannels;
  }

  const publicChannels = await prisma.channel.findMany({
    where: {
      type: { in: ['GLOBAL_CHAT', 'ANNOUNCEMENT', 'CHALLENGE'] },
      isPrivate: false,
    },
    select: { id: true, name: true, type: true },
    orderBy: { name: 'asc' },
    take: 20,
  });

  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: viewerId, addresseeId: targetUserId },
        { requesterId: targetUserId, addresseeId: viewerId },
      ],
    },
  });

  const presences = snapshot();
  const presence = presences.find((p) => p.userId === targetUserId);

  return {
    user: serializeUser(target),
    bio: target.bio,
    createdAt: target.createdAt.toISOString(),
    presenceStatus: presence?.status ?? target.status ?? 'OFFLINE',
    friendship: friendship
      ? {
          id: friendship.id,
          status: friendship.status,
          isIncoming: friendship.addresseeId === viewerId,
          isOutgoing: friendship.requesterId === viewerId,
        }
      : null,
    mutualFriends: mutualUsers.map(serializeUser),
    sharedTeam:
      viewer?.teamId && target.teamId && viewer.teamId === target.teamId && target.team
        ? { id: target.team.id, name: target.team.name, color: target.team.color }
        : null,
    teamChannels: sharedChannels,
    platformChannels: publicChannels,
    isSelf: viewerId === targetUserId,
  };
}
