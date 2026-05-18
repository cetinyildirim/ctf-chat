import type { Role } from '@sydt/shared';
import { isStaff } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { NotFound, Forbidden } from '../../lib/http-error.js';

export async function loadChannel(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { category: true },
  });
  if (!channel) throw NotFound('Channel not found');
  return channel;
}

export async function assertCanAccessChannel(
  channel: Awaited<ReturnType<typeof loadChannel>>,
  user: { id: string; role: Role; teamId: string | null },
): Promise<void> {
  if (channel.type === 'DIRECT_MESSAGE') {
    const p = await prisma.channelDmParticipant.findUnique({
      where: { channelId_userId: { channelId: channel.id, userId: user.id } },
    });
    if (!p) throw Forbidden('Not allowed');
    return;
  }

  const staff = isStaff(user.role);
  const staffOnlyType =
    channel.type === 'STAFF_COORD' ||
    channel.type === 'ORGANIZER_INTERNAL' ||
    channel.type === 'LOGS' ||
    channel.type === 'INCIDENT';
  if (staffOnlyType && !staff) throw Forbidden();
  if (channel.category?.staffOnly && !staff) throw Forbidden();
  if (channel.isPrivate) {
    if (staff) return;
    if (channel.teamId && channel.teamId === user.teamId) return;
    throw Forbidden();
  }
}
