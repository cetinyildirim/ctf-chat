import type {
  Announcement,
  Incident,
  Message,
  NotificationDto,
  PresenceState,
  ScoreboardEntry,
  Ticket,
  TicketEvent,
  Channel,
} from './types';

/**
 * Events emitted by the server, consumed by the client.
 */
export interface ServerToClientEvents {
  'message:new': (payload: { channelId: string; message: Message }) => void;
  'message:edit': (payload: { channelId: string; message: Message }) => void;
  'message:delete': (payload: { channelId: string; messageId: string }) => void;
  'message:react': (payload: {
    channelId: string;
    messageId: string;
    reactions: Message['reactions'];
  }) => void;

  'typing:start': (payload: { channelId: string; userId: string }) => void;
  'typing:stop': (payload: { channelId: string; userId: string }) => void;

  'presence:update': (payload: { presences: PresenceState[] }) => void;

  'scoreboard:update': (payload: {
    generatedAt: string;
    entries: ScoreboardEntry[];
  }) => void;

  'ticket:created': (payload: { ticket: Ticket }) => void;
  'ticket:updated': (payload: { ticket: Ticket; event?: TicketEvent }) => void;
  'ticket:comment': (payload: { ticket: Ticket; event: TicketEvent }) => void;

  'notification:new': (payload: { notification: NotificationDto; unreadCount: number }) => void;

  'incident:created': (payload: { incident: Incident }) => void;
  'incident:updated': (payload: { incident: Incident }) => void;

  'announcement:new': (payload: { announcement: Announcement }) => void;

  'channel:created': (payload: { channel: Channel }) => void;

  'channels:refresh': () => void;

  'mention:new': (payload: {
    messageId: string;
    channelId: string;
    fromUserId: string;
    preview: string;
  }) => void;

  'system:notice': (payload: { kind: 'INFO' | 'WARN' | 'ERROR'; message: string }) => void;
}

/**
 * Events emitted by the client, consumed by the server.
 */
export interface ClientToServerEvents {
  'channel:join': (channelId: string, ack?: (res: { ok: boolean; error?: string }) => void) => void;
  'channel:leave': (channelId: string) => void;
  'typing:start': (payload: { channelId: string }) => void;
  'typing:stop': (payload: { channelId: string }) => void;
  'presence:heartbeat': (payload: { status?: 'ONLINE' | 'IDLE' | 'DND' }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  username: string;
  role: string;
  teamId: string | null;
}

export const SOCKET_NAMESPACE = '/';
export const SOCKET_PATH = '/socket.io';
