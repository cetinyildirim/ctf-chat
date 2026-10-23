import { useAuthStore } from '@/store/auth';
import type { Locale } from './dict';

/** Active locale for code outside React (API error mapping, date formatting). Mirrors LocaleProvider. */
export function getCurrentLocale(): Locale {
  const userLocale = useAuthStore.getState().user?.locale;
  if (userLocale === 'en' || userLocale === 'tr') return userLocale;
  if (typeof window !== 'undefined' && window.localStorage.getItem('sydt-locale') === 'en') return 'en';
  return 'tr';
}
