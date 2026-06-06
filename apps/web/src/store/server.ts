import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type State = {
  activeServerId: string | null;
  setActiveServerId: (id: string | null) => void;
  settingsServerId: string | null;
  setSettingsServerId: (id: string | null) => void;
};

export const useServerStore = create<State>()(
  persist(
    (set) => ({
      activeServerId: null,
      setActiveServerId: (id) => set({ activeServerId: id }),
      settingsServerId: null,
      setSettingsServerId: (id) => set({ settingsServerId: id }),
    }),
    { name: 'sydt-active-server', partialize: (s) => ({ activeServerId: s.activeServerId }) },
  ),
);
