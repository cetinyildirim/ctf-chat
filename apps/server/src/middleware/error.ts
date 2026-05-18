import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { isProd } from '../env.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'Too many files'
          : err.message;
    res.status(400).json({ error: { code: 'UPLOAD', message } });
    return;
  }
  const filterMsg = err instanceof Error ? err.message : '';
  if (filterMsg.includes('Only JPEG') || filterMsg.includes('images are allowed')) {
    res.status(400).json({ error: { code: 'UPLOAD', message: filterMsg } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION', message: 'Validation failed', details: err.flatten() },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? undefined },
    });
    return;
  }
  const isOperational = false;
  const status = (err as { status?: number }).status ?? 500;
  if (status >= 500) {
    logger.error({ err }, 'unhandled error');
  } else {
    logger.warn({ err }, 'request error');
  }
  res.status(status).json({
    error: {
      code: 'INTERNAL',
      message: isProd && !isOperational ? 'Internal server error' : (err as Error).message,
    },
  });
};

export const notFoundHandler = (
  _req: import('express').Request,
  res: import('express').Response,
): void => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};
