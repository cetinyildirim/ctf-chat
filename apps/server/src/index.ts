import http from 'node:http';
import { env } from './env.js';
import { logger } from './lib/logger.js';
import { createApp } from './app.js';
import { createSocketServer } from './socket.js';
import { prisma } from './prisma.js';
import { warmPlatformSettingsCache } from './lib/platform-settings.js';
import { ensureDefaultChatServer, backfillIncidentServerIds } from './lib/migrate-default-server.js';
import { publishDueAnnouncements } from './lib/announcement-publish.js';

async function main() {
  await warmPlatformSettingsCache().catch(() => undefined);
  await ensureDefaultChatServer().catch((err) => {
    logger.warn({ err }, 'default server migration skipped');
  });

  // One-shot legacy team-room cleanup (not on GET /channels).
  const { provisionTeamRoomsForNonStaffCategories } = await import(
    './modules/categories/category-team-rooms.service.js'
  );
  await provisionTeamRoomsForNonStaffCategories(prisma).catch((err) => {
    logger.warn({ err }, 'team workspace migration skipped');
  });
  await backfillIncidentServerIds().catch((err) => {
    logger.warn({ err }, 'incident serverId backfill skipped');
  });

  const app = createApp();
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer);

  // Global scoreboard poller removed — UI uses per-server CTFd scoreboard.
  // Legacy /scoreboard REST remains for challenges page; no realtime fanout.

  setInterval(() => {
    void publishDueAnnouncements().catch((err) => logger.warn({ err }, 'announcement scheduler failed'));
  }, 30_000).unref?.();

  httpServer.listen(env.PORT, () => {
    logger.info(`SYDT API listening on http://localhost:${env.PORT}`);
  });

  async function shutdown(signal: string) {
    logger.info({ signal }, 'shutting down');
    httpServer.close(() => logger.info('http closed'));
    io.close();
    await prisma.$disconnect();
    process.exit(0);
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
