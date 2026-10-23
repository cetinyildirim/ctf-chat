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
import { listTyping, startTyping, stopAllTyping, stopTyping } from './realtime/typing.js';
import { isStaff, type Role } from '@sydt/shared';
import { loadChannel, assertCanAccessChannel } from './modules/messages/access.js';
import { permissionRoleOf } from './lib/user-role.js';

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
    void (async () => {
      try {
        const rawCookie = socket.handshake.headers.cookie;
        const parsed = rawCookie ? cookie.parse(rawCookie) : {};
        const token = parsed[COOKIE_NAMES.ACCESS];
        if (!token) return next(new Error('unauthorized'));

        const payload = verifyAccessToken(token);
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, username: true, role: true, platformRole: true, teamId: true, isBanned: true, disabledAt: true },
        });
        if (!user || user.isBanned || user.disabledAt) return next(new Error('unauthorized'));

        socket.data.userId = user.id;
        socket.data.username = user.username;
        socket.data.role = permissionRoleOf(user);
        // Legacy display cache only — channel ACL uses ServerTeamMember via assertCanAccessChannel.
        socket.data.teamId = user.teamId;
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    })();
  });

  io.on('connection', async (socket) => {
    const { userId, role, teamId } = socket.data;
    logger.debug({ userId }, 'socket connected');

    socket.join(room.global());
    socket.join(room.user(userId));
    // Platform staff room kept for legacy incidents without serverId.
    if (isStaff(role as Role)) socket.join(room.staff());

    const serverMemberships = await prisma.serverMember.findMany({
      where: { userId, bannedAt: null },
      select: { serverId: true },
    });
    const memberServerIds = new Set(serverMemberships.map((m) => m.serverId));
    for (const serverId of memberServerIds) {
      socket.join(room.server(serverId));
      if (isStaff(role as Role)) socket.join(room.serverStaff(serverId));
    }

    const teamMemberships = await prisma.serverTeamMember.findMany({
      where: { userId },
      select: { teamId: true, serverId: true },
    });
    for (const tm of teamMemberships) {
      // Competition-scoped only — never the unscoped `team:` room (cross-event leak risk).
      if (memberServerIds.has(tm.serverId)) {
        socket.join(room.serverTeam(tm.serverId, tm.teamId));
      }
    }

    const presence = trackConnect(userId, socket.id);
    io.to(room.global()).emit('presence:update', { presences: [presence] });
    socket.emit('presence:update', { presences: snapshot() });

    const joinedChannels = new Set<string>();

    socket.on('channel:join', async (channelId, ack) => {
      try {
        const channel = await loadChannel(channelId);
        await assertCanAccessChannel(channel, {
          id: userId,
          role: role as Role,
          teamId: teamId ?? null,
        });
        socket.join(room.channel(channelId));
        joinedChannels.add(channelId);
        ack?.({ ok: true });
      } catch (err) {
        logger.warn({ err }, 'channel:join failed');
        ack?.({ ok: false, error: 'Forbidden' });
      }
    });

    socket.on('channel:leave', (channelId) => {
      socket.leave(room.channel(channelId));
      joinedChannels.delete(channelId);
    });

    // Clients refresh typing:start while typing and expire it locally, so every
    // start/stop is forwarded even if the server-side TTL entry already lapsed.
    socket.on('typing:start', ({ channelId }) => {
      if (!channelId || !joinedChannels.has(channelId)) return;
      startTyping(channelId, userId);
      socket.to(room.channel(channelId)).emit('typing:start', { channelId, userId });
    });

    socket.on('typing:stop', ({ channelId }) => {
      if (!channelId || !joinedChannels.has(channelId)) return;
      stopTyping(channelId, userId);
      socket.to(room.channel(channelId)).emit('typing:stop', { channelId, userId });
    });

    socket.on('presence:heartbeat', ({ status }) => {
      const change = heartbeat(userId, status);
      if (change) {
        io.to(room.global()).emit('presence:update', { presences: [change] });
      }
    });

    socket.on('disconnect', () => {
      for (const channelId of stopAllTyping(userId)) {
        io.to(room.channel(channelId)).emit('typing:stop', { channelId, userId });
      }
      const change = trackDisconnect(userId, socket.id);
      if (change) io.to(room.global()).emit('presence:update', { presences: [change] });
    });
  });

  return io;
}

export { listTyping };
