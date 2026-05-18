import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { generalLimiter } from './middleware/ratelimit.js';

import authRouter from './modules/auth/auth.router.js';
import usersRouter from './modules/users/users.router.js';
import teamsRouter from './modules/teams/teams.router.js';
import categoriesRouter from './modules/categories/categories.router.js';
import brandRouter from './modules/brand/brand.router.js';
import channelsRouter from './modules/channels/channels.router.js';
import messagesRouter from './modules/messages/messages.router.js';
import challengesRouter from './modules/challenges/challenges.router.js';
import ticketsRouter from './modules/tickets/tickets.router.js';
import incidentsRouter from './modules/incidents/incidents.router.js';
import announcementsRouter from './modules/announcements/announcements.router.js';
import adminRouter from './modules/admin/admin.router.js';
import scoreboardRouter from './modules/scoreboard/scoreboard.router.js';

import filesRouter from './modules/files/files.router.js';
import friendsRouter from './modules/friends/friends.router.js';
import directRouter from './modules/direct/direct.router.js';
import surveysRouter from './modules/surveys/surveys.router.js';
import configRouter from './modules/config/config.router.js';
import reportsRouter from './modules/reports/reports.router.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '512kb' }));
  app.use(express.urlencoded({ extended: true, limit: '512kb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req: import('http').IncomingMessage) => req.url === '/health',
      },
    }),
  );
  app.use(generalLimiter);

  app.get('/health', (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/teams', teamsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/brand', brandRouter);
  app.use('/api/channels', channelsRouter);
  app.use('/api/channels', messagesRouter);
  app.use('/api', messagesRouter);
  app.use('/api/challenges', challengesRouter);
  app.use('/api/tickets', ticketsRouter);
  app.use('/api/incidents', incidentsRouter);
  app.use('/api/announcements', announcementsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/scoreboard', scoreboardRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/friends', friendsRouter);
  app.use('/api/direct', directRouter);
  app.use('/api/surveys', surveysRouter);
  app.use('/api/config', configRouter);
  app.use('/api/reports', reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
