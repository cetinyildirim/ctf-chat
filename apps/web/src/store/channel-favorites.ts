import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FavoriteKind = 'category' | 'channel';

type Favorites = { categories: string[]; channels: string[] };

type State = {
  byUser: Record<string, Favorites>;
  toggle: (userId: string, kind: FavoriteKind, id: string) => void;
};

const EMPTY: Favorites = { categories: [], channels: [] };

/** Sidebar favorites are a per-user, per-browser preference (localStorage). */
export const useChannelFavoritesStore = create<State>()(
  persist(
    (set) => ({
      byUser: {},
      toggle: (userId, kind, id) =>
        set((s) => {
          const current = s.byUser[userId] ?? EMPTY;
          const key = kind === 'category' ? 'categories' : 'channels';
          const list = current[key];
          const nextList = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
          return { byUser: { ...s.byUser, [userId]: { ...current, [key]: nextList } } };
        }),
    }),
    { name: 'sydt-channel-favorites-v1' },
  ),
);

export function useUserFavorites(userId: string | null | undefined): Favorites {
  return useChannelFavoritesStore((s) => (userId ? s.byUser[userId] : undefined) ?? EMPTY);
}
