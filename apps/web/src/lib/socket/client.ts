import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@sydt/shared';

export type SydtSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: SydtSocket | null = null;

/**
 * Browser sockets must use the page origin (nginx / Next rewrite → API).
 * Baking NEXT_PUBLIC_API_ORIGIN (often http://localhost:4000) into the client
 * breaks production: REST still works via `/api`, but live toast/sound never fire.
 */
function socketOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000';
}

export function getSocket(): SydtSocket {
  if (socket) return socket;
  socket = io(socketOrigin(), {
    withCredentials: true,
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 700,
    reconnectionDelayMax: 5000,
    timeout: 10_000,
    autoConnect: false,
  });
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
