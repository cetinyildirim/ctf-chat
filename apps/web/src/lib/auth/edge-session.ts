import { jwtVerify, errors } from 'jose';

export const ACCESS_COOKIE = 'sydt_at';
export const REFRESH_COOKIE = 'sydt_rt';

export type EdgeSessionState = 'valid' | 'refreshable' | 'guest' | 'invalid';

function accessSecret(): Uint8Array | null {
  const raw = process.env.JWT_ACCESS_SECRET?.trim();
  if (!raw || raw.length < 16) return null;
  return new TextEncoder().encode(raw);
}

/** Edge-safe access JWT check (signature + issuer/audience; no DB). */
export async function resolveEdgeSessionState(
  accessToken: string | undefined,
  hasRefreshToken: boolean,
): Promise<EdgeSessionState> {
  if (!accessToken) return hasRefreshToken ? 'refreshable' : 'guest';

  const secret = accessSecret();
  if (!secret) {
    return hasRefreshToken || accessToken ? 'valid' : 'guest';
  }

  try {
    await jwtVerify(accessToken, secret, {
      algorithms: ['HS256'],
      issuer: 'sydt',
      audience: 'sydt-web',
    });
    return 'valid';
  } catch (err) {
    if (err instanceof errors.JWTExpired) return hasRefreshToken ? 'refreshable' : 'guest';
    if (err instanceof errors.JWSInvalid || err instanceof errors.JWTInvalid) return 'invalid';
    return hasRefreshToken ? 'refreshable' : 'guest';
  }
}
