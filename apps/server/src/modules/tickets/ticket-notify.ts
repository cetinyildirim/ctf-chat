/**
 * Side effects of ticket mutations: durable notifications and outbound
 * webhooks. Realtime fan-out stays in realtime/broadcasters.ts because it is
 * socket-specific; everything else funnels through here so the handlers do not
 * each grow their own copy of the fan-out rules.
 *
 * All helpers are best-effort: notification or webhook problems must never
 * roll back the ticket change that triggered them.
 */
import { NotificationKind, type Ticket, type TicketEvent } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { logger } from '../../lib/logger.js';
import { dispatchServerWebhooks } from '../../lib/server-webhooks.js';
import { competitorIdsForTicket, notifyUsers, organizerIdsForServer } from '../../lib/notify.js';

/** Webhook event names follow the spec (§34): `ticket.created`, ... */
export type TicketWebhookEvent =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.assigned'
  | 'ticket.status_changed'
  | 'ticket.priority_changed'
  | 'ticket.comment_added'
  | 'ticket.resolved'
  | 'ticket.closed'
  | 'ticket.reopened';

function href(ticket: Ticket): string {
  return `/tickets/${ticket.id}`;
}

/** Public shape sent to external systems; internal notes are never included. */
function webhookPayload(ticket: Ticket, extra?: Record<string, unknown>) {
  return {
    ticket: {
      id: ticket.id,
      code: ticket.code,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category?.name ?? null,
      challenge: ticket.challenge?.title ?? null,
      team: ticket.team?.name ?? null,
      reporter: ticket.openedBy.displayName,
      assignee: ticket.assignedTo?.displayName ?? null,
      url: href(ticket),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    },
    ...extra,
  };
}

export async function dispatchTicketWebhook(
  ticket: Ticket,
  event: TicketWebhookEvent,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    await dispatchServerWebhooks(ticket.serverId, event, webhookPayload(ticket, extra));
  } catch (err) {
    logger.warn({ err, event, ticketId: ticket.id }, 'ticket webhook dispatch failed');
  }
}

/** New ticket: organizers get alerted, critical ones are called out. */
export async function notifyTicketCreated(ticket: Ticket): Promise<void> {
  const organizers = await organizerIdsForServer(ticket.serverId);
  const critical = ticket.priority === 'CRITICAL';
  await notifyUsers({
    userIds: organizers,
    kind: critical ? NotificationKind.TICKET_CRITICAL : NotificationKind.TICKET_CREATED,
    title: `${critical ? 'Critical ticket' : 'New ticket'} · ${ticket.code}`,
    body: ticket.title,
    href: href(ticket),
    refType: 'ticket',
    refId: ticket.id,
    serverId: ticket.serverId,
    exceptUserId: ticket.openedBy.id,
    meta: { code: ticket.code, priority: ticket.priority, team: ticket.team?.name ?? null },
  });

  await dispatchTicketWebhook(ticket, 'ticket.created');
  await notifyMultiTeamIssue(ticket);
}

/**
 * When several teams report the same challenge, organizers are told once per
 * new reporting team so a platform-wide outage is visible immediately (§21).
 */
async function notifyMultiTeamIssue(ticket: Ticket): Promise<void> {
  if (!ticket.challenge) return;
  const rows = await prisma.ticket.findMany({
    where: {
      serverId: ticket.serverId,
      challengeId: ticket.challenge.id,
      teamId: { not: null },
      status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_COMPETITOR', 'REOPENED'] },
    },
    select: { teamId: true },
  });
  const teams = new Set(rows.map((r) => r.teamId));
  if (teams.size < 2) return;

  const organizers = await organizerIdsForServer(ticket.serverId);
  await notifyUsers({
    userIds: organizers,
    kind: NotificationKind.TICKET_MULTI_TEAM,
    title: `${teams.size} teams reporting · ${ticket.challenge.title}`,
    body: `Latest: ${ticket.code} — ${ticket.title}`,
    href: `/tickets?challengeId=${ticket.challenge.id}`,
    refType: 'challenge',
    refId: ticket.challenge.id,
    serverId: ticket.serverId,
    meta: {
      teamCount: teams.size,
      challengeId: ticket.challenge.id,
      challengeTitle: ticket.challenge.title,
    },
  });
}

/** A public reply: the other side of the conversation gets notified. */
export async function notifyTicketReply(
  ticket: Ticket,
  event: TicketEvent,
  authorIsOrganizer: boolean,
): Promise<void> {
  const authorId = event.author?.id ?? null;
  const recipients = authorIsOrganizer
    ? await competitorIdsForTicket({
        serverId: ticket.serverId,
        openedById: ticket.openedBy.id,
        teamId: ticket.team?.id ?? null,
      })
    : [
        ...(ticket.assignedTo ? [ticket.assignedTo.id] : []),
        ...(ticket.assignedTo ? [] : await organizerIdsForServer(ticket.serverId)),
      ];

  await notifyUsers({
    userIds: recipients,
    kind: NotificationKind.TICKET_REPLY,
    title: `Reply · ${ticket.code}`,
    body: (event.body ?? ticket.title).slice(0, 200),
    href: href(ticket),
    refType: 'ticket',
    refId: ticket.id,
    serverId: ticket.serverId,
    exceptUserId: authorId,
    meta: { code: ticket.code },
  });

  await dispatchTicketWebhook(ticket, 'ticket.comment_added', {
    comment: { author: event.author?.displayName ?? 'system', body: event.body },
  });
}

/** Status change: competitors always care, and REOPENED also pings organizers. */
export async function notifyTicketStatus(
  ticket: Ticket,
  previousStatus: string,
  actorId: string,
): Promise<void> {
  const kind =
    ticket.status === 'RESOLVED'
      ? NotificationKind.TICKET_RESOLVED
      : ticket.status === 'REOPENED'
        ? NotificationKind.TICKET_REOPENED
        : NotificationKind.TICKET_STATUS;

  const competitors = await competitorIdsForTicket({
    serverId: ticket.serverId,
    openedById: ticket.openedBy.id,
    teamId: ticket.team?.id ?? null,
  });
  const audience =
    ticket.status === 'REOPENED'
      ? [...competitors, ...(await organizerIdsForServer(ticket.serverId))]
      : competitors;

  await notifyUsers({
    userIds: audience,
    kind,
    title: `${ticket.code} · ${ticket.status.replace(/_/g, ' ').toLowerCase()}`,
    body: ticket.title,
    href: href(ticket),
    refType: 'ticket',
    refId: ticket.id,
    serverId: ticket.serverId,
    exceptUserId: actorId,
    meta: { code: ticket.code, from: previousStatus, to: ticket.status },
  });

  await dispatchTicketWebhook(ticket, 'ticket.status_changed', {
    from: previousStatus,
    to: ticket.status,
  });
  if (ticket.status === 'RESOLVED') await dispatchTicketWebhook(ticket, 'ticket.resolved');
  if (ticket.status === 'CLOSED') await dispatchTicketWebhook(ticket, 'ticket.closed');
  if (ticket.status === 'REOPENED') await dispatchTicketWebhook(ticket, 'ticket.reopened');
}

export async function notifyTicketAssigned(ticket: Ticket, actorId: string): Promise<void> {
  if (!ticket.assignedTo) return;
  await notifyUsers({
    userIds: [ticket.assignedTo.id],
    kind: NotificationKind.TICKET_ASSIGNED,
    title: `Assigned to you · ${ticket.code}`,
    body: ticket.title,
    href: href(ticket),
    refType: 'ticket',
    refId: ticket.id,
    serverId: ticket.serverId,
    exceptUserId: actorId,
    meta: { code: ticket.code, priority: ticket.priority },
  });
  await dispatchTicketWebhook(ticket, 'ticket.assigned', {
    assignee: ticket.assignedTo.displayName,
  });
}

export async function notifyTicketPriority(
  ticket: Ticket,
  previousPriority: string,
): Promise<void> {
  await dispatchTicketWebhook(ticket, 'ticket.priority_changed', {
    from: previousPriority,
    to: ticket.priority,
  });
  if (ticket.priority !== 'CRITICAL' || previousPriority === 'CRITICAL') return;
  await notifyUsers({
    userIds: await organizerIdsForServer(ticket.serverId),
    kind: NotificationKind.TICKET_CRITICAL,
    title: `Escalated to critical · ${ticket.code}`,
    body: ticket.title,
    href: href(ticket),
    refType: 'ticket',
    refId: ticket.id,
    serverId: ticket.serverId,
    meta: { code: ticket.code, escalated: true },
  });
}
