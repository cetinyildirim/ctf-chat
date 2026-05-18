'use client';

import * as React from 'react';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/store/auth';

const GUEST_THEME_KEY = 'sydt-theme';

export type ThemeChoice = 'light' | 'dark';

export function readStoredGuestTheme(): ThemeChoice | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(GUEST_THEME_KEY);
  if (v === 'light' || v === 'dark') return v;
  return null;
}

export function applyDomTheme(theme: ThemeChoice): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
}

const ThemeCtx = React.createContext<ThemeChoice>('dark');

export function useAppTheme(): ThemeChoice {
  return React.useContext(ThemeCtx);
}

/** Syncs document theme classes from session preference or guest localStorage. Also wraps Sonner. */
export function ThemeProvider({
  localeChildren,
}: {
  /** LocaleProvider + app tree live here so toaster sits inside the theme context. */
  localeChildren: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);

  const theme: ThemeChoice = React.useMemo(() => {
    if (user?.theme) return user.theme;
    const g = typeof window !== 'undefined' ? readStoredGuestTheme() : null;
    return g ?? 'dark';
  }, [user?.theme]);

  React.useEffect(() => {
    const resolved: ThemeChoice = user?.theme ?? readStoredGuestTheme() ?? 'dark';
    applyDomTheme(resolved);
    if (!user?.theme && resolved) {
      window.localStorage.setItem(GUEST_THEME_KEY, resolved);
    }
  }, [user?.theme, theme]);

  return (
    <ThemeCtx.Provider value={theme}>
      {localeChildren}
      <Toaster
        theme={theme}
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: 'glass-strong border border-white/10 text-fg shadow-glass',
            title: 'text-fg font-medium',
            description: 'text-fg-subtle',
          },
        }}
      />
    </ThemeCtx.Provider>
  );
}
