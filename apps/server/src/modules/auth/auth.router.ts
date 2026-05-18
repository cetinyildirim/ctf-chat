import { Router } from 'express';
import { z } from 'zod';
import { schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { env, isProd } from '../../env.js';
import { validate } from '../../middleware/validate.js';
import { authLimiter } from '../../middleware/ratelimit.js';
import { requireAuth, COOKIE_NAMES, type AuthUser } from '../../middleware/auth.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../lib/jwt.js';
import { BadRequest, Conflict, Unauthorized } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import type { Request, Response } from 'express';
import { buildSessionUser } from '../../lib/session-user.js';

const router: Router = Router();

const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.COOKIE_SECURE || isProd,
  path: '/',
  domain: env.COOKIE_DOMAIN || undefined,
};

function writeAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(COOKIE_NAMES.ACCESS, accessToken, {
    ...COOKIE_BASE_OPTIONS,
    maxAge: env.ACCESS_TOKEN_TTL * 1000,
  });
  res.cookie(COOKIE_NAMES.REFRESH, refreshToken, {
    ...COOKIE_BASE_OPTIONS,
    maxAge: env.REFRESH_TOKEN_TTL * 1000,
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.ACCESS, { ...COOKIE_BASE_OPTIONS });
  res.clearCookie(COOKIE_NAMES.REFRESH, { ...COOKIE_BASE_OPTIONS });
}

async function issueTokens(user: { id: string; username: string; role: string; teamId: string | null }) {
  const access = signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role,
    teamId: user.teamId,
  });
  const jti = crypto.randomUUID();
  const refresh = signRefreshToken({ sub: user.id, jti });
  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId: user.id,
      tokenHash: hashToken(refresh),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000),
    },
  });
  return { access, refresh };
}

router.post('/register', authLimiter, validate(schemas.registerSchema), async (req, res, next) => {
  try {
    const data = req.body as z.infer<typeof schemas.registerSchema>;
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email.toLowerCase() }, { username: data.username.toLowerCase() }] },
    });
    if (existing) throw Conflict('Email or username already in use', 'USER_EXISTS');

    let teamId: string | null = null;
    if (data.teamCode) {
      const team = await prisma.team.findUnique({ where: { inviteCode: data.teamCode } });
      if (!team) throw BadRequest('Invalid team invite code', 'BAD_TEAM_CODE');
      teamId = team.id;
    }

    const passwordHash = await hashPassword(data.password);
    const totalUsers = await prisma.user.count();
    const role = totalUsers === 0 ? 'SUPER_ADMIN' : teamId ? 'TEAM_MEMBER' : 'SPECTATOR';

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        username: data.username.toLowerCase(),
        displayName: data.displayName,
        passwordHash,
        role,
        teamId,
        status: 'ONLINE',
      },
    });

    const { access, refresh } = await issueTokens({
      id: user.id,
      username: user.username,
      role: user.role,
      teamId: user.teamId,
    });
    writeAuthCookies(res, access, refresh);
    await audit({ actorId: user.id, action: 'user.register', target: user.id });
    res.status(201).json({ user: await buildSessionUser(user.id), accessToken: access });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, validate(schemas.loginSchema), async (req, res, next) => {
  try {
    const data = req.body as z.infer<typeof schemas.loginSchema>;
    const identifier = data.identifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    });
    if (!user || user.isBanned) throw Unauthorized('Invalid credentials', 'BAD_CREDENTIALS');
    const ok = await verifyPassword(user.passwordHash, data.password);
    if (!ok) throw Unauthorized('Invalid credentials', 'BAD_CREDENTIALS');

    const { access, refresh } = await issueTokens({
      id: user.id,
      username: user.username,
      role: user.role,
      teamId: user.teamId,
    });
    writeAuthCookies(res, access, refresh);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(), status: 'ONLINE' },
    });
    await audit({ actorId: user.id, action: 'user.login' });
    res.json({ user: await buildSessionUser(user.id), accessToken: access });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
    const refreshToken = cookies[COOKIE_NAMES.REFRESH];
    if (!refreshToken) throw Unauthorized('No refresh token', 'NO_REFRESH');
    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      clearAuthCookies(res);
      throw Unauthorized('Invalid refresh token', 'BAD_REFRESH');
    }
    const tokenHash = hashToken(refreshToken);
    const record = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!record || record.revokedAt || record.tokenHash !== tokenHash) {
      clearAuthCookies(res);
      throw Unauthorized('Refresh token rejected', 'REFRESH_REJECTED');
    }
    if (record.expiresAt < new Date()) {
      clearAuthCookies(res);
      throw Unauthorized('Refresh token expired', 'REFRESH_EXPIRED');
    }

    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.isBanned) {
      clearAuthCookies(res);
      throw Unauthorized();
    }
    const { access, refresh } = await issueTokens({
      id: user.id,
      username: user.username,
      role: user.role,
      teamId: user.teamId,
    });
    writeAuthCookies(res, access, refresh);
    res.json({ user: await buildSessionUser(user.id), accessToken: access });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const me = await buildSessionUser((req.user as AuthUser).id);
    res.json({ user: me });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
    const refreshToken = cookies[COOKIE_NAMES.REFRESH];
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await prisma.refreshToken.updateMany({
          where: { id: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } catch {
        /* ignore */
      }
    }
    clearAuthCookies(res);
    await audit({ actorId: req.user?.id, action: 'user.logout' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
