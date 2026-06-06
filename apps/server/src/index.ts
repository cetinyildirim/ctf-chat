import http from 'node:http';
import { env } from './env.js';
import { logger } from './lib/logger.js';
import { createApp } from './app.js';
import { createSocketServer } from './socket.js';
import { getScoreboard } from './modules/scoreboard/scoreboard.service.js';
import { emitScoreboardUpdate } from './realtime/broadcasters.js';
import { prisma } from './prisma.js';
import { warmPlatformSettingsCache } from './lib/platform-settings.js';
import { ensureDefaultChatServer } from './lib/migrate-default-server.js';
import { publishDueAnnouncements } from './lib/announcement-publish.js';

async function main() {
  await warmPlatformSettingsCache().catch(() => undefined);
  await ensureDefaultChatServer().catch((err) => {
    logger.warn({ err }, 'default server migration skipped');
  });
  const app = createApp();
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer);

  let lastSerialized = '';
  setInterval(async () => {
    try {
      if (io.engine.clientsCount === 0) return;
      const snap = await getScoreboard();
      const fingerprint = snap.entries
        .map((e) => `${e.team.id}:${e.score}:${e.rank}`)
        .join('|');
      if (fingerprint !== lastSerialized) {
        lastSerialized = fingerprint;
        emitScoreboardUpdate(snap.entries);
      }
    } catch (err) {
      logger.warn({ err }, 'scoreboard poll failed');
    }
  }, 10_000).unref?.();

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
