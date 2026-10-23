import crypto from 'node:crypto';
import { prisma } from '../../prisma.js';
import { canUsersDirectMessageOnSharedTeam } from '../../lib/direct-message-rules.js';
import { BadRequest } from '../../lib/http-error.js';
import { emitChannelsRefreshToUsers } from '../../realtime/broadcasters.js';

function dmSlugForPair(userIdA: string, userIdB: string): string {
  const [lo, hi] = [userIdA, userIdB].sort();
  const h = crypto.createHash('sha256').update(`${lo}:${hi}`).digest('hex').slice(0, 28);
  return `dm-${h}`;
}

async function loadUserLite(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, teamId: true },
  });
}

/** Find DM channel strictly between exactly these two users, or create it. */
export async function ensureDirectChannel(actorId: string, peerId: string) {
  if (actorId === peerId) throw BadRequest('Cannot message yourself');

  const [actor, peer] = await Promise.all([loadUserLite(actorId), loadUserLite(peerId)]);
  if (!actor || !peer) throw BadRequest('User not found');

  if (!(await canUsersDirectMessageOnSharedTeam(actorId, peerId))) {
    throw BadRequest('Direct messages require a shared server');
  }

  const candidates = await prisma.channel.findMany({
    where: {
      type: 'DIRECT_MESSAGE',
      dmParticipants: { some: { userId: actorId } },
    },
    include: { dmParticipants: true },
  });
  const match = candidates.find(
    (c) =>
      c.dmParticipants.length === 2 &&
      c.dmParticipants.some((p) => p.userId === peerId),
  );
  if (match) return match.id;

  const slug = dmSlugForPair(actorId, peerId);
  const dup = await prisma.channel.findUnique({ where: { slug } });
  if (dup?.type === 'DIRECT_MESSAGE') {
    const pp = await prisma.channelDmParticipant.findMany({ where: { channelId: dup.id } });
    if (
      pp.length === 2 &&
      pp.some((x) => x.userId === actorId) &&
      pp.some((x) => x.userId === peerId)
    )
      return dup.id;
    throw BadRequest('DM slot conflict — contact admin');
  }

  const chan = await prisma.$transaction(async (tx) => {
    const channel = await tx.channel.create({
      data: {
        slug,
        name: 'Direct',
        type: 'DIRECT_MESSAGE',
        isPrivate: true,
        position: Math.floor(Date.now() / 1000) % 100000,
        dmParticipants: {
          create: [{ userId: actorId }, { userId: peerId }],
        },
      },
    });
    return channel;
  });

  emitChannelsRefreshToUsers([actorId, peerId]);
  return chan.id;
}

/** Admin mass-DM: bypass team DM rules between staff broadcast and any user. */
export async function ensureDirectChannelForBroadcast(actorId: string, peerId: string) {
  if (actorId === peerId) throw BadRequest('Cannot message yourself');
  const peer = await loadUserLite(peerId);
  if (!peer) throw BadRequest('User not found');

  const candidates = await prisma.channel.findMany({
    where: {
      type: 'DIRECT_MESSAGE',
      dmParticipants: { some: { userId: actorId } },
    },
    include: { dmParticipants: true },
  });
  const match = candidates.find(
    (c) =>
      c.dmParticipants.length === 2 &&
      c.dmParticipants.some((p) => p.userId === peerId),
  );
  if (match) return match.id;

  const slug = dmSlugForPair(actorId, peerId);
  const dup = await prisma.channel.findUnique({ where: { slug } });
  if (dup?.type === 'DIRECT_MESSAGE') {
    const pp = await prisma.channelDmParticipant.findMany({ where: { channelId: dup.id } });
    if (
      pp.length === 2 &&
      pp.some((x) => x.userId === actorId) &&
      pp.some((x) => x.userId === peerId)
    )
      return dup.id;
    throw BadRequest('DM slot conflict — contact admin');
  }

  const chan = await prisma.$transaction(async (tx) => {
    return tx.channel.create({
      data: {
        slug,
        name: 'Direct',
        type: 'DIRECT_MESSAGE',
        isPrivate: true,
        position: Math.floor(Date.now() / 1000) % 100000,
        dmParticipants: {
          create: [{ userId: actorId }, { userId: peerId }],
        },
      },
    });
  });

  emitChannelsRefreshToUsers([actorId, peerId]);
  return chan.id;
}
