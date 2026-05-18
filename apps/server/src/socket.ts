import type { Server as HttpServer } from 'http';
import { Server as IOServer } from 'socket.io';
import cookie from 'cookie';
import { env } from './env.js';
import { COOKIE_NAMES } from './middleware/auth.js';
import { verifyAccessToken } from './lib/jwt.js';
import { logger } from './lib/logger.js';
import { prisma } from './prisma.js';
import { type SydtIO, setIO } from './realtime/io.js';
import { room } from './realtime/rooms.js';
import { heartbeat, snapshot, trackConnect, trackDisconnect } from './realtime/presence.js';
import { listTyping, startTyping, stopTyping } from './realtime/typing.js';
import { isStaff, type Role } from '@sydt/shared';

export function createSocketServer(httpServer: HttpServer): SydtIO {
  const io: SydtIO = new IOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  setIO(io);

  io.use((socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      const parsed = rawCookie ? cookie.parse(rawCookie) : {};
      const headerToken = (socket.handshake.auth as { token?: string } | undefined)?.token;
      const token = parsed[COOKIE_NAMES.ACCESS] ?? headerToken;
      if (!token) return next(new Error('unauthorized'));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.username = payload.username;
      socket.data.role = payload.role;
      socket.data.teamId = payload.teamId;
      next();
    } catch (err) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId, role, teamId } = socket.data;
    logger.debug({ userId }, 'socket connected');

    socket.join(room.global());
    socket.join(room.user(userId));
    if (teamId) socket.join(room.team(teamId));
    if (isStaff(role as Role)) socket.join(room.staff());

    const presence = trackConnect(userId, socket.id);
    io.to(room.global()).emit('presence:update', { presences: [presence] });

    socket.emit('presence:update', { presences: snapshot() });

    socket.on('channel:join', async (channelId, ack) => {
      try {
        const channel = await prisma.channel.findUnique({
          where: { id: channelId },
          select: { id: true, isPrivate: true, teamId: true, type: true },
        });
        if (!channel) {
          ack?.({ ok: false, error: 'Channel not found' });
          return;
        }
        const staffChannel =
          channel.type === 'STAFF_COORD' ||
          channel.type === 'ORGANIZER_INTERNAL' ||
          channel.type === 'LOGS' ||
          channel.type === 'INCIDENT';
        if (staffChannel && !isStaff(role as Role)) {
          ack?.({ ok: false, error: 'Forbidden' });
          return;
        }

        if (channel.type === 'DIRECT_MESSAGE') {
          const p = await prisma.channelDmParticipant.findUnique({
            where: { channelId_userId: { channelId, userId } },
          });
          if (!p) {
            ack?.({ ok: false, error: 'Forbidden' });
            return;
          }
          socket.join(room.channel(channelId));
          ack?.({ ok: true });
          return;
        }

        if (channel.isPrivate && channel.teamId && channel.teamId !== teamId && !isStaff(role as Role)) {
          ack?.({ ok: false, error: 'Forbidden' });
          return;
        }
        socket.join(room.channel(channelId));
        ack?.({ ok: true });
      } catch (err) {
        logger.warn({ err }, 'channel:join failed');
        ack?.({ ok: false, error: 'Internal error' });
      }
    });

    socket.on('channel:leave', (channelId) => {
      socket.leave(room.channel(channelId));
    });

    socket.on('typing:start', ({ channelId }) => {
      if (!channelId) return;
      const newlyTyping = startTyping(channelId, userId);
      if (newlyTyping) {
        socket.to(room.channel(channelId)).emit('typing:start', { channelId, userId });
      }
    });

    socket.on('typing:stop', ({ channelId }) => {
      if (!channelId) return;
      const removed = stopTyping(channelId, userId);
      if (removed) {
        socket.to(room.channel(channelId)).emit('typing:stop', { channelId, userId });
      }
    });

    socket.on('presence:heartbeat', ({ status }) => {
      const change = heartbeat(userId, status);
      if (change) {
        io.to(room.global()).emit('presence:update', { presences: [change] });
      }
    });

    socket.on('disconnect', () => {
      const change = trackDisconnect(userId, socket.id);
      if (change) io.to(room.global()).emit('presence:update', { presences: [change] });
    });
  });

  return io;
}

export { listTyping };
