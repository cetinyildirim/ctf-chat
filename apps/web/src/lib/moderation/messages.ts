import type { Dict } from '@/i18n/dict';

export type SuspensionNotice = { until: string | null; reason: string | null };

const STORAGE_KEY = 'sydt:suspension-notice';

export function formatModerationDuration(minutes: number, t: Dict): string {
  if (minutes >= 1440 && minutes % 1440 === 0) return t.modDurationDays.replace('{{n}}', String(minutes / 1440));
  if (minutes >= 1440) return t.modDurationDays.replace('{{n}}', String(Math.round(minutes / 144) / 10));
  if (minutes >= 60 && minutes % 60 === 0) return t.modDurationHours.replace('{{n}}', String(minutes / 60));
  if (minutes >= 60) return t.modDurationHours.replace('{{n}}', String(Math.round(minutes / 6) / 10));
  return t.modDurationMinutes.replace('{{n}}', String(Math.max(1, Math.round(minutes))));
}

export function formatModerationUntil(iso: string, t: Dict): string {
  return new Date(iso).toLocaleString(t.dateLocale, { dateStyle: 'long', timeStyle: 'short' });
}

export function withReason(text: string, reason: string | null | undefined, t: Dict): string {
  return reason ? `${text} ${t.modReasonLine.replace('{{reason}}', reason)}` : text;
}

/** "You cannot use the platform until … (N left)" or the indefinite wording. */
export function suspensionText(notice: SuspensionNotice, t: Dict): string {
  if (!notice.until) return withReason(t.suspendedIndefinite, notice.reason, t);
  const remaining = Math.max(1, Math.round((new Date(notice.until).getTime() - Date.now()) / 60_000));
  const text = t.suspendedRemaining
    .replace('{{until}}', formatModerationUntil(notice.until, t))
    .replace('{{duration}}', formatModerationDuration(remaining, t));
  return withReason(text, notice.reason, t);
}

export function saveSuspensionNotice(notice: SuspensionNotice) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(notice));
  } catch {
    /* storage may be unavailable */
  }
}

export function takeSuspensionNotice(): SuspensionNotice | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as SuspensionNotice;
  } catch {
    return null;
  }
}
