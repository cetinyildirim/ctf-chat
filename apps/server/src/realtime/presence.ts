import { PRESENCE_OFFLINE_MS, type UserStatus } from '@sydt/shared';

interface PresenceRecord {
  userId: string;
  status: UserStatus;
  lastSeen: number;
  socketIds: Set<string>;
}

const presences = new Map<string, PresenceRecord>();

export interface PresenceChange {
  userId: string;
  status: UserStatus;
  lastSeen: string;
}

export function trackConnect(userId: string, socketId: string): PresenceChange {
  const existing = presences.get(userId);
  if (existing) {
    existing.socketIds.add(socketId);
    existing.lastSeen = Date.now();
    existing.status = existing.status === 'OFFLINE' ? 'ONLINE' : existing.status;
    return toChange(existing);
  }
  const rec: PresenceRecord = {
    userId,
    status: 'ONLINE',
    lastSeen: Date.now(),
    socketIds: new Set([socketId]),
  };
  presences.set(userId, rec);
  return toChange(rec);
}

export function trackDisconnect(userId: string, socketId: string): PresenceChange | null {
  const rec = presences.get(userId);
  if (!rec) return null;
  rec.socketIds.delete(socketId);
  rec.lastSeen = Date.now();
  if (rec.socketIds.size === 0) {
    rec.status = 'OFFLINE';
  }
  return toChange(rec);
}

export function heartbeat(userId: string, status?: UserStatus): PresenceChange | null {
  const rec = presences.get(userId);
  if (!rec) return null;
  rec.lastSeen = Date.now();
  if (status) rec.status = status;
  return toChange(rec);
}

export function snapshot(): PresenceChange[] {
  return Array.from(presences.values()).map(toChange);
}

export function isOnline(userId: string): boolean {
  const rec = presences.get(userId);
  if (!rec) return false;
  if (rec.socketIds.size === 0) return false;
  return Date.now() - rec.lastSeen < PRESENCE_OFFLINE_MS;
}

function toChange(rec: PresenceRecord): PresenceChange {
  return {
    userId: rec.userId,
    status: rec.status,
    lastSeen: new Date(rec.lastSeen).toISOString(),
  };
}
