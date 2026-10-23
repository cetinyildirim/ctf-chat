import type { Locale } from '@/i18n/dict';

export function rulesHref(locale: Locale): string {
  return locale === 'en' ? '/legal/acceptable-use' : '/legal/kabul-edilebilir-kullanim';
}
