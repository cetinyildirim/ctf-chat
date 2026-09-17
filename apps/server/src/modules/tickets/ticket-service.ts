/**
 * Ticket write helpers shared by the competition-scoped and id-scoped routers:
 * code allocation, event recording, response-time metrics and list projection.
 */
import { PRIORITY_ORDER, type TicketPriority, type TicketStatus } from '@sydt/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { BadRequest } from '../../lib/http-error.js';
import { serializeTicket } from '../serializers.js';
import { ensureCompetitionSettings } from '../../lib/ticket-defaults.js';
import { TICKET_INCLUDE, type TicketAccess, type TicketWithRelations } from './ticket-access.js';

export function priorityRankOf(priority: string): number {
  return PRIORITY_ORDER[priority as TicketPriority] ?? 1;
}

export function formatTicketCode(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(6, '0')}`;
}

/**
 * Allocates the next per-competition sequence number. SQLite serializes writes,
 * and `@@unique([serverId, seq])` plus the retry loop covers the race anyway.
 */
export async function allocateTicketNumber(
  serverId: string,
): Promise<{ seq: number; code: string }> {
  const settings = await ensureCompetitionSettings(serverId);
  const max = await prisma.ticket.aggregate({ where: { serverId }, _max: { seq: true } });
  const seq = (max._max.seq ?? 0) + 1;
  return { seq, code: formatTicketCode(settings.ticketPrefix, seq) };
}

export interface TicketEventInput {
  ticketId: string;
  type: string;
  authorId?: string | null;
  body?: string | null;
  meta?: Record<string, unknown>;
}

export async function recordTicketEvent(
  input: TicketEventInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.ticketEvent.create({
    data: {
      ticketId: input.ticketId,
      type: input.type,
      authorId: input.authorId ?? null,
      body: input.body ?? null,
      metaJson: JSON.stringify(input.meta ?? {}),
    },
    include: { author: { include: { team: true } }, attachments: true },
  });
}

/** Timestamps derived from a status change; keeps lifecycle fields consistent. */
export function statusTimestamps(
  next: TicketStatus,
  current: { resolvedAt: Date | null; closedAt: Date | null },
): { resolvedAt: Date | null; closedAt: Date | null } {
  const now = new Date();
  switch (next) {
    case 'RESOLVED':
      return { resolvedAt: current.resolvedAt ?? now, closedAt: null };
    case 'CLOSED':
      return { resolvedAt: current.resolvedAt ?? now, closedAt: current.closedAt ?? now };
    default:
      // Any move back into an active status clears the terminal timestamps.
      return { resolvedAt: null, closedAt: null };
  }
}

export function ticketEventTypeForStatus(next: TicketStatus): string {
  if (next === 'RESOLVED') return 'RESOLVED';
  if (next === 'CLOSED') return 'CLOSED';
  if (next === 'REOPENED') return 'REOPENED';
  return 'STATUS_CHANGE';
}

/**
 * Reply-side metric updates. Organizer replies stamp the first-response clock;
 * a competitor reply on a waiting ticket hands it back to the organizers.
 */
export function replyMetrics(
  ticket: { firstResponseAt: Date | null; status: string },
  opts: { fromOrganizer: boolean; internal: boolean },
): Prisma.TicketUpdateInput {
  const now = new Date();
  if (opts.internal) return { updatedAt: now };

  if (opts.fromOrganizer) {
    return {
      updatedAt: now,
      lastOrganizerReplyAt: now,
      firstResponseAt: ticket.firstResponseAt ?? now,
    };
  }

  const handBack = ticket.status === 'WAITING_FOR_COMPETITOR';
  return {
    updatedAt: now,
    lastCompetitorReplyAt: now,
    ...(handBack ? { status: 'IN_PROGRESS' } : {}),
  };
}

export function assertSameCompetition(
  a: { serverId: string },
  b: { serverId: string },
  message = 'Tickets belong to different competitions',
): void {
  if (a.serverId !== b.serverId) throw BadRequest(message);
}

/**
 * Adds per-viewer counters (visible messages, attachments, unread) to a page of
 * tickets using two aggregate queries rather than one query per ticket.
 */
export async function projectTicketList(
  tickets: TicketWithRelations[],
  access: TicketAccess,
) {
  if (tickets.length === 0) return [];
  const ids = tickets.map((t) => t.id);
  const visibleTypes = access.canSeeInternal
    ? undefined
    : { type: { not: 'INTERNAL_NOTE' } as Prisma.StringFilter };

  const [events, reads] = await Promise.all([
    prisma.ticketEvent.findMany({
      where: { ticketId: { in: ids }, ...visibleTypes },
      select: {
        ticketId: true,
        type: true,
        createdAt: true,
        authorId: true,
        _count: { select: { attachments: true } },
      },
    }),
    prisma.ticketRead.findMany({
      where: { ticketId: { in: ids }, userId: access.viewerId },
      select: { ticketId: true, lastReadAt: true },
    }),
  ]);

  const readAt = new Map(reads.map((r) => [r.ticketId, r.lastReadAt]));
  const stats = new Map<string, { messages: number; attachments: number; unread: number }>();
  for (const id of ids) stats.set(id, { messages: 0, attachments: 0, unread: 0 });

  for (const ev of events) {
    const entry = stats.get(ev.ticketId);
    if (!entry) continue;
    if (ev.type === 'COMMENT' || ev.type === 'INTERNAL_NOTE') entry.messages += 1;
    entry.attachments += ev._count.attachments;
    const since = readAt.get(ev.ticketId);
    const unread = !since || ev.createdAt > since;
    if (unread && ev.authorId !== access.viewerId) entry.unread += 1;
  }

  return tickets.map((t) => {
    const s = stats.get(t.id)!;
    return serializeTicket(t, {
      messageCount: s.messages,
      attachmentCount: s.attachments,
      unreadCount: s.unread,
    });
  });
}

export const TICKET_LIST_INCLUDE = TICKET_INCLUDE;
