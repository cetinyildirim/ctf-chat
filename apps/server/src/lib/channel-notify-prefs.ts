import { resolveEffectiveNotify, type EffectiveChannelNotify } from '@sydt/shared';
import { prisma } from '../prisma.js';

export async function effectiveNotifyModes(
  channelId: string,
  userIds: string[],
): Promise<Map<string, EffectiveChannelNotify>> {
  const out = new Map<string, EffectiveChannelNotify>();
  if (userIds.length === 0) return out;

  const [prefs, users] = await Promise.all([
    prisma.userChannelPreference.findMany({
      where: { channelId, userId: { in: userIds } },
    }),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, notifyDefault: true },
    }),
    ]);
  const prefByUser = new Map(prefs.map((p) => [p.userId, p.notifyMode]));
  const defaults = new Map(users.map((u) => [u.id, u.notifyDefault]));

  for (const uid of userIds) {
    const stored = prefByUser.get(uid);
    const acc = defaults.get(uid) ?? 'ALL';
    out.set(uid, resolveEffectiveNotify(stored, acc));
  }
  return out;
}
