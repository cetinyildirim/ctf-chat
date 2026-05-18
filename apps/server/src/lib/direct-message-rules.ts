import type { Role } from '@sydt/shared';
import { isStaff } from '@sydt/shared';

type TeamUserLite = {
  role: Role;
  teamId: string | null;
};

/**
 * Operators may DM: same-team members, anyone on staff (moderators+), staff may DM anyone.
 * Cross-team DM between non-staff operators is forbidden.
 */
export function canUsersDirectMessage(a: TeamUserLite, b: TeamUserLite): boolean {
  if (isStaff(a.role) || isStaff(b.role)) return true;
  if (!a.teamId || !b.teamId) return false;
  return a.teamId === b.teamId;
}
