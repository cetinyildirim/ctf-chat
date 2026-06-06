import crypto from 'node:crypto';
import type { Response } from 'express';
import { env, isProd } from '../env.js';
import { COOKIE_NAMES } from '../middleware/auth.js';

const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  sameSite: 'lax' as const,
  secure: env.COOKIE_SECURE || isProd,
  path: '/',
  domain: env.COOKIE_DOMAIN || undefined,
  maxAge: env.REFRESH_TOKEN_TTL * 1000,
};

export function issueCsrfToken(res: Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(COOKIE_NAMES.CSRF, token, CSRF_COOKIE_OPTIONS);
  return token;
}

export function clearCsrfToken(res: Response): void {
  res.clearCookie(COOKIE_NAMES.CSRF, { ...CSRF_COOKIE_OPTIONS });
}
