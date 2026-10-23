import type { Role } from '@sydt/shared';
import { isAdmin, isStaff } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { NotFound, Forbidden } from '../../lib/http-error.js';
import { getUserTeamOnServer } from '../../lib/team-membership.js';
import { permissionRoleOf } from '../../lib/user-role.js';
import { getEffectiveServerPermissions } from '../../lib/server-permissions.js';

export async function loadChannel(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { category: true },
  });
  if (!channel) throw NotFound('Channel not found');
  return channel;
}

/**
 * Resolve the viewer's team for this channel's competition.
 * Prefer ServerTeamMember over legacy global User.teamId.
 */
export async function resolveChannelTeamId(
  userId: string,
  channel: { serverId: string | null },
  fallbackTeamId: string | null = null,
): Promise<string | null> {
  if (!channel.serverId) return fallbackTeamId;
  const team = await getUserTeamOnServer(prisma, userId, channel.serverId);
  return team?.id ?? null;
}

/** Server-role grants that open channels otherwise reserved for platform staff. */
export type ChannelVisibilityGrants = { staff: boolean; team: boolean; private: boolean };

const NO_GRANTS: ChannelVisibilityGrants = { staff: false, team: false, private: false };

export async function serverChannelGrants(userId: string, serverId: string): Promise<ChannelVisibilityGrants> {
  const perms = await getEffectiveServerPermissions(userId, serverId);
  return {
    staff: perms.has('viewStaffChannels'),
    team: perms.has('viewTeamChannels'),
    private: perms.has('viewPrivateChannels'),
  };
}

function isStaffOnlyChannelType(type: string): boolean {
  return type === 'STAFF_COORD' || type === 'ORGANIZER_INTERNAL' || type === 'LOGS' || type === 'INCIDENT';
}

export async function assertCanAccessChannel(
  channel: Awaited<ReturnType<typeof loadChannel>>,
  user: { id: string; role: Role; teamId: string | null },
): Promise<void> {
  if (channel.type === 'DIRECT_MESSAGE') {
    const p = await prisma.channelDmParticipant.findUnique({
      where: { channelId_userId: { channelId: channel.id, userId: user.id } },
    });
    if (!p) throw Forbidden('Not allowed');
    return;
  }

  if (channel.serverId) {
    if (!isAdmin(user.role)) {
      const member = await prisma.serverMember.findUnique({
        where: { userId_serverId: { userId: user.id, serverId: channel.serverId } },
        select: { bannedAt: true, user: { select: { isBanned: true } } },
      });
      if (!member) throw Forbidden('Not a member of this server');
      if (member.user.isBanned) throw Forbidden('Account suspended');
      if (member.bannedAt) throw Forbidden('Banned from this server');
    }
  }

  const staff = isStaff(user.role);
  let grants: ChannelVisibilityGrants | null = null;
  const getGrants = async (): Promise<ChannelVisibilityGrants> => {
    if (!grants) {
      grants = channel.serverId && !staff ? await serverChannelGrants(user.id, channel.serverId) : NO_GRANTS;
    }
    return grants;
  };

  if ((isStaffOnlyChannelType(channel.type) || channel.category?.staffOnly) && !staff) {
    if (!(await getGrants()).staff) throw Forbidden();
  }

  const effectiveTeamId = await resolveChannelTeamId(user.id, channel, user.teamId);

  const categoryTeamId = (channel.category as { teamId?: string | null } | null)?.teamId ?? null;
  if (categoryTeamId) {
    if (staff) return;
    if (effectiveTeamId === categoryTeamId) return;
    if ((await getGrants()).team) return;
    throw Forbidden();
  }

  if (channel.isPrivate) {
    if (staff) return;
    if (channel.teamId && channel.teamId === effectiveTeamId) return;
    if ((await getGrants()).private) return;
    throw Forbidden();
  }
}

/** Non-throwing access check for mention fanout / suggest filtering. */
export async function userCanAccessChannel(
  channel: Awaited<ReturnType<typeof loadChannel>>,
  userId: string,
): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, platformRole: true, teamId: true, isBanned: true },
  });
  if (!row || row.isBanned) return false;
  try {
    await assertCanAccessChannel(channel, {
      id: row.id,
      role: permissionRoleOf(row),
      teamId: row.teamId,
    });
    return true;
  } catch {
    return false;
  }
}

/** List filter after server membership (or platform admin) is verified. */
export function canViewChannelInList(
  channel: {
    type: string;
    isPrivate: boolean;
    teamId: string | null;
    category?: { staffOnly?: boolean; teamId?: string | null } | null;
  },
  user: { role: Role; teamId: string | null; grants?: ChannelVisibilityGrants },
): boolean {
  if (channel.type === 'DIRECT_MESSAGE') return false;

  const staff = isStaff(user.role);
  const grants = user.grants ?? NO_GRANTS;
  if ((isStaffOnlyChannelType(channel.type) || channel.category?.staffOnly) && !staff && !grants.staff) {
    return false;
  }

  if (channel.category?.teamId) {
    if (staff || grants.team) return true;
    return channel.category.teamId === user.teamId;
  }

  if (channel.isPrivate) {
    if (staff || grants.private) return true;
    if (channel.teamId && channel.teamId === user.teamId) return true;
    return false;
  }
  return true;
}
