import { TYPING_TTL_MS } from '@sydt/shared';

interface TypingEntry {
  userId: string;
  channelId: string;
  expiresAt: number;
}

const buckets = new Map<string, TypingEntry>();
const key = (channelId: string, userId: string) => `${channelId}:${userId}`;

export function startTyping(channelId: string, userId: string): boolean {
  const k = key(channelId, userId);
  const existing = buckets.get(k);
  const expiresAt = Date.now() + TYPING_TTL_MS;
  buckets.set(k, { channelId, userId, expiresAt });
  return !existing || existing.expiresAt < Date.now();
}

export function stopTyping(channelId: string, userId: string): boolean {
  return buckets.delete(key(channelId, userId));
}

export function listTyping(channelId: string): string[] {
  const now = Date.now();
  const userIds: string[] = [];
  for (const [k, entry] of buckets) {
    if (entry.channelId !== channelId) continue;
    if (entry.expiresAt < now) {
      buckets.delete(k);
      continue;
    }
    userIds.push(entry.userId);
  }
  return userIds;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, entry] of buckets) {
    if (entry.expiresAt < now) buckets.delete(k);
  }
}, 5_000).unref?.();
