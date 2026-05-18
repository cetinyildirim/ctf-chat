import type { UserStatus } from '@sydt/shared';
import { usePresenceStore } from '@/store/presence';

export function useLivePresence(userId: string | undefined, fallback?: UserStatus | string): UserStatus {
  const live = usePresenceStore((s) => (userId ? s.presences[userId]?.status : undefined));
  return (live ?? fallback ?? 'OFFLINE') as UserStatus;
}
