import { create } from 'zustand';

type State = {
  userId: string | null;
  open: (userId: string) => void;
  close: () => void;
};

export const useUserProfileStore = create<State>((set) => ({
  userId: null,
  open: (userId) => set({ userId }),
  close: () => set({ userId: null }),
}));
