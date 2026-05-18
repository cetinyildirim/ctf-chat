import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@sydt/shared';
import { verifyAccessToken } from '../lib/jwt.js';
import { Unauthorized } from '../lib/http-error.js';

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  teamId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const ACCESS_COOKIE = 'sydt_at';
const REFRESH_COOKIE = 'sydt_rt';

export const COOKIE_NAMES = { ACCESS: ACCESS_COOKIE, REFRESH: REFRESH_COOKIE } as const;

function readBearer(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme !== 'Bearer' || !value) return null;
  return value;
}

export function readAccessToken(req: Request): string | null {
  const bearer = readBearer(req);
  if (bearer) return bearer;
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    ACCESS_COOKIE
  ];
  return cookieToken ?? null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readAccessToken(req);
  if (!token) {
    next(Unauthorized('Authentication required'));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role as Role,
      teamId: payload.teamId,
    };
    next();
  } catch {
    next(Unauthorized('Invalid or expired session'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readAccessToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role as Role,
      teamId: payload.teamId,
    };
  } catch {
    // Ignore invalid tokens silently for optional routes
  }
  next();
}
