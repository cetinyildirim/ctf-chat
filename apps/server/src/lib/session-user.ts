import type { Role, SessionUser } from '@sydt/shared';
import { permissionsFor } from '@sydt/shared';
import { prisma } from '../prisma.js';
import { Unauthorized } from './http-error.js';
import { serializeUser } from '../modules/serializers.js';

export async function buildSessionUser(userId: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { team: true },
  });
  if (!user) throw Unauthorized('Session user not found');
  const locale = user.preferredLocale === 'en' ? 'en' : 'tr';
  const theme = user.preferredTheme === 'light' ? 'light' : 'dark';
  let defaultNotifyMode: 'ALL' | 'MENTIONS_ONLY' | 'NONE' = 'ALL';
  if (user.notifyDefault === 'MENTIONS_ONLY') defaultNotifyMode = 'MENTIONS_ONLY';
  else if (user.notifyDefault === 'NONE') defaultNotifyMode = 'NONE';

  return {
    ...serializeUser(user),
    email: user.email,
    permissions: permissionsFor(user.role as Role),
    locale,
    theme,
    defaultNotifyMode,
  };
}
