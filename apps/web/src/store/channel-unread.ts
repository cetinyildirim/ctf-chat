import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UnreadMap = Record<string, true>;

type State = {
  /** Active session user — unread maps are keyed by this id. */
  userId: string | null;
  byUser: Record<string, UnreadMap>;
  setUserId: (userId: string | null) => void;
  /** Convenience view of the active user's unread channels. */
  unreadByChannel: UnreadMap;
  markUnread: (channelId: string) => void;
  markRead: (channelId: string) => void;
  hasUnread: (channelId: string) => boolean;
  clearForUser: (userId: string) => void;
};

function mapFor(byUser: Record<string, UnreadMap>, userId: string | null): UnreadMap {
  if (!userId) return {};
  return byUser[userId] ?? {};
}

/**
 * Channel unread is durable in localStorage per user (survives reload).
 * Distinct from server TicketRead / notification inbox.
 */
export const useChannelUnreadStore = create<State>()(
  persist(
    (set, get) => ({
      userId: null,
      byUser: {},
      unreadByChannel: {},
      setUserId: (userId) =>
        set((s) => ({
          userId,
          unreadByChannel: mapFor(s.byUser, userId),
        })),
      markUnread: (channelId) => {
        const userId = get().userId;
        if (!userId) return;
        set((s) => {
          const current = s.byUser[userId] ?? {};
          if (current[channelId]) return s;
          const nextUser = { ...current, [channelId]: true as const };
          const byUser = { ...s.byUser, [userId]: nextUser };
          return { byUser, unreadByChannel: nextUser };
        });
      },
      markRead: (channelId) => {
        const userId = get().userId;
        if (!userId) return;
        set((s) => {
          const current = s.byUser[userId] ?? {};
          if (!current[channelId]) return s;
          const nextUser = { ...current };
          delete nextUser[channelId];
          const byUser = { ...s.byUser, [userId]: nextUser };
          return { byUser, unreadByChannel: nextUser };
        });
      },
      hasUnread: (channelId) => !!get().unreadByChannel[channelId],
      clearForUser: (userId) =>
        set((s) => {
          if (!s.byUser[userId]) return s;
          const byUser = { ...s.byUser };
          delete byUser[userId];
          return {
            byUser,
            unreadByChannel: s.userId === userId ? {} : s.unreadByChannel,
          };
        }),
    }),
    {
      name: 'sydt-channel-unread-v1',
      partialize: (s) => ({ byUser: s.byUser }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.unreadByChannel = mapFor(state.byUser, state.userId);
      },
    },
  ),
);
