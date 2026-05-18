import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@sydt/shared';

export type SydtSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: SydtSocket | null = null;

export function getSocket(): SydtSocket {
  if (socket) return socket;
  const apiOrigin =
    process.env.NEXT_PUBLIC_API_ORIGIN ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000');
  socket = io(apiOrigin, {
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
