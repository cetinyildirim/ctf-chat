import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Notification {
  id: string;
  kind: 'mention' | 'announcement' | 'ticket' | 'incident' | 'system';
  title: string;
  body: string;
  href?: string;
  refId?: string;
  createdAt: string;
  read: boolean;
  /** True when the row exists server-side and can be marked read through the API. */
  remote?: boolean;
}

interface NotificationState {
  items: Notification[];
  unreadCount: number;
  soundEnabled: boolean;
  dnd: boolean;
  push: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  /** Inserts a server-backed notification, keyed by its database id. */
  pushRemote: (n: Notification, serverUnreadCount?: number) => void;
  /** Replaces the inbox with the server's copy (page 1). */
  hydrate: (items: Notification[]) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  remove: (id: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setDnd: (dnd: boolean) => void;
}

const MAX_ITEMS = 50;

function countUnread(items: Notification[]): number {
  return items.filter((i) => !i.read).length;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      items: [],
      unreadCount: 0,
      soundEnabled: true,
      dnd: false,
      push: (n) =>
        set((s) => {
          const id =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2);
          const item: Notification = {
            ...n,
            id,
            createdAt: new Date().toISOString(),
            read: false,
          };
          const items = [item, ...s.items].slice(0, MAX_ITEMS);
          return { items, unreadCount: countUnread(items) };
        }),
      pushRemote: (n, serverUnreadCount) =>
        set((s) => {
          // The socket event and a refetch can both deliver the same row.
          if (s.items.some((i) => i.id === n.id)) {
            if (serverUnreadCount != null) {
              return { ...s, unreadCount: serverUnreadCount };
            }
            return s;
          }
          const items = [{ ...n, remote: true }, ...s.items].slice(0, MAX_ITEMS);
          return {
            items,
            unreadCount:
              serverUnreadCount ?? countUnread(items),
          };
        }),
      hydrate: (incoming) =>
        set((s) => {
          // Local-only entries (mentions, toasts) survive a hydrate.
          const local = s.items.filter((i) => !i.remote);
          const items = [...incoming.map((i) => ({ ...i, remote: true })), ...local]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, MAX_ITEMS);
          return { items, unreadCount: countUnread(items) };
        }),
      markAllRead: () =>
        set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })), unreadCount: 0 })),
      markRead: (id) =>
        set((s) => {
          const items = s.items.map((i) => (i.id === id ? { ...i, read: true } : i));
          return { items, unreadCount: countUnread(items) };
        }),
      remove: (id) =>
        set((s) => {
          const items = s.items.filter((i) => i.id !== id);
          return { items, unreadCount: countUnread(items) };
        }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
      setDnd: (dnd) => set({ dnd }),
    }),
    {
      name: 'sydt-notification-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        soundEnabled: s.soundEnabled,
        dnd: s.dnd,
      }),
      version: 1,
    },
  ),
);
