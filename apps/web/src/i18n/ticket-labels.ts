import type {
  CompetitionStatus,
  TicketCategoryDto,
  TicketEventType,
  TicketPriority,
  TicketStatus,
} from '@sydt/shared';
import type { Dict } from '@/i18n/dict';

/**
 * Enum values arrive from the API in English; every user-facing rendering of them
 * goes through these helpers so the ticket UI follows the selected system locale.
 */

export function ticketStatusLabel(t: Dict, status: TicketStatus | string): string {
  const key = `ticketStatus_${status}` as keyof Dict;
  return (t[key] as string | undefined) ?? String(status).replace(/_/g, ' ');
}

export function ticketPriorityLabel(t: Dict, priority: TicketPriority | string): string {
  const key = `severity_${String(priority).toUpperCase()}` as keyof Dict;
  return (t[key] as string | undefined) ?? String(priority);
}

export function ticketEventLabel(t: Dict, type: TicketEventType | string): string {
  const key = `ticketEvent_${type}` as keyof Dict;
  return (t[key] as string | undefined) ?? String(type).replace(/_/g, ' ');
}

export function competitionStatusLabel(t: Dict, status: CompetitionStatus | string): string {
  const key = `competitionStatus_${status}` as keyof Dict;
  return (t[key] as string | undefined) ?? String(status);
}

/**
 * Built-in categories (seeded with a stable `key`) are translated here.
 * Custom categories created by organizers fall back to the stored `name`.
 */
export function ticketCategoryLabel(
  t: Dict,
  category: Pick<TicketCategoryDto, 'key' | 'name'> | { key?: string | null; name: string } | null | undefined,
): string {
  if (!category) return t.ticketUncategorized;
  if (category.key) {
    const dictKey = `ticketCategory_${category.key}` as keyof Dict;
    const translated = t[dictKey];
    if (typeof translated === 'string') return translated;
  }
  return category.name;
}
