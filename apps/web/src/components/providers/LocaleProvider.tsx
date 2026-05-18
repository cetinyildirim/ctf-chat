'use client';

import * as React from 'react';
import type { SessionUser } from '@sydt/shared';
import { useAuthStore } from '@/store/auth';
import { normalizeSessionUser } from '@/lib/auth/session-normalize';
import type { Dict, Locale } from '@/i18n/dict';
import { getDict } from '@/i18n/dict';

type I18nCtx = {
  locale: Locale;
  t: Dict;
  setLocale: (next: Locale) => Promise<void>;
};

const Ctx = React.createContext<I18nCtx | null>(null);

const GUEST_LOCALE_KEY = 'sydt-locale';

function readGuestLocale(): Locale {
  if (typeof window === 'undefined') return 'tr';
  const v = window.localStorage.getItem(GUEST_LOCALE_KEY);
  return v === 'en' ? 'en' : 'tr';
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [guestLocale, setGuestLocale] = React.useState<Locale>('tr');

  React.useEffect(() => {
    setGuestLocale(readGuestLocale());
  }, []);

  const locale: Locale = user?.locale ?? guestLocale;
  const t = React.useMemo(() => getDict(locale), [locale]);

  const setLocale = React.useCallback(
    async (next: Locale) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(GUEST_LOCALE_KEY, next);
      }
      setGuestLocale(next);
      if (user) {
        const { usersApi } = await import('@/lib/api/endpoints');
        try {
          const updated = await usersApi.patchMe({ locale: next });
          setUser(normalizeSessionUser(updated as SessionUser));
        } catch {
          setUser(normalizeSessionUser({ ...user, locale: next }));
        }
      }
    },
    [user, setUser],
  );

  const value = React.useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const v = React.useContext(Ctx);
  if (!v) throw new Error('useI18n requires LocaleProvider');
  return v;
}
