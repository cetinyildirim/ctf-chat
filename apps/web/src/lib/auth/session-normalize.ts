import type { SessionUser } from '@sydt/shared';

export function normalizeSessionUser(user: SessionUser): SessionUser {
  let defaultNotifyMode: SessionUser['defaultNotifyMode'] = 'ALL';
  if (user.defaultNotifyMode === 'MENTIONS_ONLY') defaultNotifyMode = 'MENTIONS_ONLY';
  else if (user.defaultNotifyMode === 'NONE') defaultNotifyMode = 'NONE';

  return {
    ...user,
    locale: user.locale ?? 'tr',
    theme: user.theme === 'light' ? 'light' : 'dark',
    defaultNotifyMode,
  };
}
