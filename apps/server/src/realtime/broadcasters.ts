import type {
  Announcement,
  Channel,
  Incident,
  Message,
  NotificationDto,
  ScoreboardEntry,
  Ticket,
  TicketEvent,
} from '@sydt/shared';
import { getIO } from './io.js';
import { room } from './rooms.js';
import { logger } from '../lib/logger.js';

export function emitMessageNew(channelId: string, message: Message): void {
  getIO().to(room.channel(channelId)).emit('message:new', { channelId, message });
}
export function emitMessageEdit(channelId: string, message: Message): void {
  getIO().to(room.channel(channelId)).emit('message:edit', { channelId, message });
}
export function emitMessageDelete(channelId: string, messageId: string): void {
  getIO().to(room.channel(channelId)).emit('message:delete', { channelId, messageId });
}
export function emitMessageReact(channelId: string, messageId: string, reactions: Message['reactions']): void {
  getIO().to(room.channel(channelId)).emit('message:react', { channelId, messageId, reactions });
}

export function emitScoreboardUpdate(entries: ScoreboardEntry[]): void {
  getIO().to(room.global()).emit('scoreboard:update', {
    generatedAt: new Date().toISOString(),
    entries,
  });
}

/**
 * Ticket fan-out targets, in competition scope only:
 * - the competition's organizer room,
 * - the reporting team's room inside that competition,
 * - the reporter personally (they may have no team).
 * The unscoped `staff` / `team:` rooms are deliberately not used: a team id can
 * appear in several competitions, which would leak tickets across events.
 */
function ticketRooms(ticket: Ticket): string[] {
  const targets = [room.serverStaff(ticket.serverId), room.user(ticket.openedBy.id)];
  if (ticket.team) targets.push(room.serverTeam(ticket.serverId, ticket.team.id));
  if (ticket.assignedTo) targets.push(room.user(ticket.assignedTo.id));
  return [...new Set(targets)];
}

export function emitTicketCreated(ticket: Ticket): void {
  getIO().to(ticketRooms(ticket)).emit('ticket:created', { ticket });
}

/** `staffOnly` keeps internal notes away from competitor sockets. */
export function emitTicketUpdated(
  ticket: Ticket,
  event?: TicketEvent,
  opts?: { staffOnly?: boolean },
): void {
  const targets = opts?.staffOnly ? [room.serverStaff(ticket.serverId)] : ticketRooms(ticket);
  getIO().to(targets).emit('ticket:updated', { ticket, event });
}

export function emitTicketComment(ticket: Ticket, event: TicketEvent): void {
  getIO().to(ticketRooms(ticket)).emit('ticket:comment', { ticket, event });
}

export function emitNotification(
  userId: string,
  notification: NotificationDto,
  unreadCount: number,
): void {
  getIO().to(room.user(userId)).emit('notification:new', { notification, unreadCount });
}

export function emitIncidentCreated(incident: Incident): void {
  const targets = incidentRooms(incident);
  getIO().to(targets).emit('incident:created', { incident });
}
export function emitIncidentUpdated(incident: Incident): void {
  const targets = incidentRooms(incident);
  getIO().to(targets).emit('incident:updated', { incident });
}

function incidentRooms(incident: Incident): string[] {
  if (incident.serverId) return [room.serverStaff(incident.serverId)];
  // Legacy rows without serverId: platform staff only.
  return [room.staff()];
}

export function emitAnnouncement(announcement: Announcement, serverId?: string): void {
  if (serverId) {
    getIO().to(room.server(serverId)).emit('announcement:new', { announcement });
  }
}

export function emitChannelCreated(channel: Channel): void {
  if (channel.serverId) {
    getIO().to(room.server(channel.serverId)).emit('channel:created', { channel });
    return;
  }
  logger.warn({ channelId: channel.id }, 'emitChannelCreated without serverId — skipped');
}

/** Notify members of a server to reload channel lists. */
export function emitChannelsRefresh(serverId: string): void {
  getIO().to(room.server(serverId)).emit('channels:refresh');
}

/** DM / user-scoped channel list changes (no server room). */
export function emitChannelsRefreshToUsers(userIds: string[]): void {
  const io = getIO();
  for (const userId of [...new Set(userIds)]) {
    io.to(room.user(userId)).emit('channels:refresh');
  }
}

export function emitMention(args: {
  userId: string;
  fromUserId: string;
  channelId: string;
  messageId: string;
  preview: string;
}): void {
  getIO()
    .to(room.user(args.userId))
    .emit('mention:new', {
      messageId: args.messageId,
      channelId: args.channelId,
      fromUserId: args.fromUserId,
      preview: args.preview,
    });
}

