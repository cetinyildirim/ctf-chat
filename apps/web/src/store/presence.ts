import { create } from 'zustand';
import { TYPING_TTL_MS, type UserStatus } from '@sydt/shared';

/** A lost typing:stop must never leave "is typing" stuck on screen. */
const typingExpiry = new Map<string, ReturnType<typeof setTimeout>>();

export interface Presence {
  status: UserStatus;
  lastSeen: string;
}

interface PresenceState {
  presences: Record<string, Presence>;
  typingByChannel: Record<string, Set<string>>;
  setPresences: (entries: Array<{ userId: string; status: UserStatus; lastSeen: string }>) => void;
  upsertPresence: (userId: string, status: UserStatus, lastSeen: string) => void;
  setTyping: (channelId: string, userId: string, isTyping: boolean) => void;
  isOnline: (userId: string) => boolean;
  typingUsers: (channelId: string) => string[];
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  presences: {},
  typingByChannel: {},
  setPresences: (entries) =>
    set((s) => {
      const next = { ...s.presences };
      for (const e of entries) next[e.userId] = { status: e.status, lastSeen: e.lastSeen };
      return { presences: next };
    }),
  upsertPresence: (userId, status, lastSeen) =>
    set((s) => ({ presences: { ...s.presences, [userId]: { status, lastSeen } } })),
  setTyping: (channelId, userId, isTyping) => {
    const timerKey = `${channelId}:${userId}`;
    const pending = typingExpiry.get(timerKey);
    if (pending) clearTimeout(pending);
    typingExpiry.delete(timerKey);
    if (isTyping) {
      typingExpiry.set(
        timerKey,
        setTimeout(() => get().setTyping(channelId, userId, false), TYPING_TTL_MS),
      );
    }
    set((s) => {
      const prev = s.typingByChannel[channelId];
      const already = prev?.has(userId) ?? false;
      if (isTyping === already) return s;
      const current = new Set(prev ?? []);
      if (isTyping) current.add(userId);
      else current.delete(userId);
      return { typingByChannel: { ...s.typingByChannel, [channelId]: current } };
    });
  },
  isOnline: (userId) => {
    const p = get().presences[userId];
    return !!p && p.status !== 'OFFLINE';
  },
  typingUsers: (channelId) => Array.from(get().typingByChannel[channelId] ?? []),
}));
