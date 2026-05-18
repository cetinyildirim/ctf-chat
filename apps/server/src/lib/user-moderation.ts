import { prisma } from '../prisma.js';
import { Forbidden } from './http-error.js';

export async function assertUserCanUsePlatform(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBanned: true, mutedUntil: true },
  });
  if (!user) return;
  if (user.isBanned) {
    throw Forbidden('Your account is suspended');
  }
  if (user.mutedUntil && user.mutedUntil.getTime() > Date.now()) {
    throw Forbidden('You are temporarily muted');
  }
}
