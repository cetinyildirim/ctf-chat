import type { Server as IOServer } from 'socket.io';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@sydt/shared';

export type SydtIO = IOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let io: SydtIO | null = null;

export function setIO(instance: SydtIO): void {
  io = instance;
}

export function getIO(): SydtIO {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
