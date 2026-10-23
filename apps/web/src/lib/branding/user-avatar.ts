type TeamLite = { id: string; name: string; color: string; logoUrl?: string | null };

/**
 * Personal avatar first, then an uploaded team logo. Without either the Avatar
 * fallback (initials on the team color) is used: the generated team badge is a
 * labelled square that becomes unreadable once cropped into a small circle.
 */
export function resolveUserAvatarSrc(
  user: { avatarUrl?: string | null; team?: TeamLite | null },
): string | null | undefined {
  if (user.avatarUrl) return user.avatarUrl;
  if (user.team?.logoUrl) return user.team.logoUrl;
  return null;
}

/** Corner team badge only adds information when the main image is a personal avatar. */
export function showsTeamCornerBadge(user: { avatarUrl?: string | null; team?: TeamLite | null }): boolean {
  return !!user.avatarUrl && !!user.team;
}
