import type { Announcement, Channel, Incident, Message, ScoreboardEntry, Ticket, TicketEvent } from '@sydt/shared';
import { getIO } from './io.js';
import { room } from './rooms.js';

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

export function emitTicketCreated(ticket: Ticket): void {
  getIO().to(room.staff()).emit('ticket:created', { ticket });
  if (ticket.team) getIO().to(room.team(ticket.team.id)).emit('ticket:created', { ticket });
}

export function emitTicketUpdated(ticket: Ticket, event?: TicketEvent): void {
  getIO().to(room.staff()).emit('ticket:updated', { ticket, event });
  if (ticket.team) getIO().to(room.team(ticket.team.id)).emit('ticket:updated', { ticket, event });
}

export function emitIncidentCreated(incident: Incident): void {
  getIO().to(room.staff()).emit('incident:created', { incident });
}
export function emitIncidentUpdated(incident: Incident): void {
  getIO().to(room.staff()).emit('incident:updated', { incident });
}

export function emitAnnouncement(announcement: Announcement): void {
  getIO().to(room.global()).emit('announcement:new', { announcement });
}

export function emitChannelCreated(channel: Channel): void {
  getIO().to(room.global()).emit('channel:created', { channel });
}

export function emitChannelsRefresh(): void {
  getIO().to(room.global()).emit('channels:refresh');
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
