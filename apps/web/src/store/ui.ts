import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  channelsDrawerOpen: boolean;
  rightPanel: 'members' | 'pinned' | 'challenge' | 'ticket' | 'hidden';
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  setChannelsDrawerOpen: (open: boolean) => void;
  setRightPanel: (panel: UIState['rightPanel']) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  commandOpen: false,
  channelsDrawerOpen: false,
  rightPanel: 'members',
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setChannelsDrawerOpen: (open) => set({ channelsDrawerOpen: open }),
  setRightPanel: (panel) => set({ rightPanel: panel }),
}));