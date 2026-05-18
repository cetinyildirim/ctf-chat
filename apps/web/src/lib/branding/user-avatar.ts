import { teamBadgeDataUrl } from '@/lib/branding/logo-badges';

type TeamLite = { id: string; name: string; color: string };

/** Profile photo, else team-name badge on team color when the user has a team. */
export function resolveUserAvatarSrc(
  user: { avatarUrl?: string | null; team?: TeamLite | null },
): string | null | undefined {
  if (user.avatarUrl) return user.avatarUrl;
  if (user.team) return teamBadgeDataUrl(user.team.name, user.team.id, user.team.color);
  return null;
}
