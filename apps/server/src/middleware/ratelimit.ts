import rateLimit from 'express-rate-limit';

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
