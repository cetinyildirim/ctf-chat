import { prisma } from '../prisma.js';
import { Forbidden, HttpError } from './http-error.js';

export async function assertUserCanUsePlatform(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBanned: true, mutedUntil: true, muteReason: true },
  });
  if (!user) return;
  if (user.isBanned) {
    throw Forbidden('Your account is suspended');
  }
  if (user.mutedUntil && user.mutedUntil.getTime() > Date.now()) {
    throw new HttpError(403, 'You are temporarily muted', 'USER_MUTED', {
      until: user.mutedUntil.toISOString(),
      reason: user.muteReason,
    });
  }
}
