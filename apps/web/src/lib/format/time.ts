import { format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns';
import { enUS, tr } from 'date-fns/locale';
import { getCurrentLocale } from '@/i18n/current-locale';

function dateFnsLocale() {
  return getCurrentLocale() === 'en' ? enUS : tr;
}

export function relative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: dateFnsLocale() });
}

export function smartDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const en = getCurrentLocale() === 'en';
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `${en ? 'Yesterday' : 'Dün'} · ${format(d, 'HH:mm')}`;
  return format(d, en ? 'MMM d · HH:mm' : 'd MMM · HH:mm', { locale: dateFnsLocale() });
}

export function fullTimestamp(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const pattern = getCurrentLocale() === 'en' ? 'EEEE, MMM d yyyy · HH:mm:ss' : 'd MMMM yyyy EEEE · HH:mm:ss';
  return format(d, pattern, { locale: dateFnsLocale() });
}

export function shortTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'HH:mm');
}

export function shouldGroupAfter(prev: Date, next: Date, sameAuthor: boolean): boolean {
  if (!sameAuthor) return false;
  return next.getTime() - prev.getTime() < 5 * 60_000;
}
