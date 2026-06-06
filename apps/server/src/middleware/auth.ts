import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@sydt/shared';
import { verifyAccessToken } from '../lib/jwt.js';
import { Unauthorized } from '../lib/http-error.js';
import { prisma } from '../prisma.js';
import { permissionRoleOf } from '../lib/user-role.js';
import { env, allowBearerAuth } from '../env.js';

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
const CSRF_COOKIE = 'sydt_csrf';

export const COOKIE_NAMES = { ACCESS: ACCESS_COOKIE, REFRESH: REFRESH_COOKIE, CSRF: CSRF_COOKIE } as const;

function readBearer(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme !== 'Bearer' || !value) return null;
  return value;
}

export function readAccessToken(req: Request): string | null {
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    ACCESS_COOKIE
  ];
  if (cookieToken) return cookieToken;

  const allowBearer = allowBearerAuth;
  if (!allowBearer) return null;
  return readBearer(req);
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = readAccessToken(req);
  if (!token) {
    next(Unauthorized('Authentication required'));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true, platformRole: true, teamId: true, isBanned: true },
    });
    if (!user || user.isBanned) {
      next(Unauthorized('Invalid or expired session'));
      return;
    }
    req.user = {
      id: user.id,
      username: user.username,
      role: permissionRoleOf(user),
      teamId: user.teamId,
    };
    next();
  } catch {
    next(Unauthorized('Invalid or expired session'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readAccessToken(req);
  if (!token) return next();
  void (async () => {
    try {
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, role: true, platformRole: true, teamId: true, isBanned: true },
      });
      if (user && !user.isBanned) {
        req.user = {
          id: user.id,
          username: user.username,
          role: permissionRoleOf(user),
          teamId: user.teamId,
        };
      }
    } catch {
      /* ignore invalid tokens */
    }
    next();
  })();
}
