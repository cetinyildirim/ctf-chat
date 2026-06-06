import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

export const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many auth attempts, slow down.' } },
});

export const messageLimiter = rateLimit({
  windowMs: 10_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.user?.id ??
    req.ip ??
    req.headers['x-forwarded-for']?.toString() ??
    'anon',
  message: { error: { code: 'RATE_LIMIT', message: 'Slow down — too many messages.' } },
});

const userOrIpKey = (req: Request) =>
  req.user?.id ?? req.ip ?? req.headers['x-forwarded-for']?.toString() ?? 'anon';

export const adminMutationLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD',
  keyGenerator: userOrIpKey,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many admin actions, slow down.' } },
});

export const inviteAcceptLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many invite attempts, slow down.' } },
});

export const fileDownloadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many file downloads, slow down.' } },
});

export const sensitiveAuthLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many sensitive auth operations.' } },
});
