import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env.js';
import crypto from 'node:crypto';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: string;
  teamId: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

const accessOpts: SignOptions = {
  expiresIn: env.ACCESS_TOKEN_TTL,
  algorithm: 'HS256',
  issuer: 'sydt',
  audience: 'sydt-web',
};

const refreshOpts: SignOptions = {
  expiresIn: env.REFRESH_TOKEN_TTL,
  algorithm: 'HS256',
  issuer: 'sydt',
  audience: 'sydt-refresh',
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, accessOpts);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, refreshOpts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'sydt',
    audience: 'sydt-web',
  }) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: 'sydt',
    audience: 'sydt-refresh',
  }) as RefreshTokenPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
