/**
 * Ticket authorization. This is the single source of truth for team isolation:
 * every REST handler, socket emit and attachment download must go through it.
 *
 * Rules (see also the CTF ticket spec):
 * - A ticket always belongs to exactly one competition (`serverId`).
 * - A viewer must be a non-banned member of that competition; platform admins
 *   are the only exception.
 * - Organizers (TICKET_VIEW_ALL) see every ticket of competitions they belong to.
 * - Competitors see tickets they opened plus their own team's tickets, where the
 *   team is resolved from `ServerTeamMember` for that competition - never from
 *   the legacy global `User.teamId`.
 * - Unauthorized access is reported as 404, not 403, so ticket ids and codes
 *   cannot be enumerated.
 */
import { Permission, can, type Role } from '@sydt/shared';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../middleware/auth.js';
import { prisma } from '../../prisma.js';
import { Forbidden, NotFound } from '../../lib/http-error.js';
import { getUserTeamOnServer } from '../../lib/team-membership.js';

export const TICKET_INCLUDE = {
  openedBy: { include: { team: true } },
  assignedTo: { include: { team: true } },
  team: true,
  category: true,
  challenge: { select: { id: true, title: true, category: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.TicketInclude;

export type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof TICKET_INCLUDE }>;

export interface TicketAccess {
  viewerId: string;
  serverId: string;
  /** The viewer's team inside this competition, or null (organizers, spectators). */
  teamId: string | null;
  /** Sees every ticket in the competition. */
  canViewAll: boolean;
  /** Sees teammates' tickets, not just their own. */
  canViewTeam: boolean;
  canSeeInternal: boolean;
  canAssign: boolean;
  canClaim: boolean;
  canManageFields: boolean;
  isPlatformAdmin: boolean;
}

function permissions(role: Role) {
  return {
    canViewAll: can(role, Permission.TICKET_VIEW_ALL),
    canViewTeam: can(role, Permission.TICKET_VIEW_TEAM),
    canSeeInternal: can(role, Permission.TICKET_INTERNAL_NOTE),
    canAssign: can(role, Permission.TICKET_ASSIGN),
    canClaim: can(role, Permission.TICKET_CLAIM),
    canManageFields: can(role, Permission.TICKET_RESOLVE),
    isPlatformAdmin: can(role, Permission.ADMIN_DASHBOARD),
  };
}

/**
 * Resolves what the viewer may do inside one competition.
 * Throws NotFound when the competition does not exist or the viewer is not a
 * member of it, so probing server ids leaks nothing.
 */
export async function resolveTicketAccess(
  user: AuthUser,
  serverId: string,
): Promise<TicketAccess> {
  const perms = permissions(user.role);

  const server = await prisma.chatServer.findUnique({
    where: { id: serverId },
    select: { id: true },
  });
  if (!server) throw NotFound();

  if (!perms.isPlatformAdmin) {
    const member = await prisma.serverMember.findUnique({
      where: { userId_serverId: { userId: user.id, serverId } },
      select: { bannedAt: true },
    });
    if (!member || member.bannedAt) throw NotFound();
  }

  const team = await getUserTeamOnServer(prisma, user.id, serverId);

  return { viewerId: user.id, serverId, teamId: team?.id ?? null, ...perms };
}

/**
 * Mandatory `where` fragment for every ticket query. Callers merge their own
 * filters on top; the scope clause can never be widened from the request.
 */
export function ticketScopeWhere(access: TicketAccess): Prisma.TicketWhereInput {
  if (access.canViewAll) return { serverId: access.serverId };

  const or: Prisma.TicketWhereInput[] = [{ openedById: access.viewerId }];
  if (access.canViewTeam && access.teamId) or.push({ teamId: access.teamId });
  return { serverId: access.serverId, OR: or };
}

/** Loads a ticket the viewer is allowed to see, or throws NotFound. */
export async function loadAccessibleTicket(
  ticketId: string,
  user: AuthUser,
): Promise<{ ticket: TicketWithRelations; access: TicketAccess }> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: TICKET_INCLUDE,
  });
  if (!ticket) throw NotFound('Ticket not found');

  const access = await resolveTicketAccess(user, ticket.serverId);
  assertTicketVisible(ticket, access);
  return { ticket, access };
}

/** Pure visibility check; `access` must already be scoped to the ticket's server. */
export function assertTicketVisible(
  ticket: { serverId: string; openedById: string; teamId: string | null },
  access: TicketAccess,
): void {
  if (ticket.serverId !== access.serverId) throw NotFound('Ticket not found');
  if (access.canViewAll) return;
  if (ticket.openedById === access.viewerId) return;
  if (access.canViewTeam && access.teamId && ticket.teamId === access.teamId) return;
  throw NotFound('Ticket not found');
}

/** Competitors may only reply on tickets they can see; organizers always may. */
export function assertCanReply(
  ticket: { status: string },
  access: TicketAccess,
  internal: boolean,
): void {
  if (internal && !access.canSeeInternal) {
    throw Forbidden('Only organizers may post internal notes');
  }
  if (!access.canViewAll && ticket.status === 'CLOSED') {
    throw Forbidden('Ticket is closed');
  }
}
