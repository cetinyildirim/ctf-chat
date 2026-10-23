import type { SessionUser } from '@sydt/shared';
import { PLATFORM_PASSWORD_RESET_ID, permissionsFor } from '@sydt/shared';
import { prisma } from '../prisma.js';
import { Unauthorized } from './http-error.js';
import { serializeUser } from '../modules/serializers.js';
import { permissionRoleOf, repairUserPlatformRole } from './user-role.js';

export async function buildSessionUser(userId: string): Promise<SessionUser> {
  const user = await repairUserPlatformRole(userId);
  const withTeam = await prisma.user.findUnique({
    where: { id: userId },
    include: { team: true },
  });
  if (!withTeam) throw Unauthorized('Session user not found');
  const locale = withTeam.preferredLocale === 'en' ? 'en' : 'tr';
  const theme = withTeam.preferredTheme === 'light' ? 'light' : 'dark';
  let defaultNotifyMode: 'ALL' | 'MENTIONS_ONLY' | 'NONE' = 'ALL';
  if (withTeam.notifyDefault === 'MENTIONS_ONLY') defaultNotifyMode = 'MENTIONS_ONLY';
  else if (withTeam.notifyDefault === 'NONE') defaultNotifyMode = 'NONE';

  const pendingPwd = await prisma.serverMember.findMany({
    where: { userId, mustChangePassword: true, bannedAt: null },
    select: { serverId: true },
  });

  return {
    ...serializeUser(withTeam),
    email: withTeam.email,
    permissions: permissionsFor(permissionRoleOf(withTeam)),
    locale,
    theme,
    defaultNotifyMode,
    mustChangePasswordServerIds: [
      ...(withTeam.mustChangePassword ? [PLATFORM_PASSWORD_RESET_ID] : []),
      ...pendingPwd.map((r) => r.serverId),
    ],
  };
}
