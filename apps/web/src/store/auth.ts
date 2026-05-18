import { create } from 'zustand';
import type { SessionUser } from '@sydt/shared';

interface AuthState {
  user: SessionUser | null;
  ready: boolean;
  setUser: (user: SessionUser | null) => void;
  setReady: (ready: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
  clear: () => set({ user: null }),
}));
