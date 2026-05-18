import { format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns';

export function relative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function smartDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday · ${format(d, 'HH:mm')}`;
  return format(d, 'MMM d · HH:mm');
}

export function fullTimestamp(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'EEEE, MMM d yyyy · HH:mm:ss');
}

export function shortTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'HH:mm');
}

export function shouldGroupAfter(prev: Date, next: Date, sameAuthor: boolean): boolean {
  if (!sameAuthor) return false;
  return next.getTime() - prev.getTime() < 5 * 60_000;
}
