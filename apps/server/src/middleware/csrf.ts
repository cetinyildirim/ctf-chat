import type { NextFunction, Request, Response } from 'express';
import { Forbidden } from '../lib/http-error.js';
import { COOKIE_NAMES } from './auth.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Paths that establish session cookies and cannot yet send CSRF header. */
const CSRF_EXEMPT = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/csrf',
  '/health',
];

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const path = req.originalUrl.split('?')[0] ?? req.path;
  if (CSRF_EXEMPT.some((p) => path === p || path.startsWith(`${p}/`))) {
    next();
    return;
  }

  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
  const cookieToken = cookies[COOKIE_NAMES.CSRF];
  const headerToken = req.header('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    next(Forbidden('CSRF validation failed'));
    return;
  }
  next();
}
