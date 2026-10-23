import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const CHANNEL_SIDEBAR_MIN = 272;
export const CHANNEL_SIDEBAR_MAX = 520;
export const CHANNEL_SIDEBAR_DEFAULT = 320;

type State = {
  width: number;
  collapsed: boolean;
  setWidth: (width: number) => void;
  resetWidth: () => void;
  setCollapsed: (collapsed: boolean) => void;
};

export function clampSidebarWidth(width: number): number {
  return Math.min(CHANNEL_SIDEBAR_MAX, Math.max(CHANNEL_SIDEBAR_MIN, Math.round(width)));
}

/** Desktop channel column layout, remembered per browser. */
export const useSidebarLayoutStore = create<State>()(
  persist(
    (set) => ({
      width: CHANNEL_SIDEBAR_DEFAULT,
      collapsed: false,
      setWidth: (width) => set({ width: clampSidebarWidth(width) }),
      resetWidth: () => set({ width: CHANNEL_SIDEBAR_DEFAULT }),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    { name: 'sydt-channel-sidebar-layout-v1' },
  ),
);
