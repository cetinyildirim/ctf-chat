import { prisma } from '../prisma.js';

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRefreshTokensForUsers(userIds: string[]): Promise<void> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  await prisma.refreshToken.updateMany({
    where: { userId: { in: ids }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

type AuthProfile = { role: string; platformRole: string | null; isBanned: boolean };

/** Invalidate refresh tokens when platform auth profile materially changes. */
export async function revokeSessionsIfAuthProfileChanged(
  userId: string,
  before: AuthProfile,
  after: AuthProfile,
): Promise<void> {
  const roleChanged = before.role !== after.role || before.platformRole !== after.platformRole;
  const banned = !before.isBanned && after.isBanned;
  if (roleChanged || banned) {
    await revokeAllRefreshTokens(userId);
  }
}
