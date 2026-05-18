import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Notification {
  id: string;
  kind: 'mention' | 'announcement' | 'ticket' | 'incident' | 'system';
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  read: boolean;
}

interface NotificationState {
  items: Notification[];
  unreadCount: number;
  soundEnabled: boolean;
  dnd: boolean;
  push: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setDnd: (dnd: boolean) => void;
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
          const items = [item, ...s.items].slice(0, 50);
          return { items, unreadCount: items.filter((i) => !i.read).length };
        }),
      markAllRead: () =>
        set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })), unreadCount: 0 })),
      remove: (id) =>
        set((s) => {
          const items = s.items.filter((i) => i.id !== id);
          return { items, unreadCount: items.filter((i) => !i.read).length };
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
