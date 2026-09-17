/**
 * Ticket statistics for one competition, mounted at /api/servers/:id.
 *
 * Three views from the spec:
 * - `/tickets/stats`  organizer dashboard (§19) + live operations (§20)
 * - `/tickets/report` post-event reporting (§46-47)
 * Both require TICKET_VIEW_ALL: aggregates over other teams' tickets are
 * organizer data, even when no ticket body is exposed.
 */
import { Router } from 'express';
import { z } from 'zod';
import { Permission, TICKET_ACTIVE_STATUSES, TICKET_PRIORITIES, TICKET_STATUSES } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { Forbidden, NotFound } from '../../lib/http-error.js';
import { resolveTicketAccess } from '../tickets/ticket-access.js';
import { TICKET_INCLUDE } from '../tickets/ticket-access.js';
import { projectTicketList } from '../tickets/ticket-service.js';

const router: Router = Router({ mergeParams: true });
router.use(requireAuth);

const serverIdSchema = z.object({ id: z.string().cuid() });

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

/** Average of the given millisecond spans, in minutes; null when no samples. */
function averageMinutes(spans: number[]): number | null {
  if (spans.length === 0) return null;
  const total = spans.reduce((sum, span) => sum + span, 0);
  return Math.round(total / spans.length / 60_000);
}

router.get(
  '/tickets/stats',
  requirePermission(Permission.TICKET_VIEW_ALL),
  validate(serverIdSchema, 'params'),
  async (req, res, next) => {
    try {
      const serverId = req.params.id;
      if (!serverId) throw NotFound();
      const access = await resolveTicketAccess(req.user!, serverId);
      if (!access.canViewAll) throw Forbidden();

      const [byStatus, byPriority, byTeam, byChallenge, byCategory, byAssignee, recent] =
        await Promise.all([
          prisma.ticket.groupBy({ by: ['status'], where: { serverId }, _count: { _all: true } }),
          prisma.ticket.groupBy({ by: ['priority'], where: { serverId }, _count: { _all: true } }),
          prisma.ticket.groupBy({
            by: ['teamId'],
            where: { serverId, teamId: { not: null } },
            _count: { _all: true },
          }),
          prisma.ticket.groupBy({
            by: ['challengeId'],
            where: { serverId, challengeId: { not: null } },
            _count: { _all: true },
          }),
          prisma.ticket.groupBy({
            by: ['categoryId'],
            where: { serverId },
            _count: { _all: true },
          }),
          prisma.ticket.groupBy({
            by: ['assignedToId'],
            where: { serverId, assignedToId: { not: null } },
            _count: { _all: true },
          }),
          prisma.ticket.findMany({
            where: { serverId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: TICKET_INCLUDE,
          }),
        ]);

      // Live operations counters (spec §20): fresh arrivals per window.
      const [last5, last15, last30, unassignedActive] = await Promise.all([
        prisma.ticket.count({ where: { serverId, createdAt: { gte: minutesAgo(5) } } }),
        prisma.ticket.count({ where: { serverId, createdAt: { gte: minutesAgo(15) } } }),
        prisma.ticket.count({ where: { serverId, createdAt: { gte: minutesAgo(30) } } }),
        prisma.ticket.count({
          where: { serverId, assignedToId: null, status: { in: TICKET_ACTIVE_STATUSES } },
        }),
      ]);

      const teamIds = byTeam.map((t) => t.teamId!).filter(Boolean);
      const challengeIds = byChallenge.map((c) => c.challengeId!).filter(Boolean);
      const categoryIds = byCategory.map((c) => c.categoryId).filter((id): id is string => !!id);
      const assigneeIds = byAssignee.map((a) => a.assignedToId!).filter(Boolean);

      const [teams, challenges, categories, assignees] = await Promise.all([
        prisma.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true, color: true },
        }),
        prisma.challenge.findMany({
          where: { id: { in: challengeIds } },
          select: { id: true, title: true, category: true },
        }),
        prisma.ticketCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, key: true },
        }),
        prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, displayName: true },
        }),
      ]);

      const teamName = new Map(teams.map((t) => [t.id, t]));
      const challengeName = new Map(challenges.map((c) => [c.id, c]));
      const categoryMeta = new Map(categories.map((c) => [c.id, c]));
      const assigneeName = new Map(assignees.map((a) => [a.id, a.displayName]));

      const statusCounts = Object.fromEntries(
        TICKET_STATUSES.map((status) => [
          status,
          byStatus.find((row) => row.status === status)?._count._all ?? 0,
        ]),
      );
      const priorityCounts = Object.fromEntries(
        TICKET_PRIORITIES.map((priority) => [
          priority,
          byPriority.find((row) => row.priority === priority)?._count._all ?? 0,
        ]),
      );

      // Challenges reported by more than one team are the multi-team incidents.
      const multiTeamRows = await prisma.ticket.findMany({
        where: { serverId, challengeId: { not: null }, teamId: { not: null } },
        select: { challengeId: true, teamId: true },
      });
      const teamsPerChallenge = new Map<string, Set<string>>();
      for (const row of multiTeamRows) {
        const set = teamsPerChallenge.get(row.challengeId!) ?? new Set<string>();
        set.add(row.teamId!);
        teamsPerChallenge.set(row.challengeId!, set);
      }
      const multiTeam = [...teamsPerChallenge.entries()]
        .filter(([, teamSet]) => teamSet.size > 1)
        .map(([challengeId, teamSet]) => ({
          challengeId,
          challengeTitle: challengeName.get(challengeId)?.title ?? 'Unknown',
          teamCount: teamSet.size,
        }))
        .sort((a, b) => b.teamCount - a.teamCount)
        .slice(0, 10);

      res.json({
        total: Object.values(statusCounts).reduce((sum, n) => sum + n, 0),
        active: TICKET_ACTIVE_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0),
        statusCounts,
        priorityCounts,
        unassignedActive,
        arrivals: { last5, last15, last30 },
        perTeam: byTeam
          .map((row) => ({
            teamId: row.teamId!,
            name: teamName.get(row.teamId!)?.name ?? 'Unknown',
            color: teamName.get(row.teamId!)?.color ?? '#22d3ee',
            count: row._count._all,
          }))
          .sort((a, b) => b.count - a.count),
        perChallenge: byChallenge
          .map((row) => ({
            challengeId: row.challengeId!,
            title: challengeName.get(row.challengeId!)?.title ?? 'Unknown',
            category: challengeName.get(row.challengeId!)?.category ?? null,
            count: row._count._all,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15),
        perCategory: byCategory
          .map((row) => {
            const meta = row.categoryId ? categoryMeta.get(row.categoryId) : null;
            return {
              categoryId: row.categoryId,
              key: meta?.key ?? null,
              name: meta?.name ?? (row.categoryId ? 'Unknown' : 'Uncategorized'),
              count: row._count._all,
            };
          })
          .sort((a, b) => b.count - a.count),
        perAssignee: byAssignee
          .map((row) => ({
            userId: row.assignedToId!,
            name: assigneeName.get(row.assignedToId!) ?? 'Unknown',
            count: row._count._all,
          }))
          .sort((a, b) => b.count - a.count),
        multiTeam,
        recent: await projectTicketList(recent, access),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/tickets/report',
  requirePermission(Permission.TICKET_VIEW_ALL),
  validate(serverIdSchema, 'params'),
  async (req, res, next) => {
    try {
      const serverId = req.params.id;
      if (!serverId) throw NotFound();
      const access = await resolveTicketAccess(req.user!, serverId);
      if (!access.canViewAll) throw Forbidden();

      const tickets = await prisma.ticket.findMany({
        where: { serverId },
        select: {
          id: true,
          createdAt: true,
          firstResponseAt: true,
          resolvedAt: true,
          closedAt: true,
          reopenCount: true,
          status: true,
          priority: true,
          teamId: true,
        },
      });

      const firstResponse: number[] = [];
      const resolution: number[] = [];
      for (const t of tickets) {
        if (t.firstResponseAt) {
          firstResponse.push(t.firstResponseAt.getTime() - t.createdAt.getTime());
        }
        if (t.resolvedAt) {
          resolution.push(t.resolvedAt.getTime() - t.createdAt.getTime());
        }
      }

      // Ticket volume per hour, oldest first, for the timeline chart.
      const volume = new Map<string, number>();
      for (const t of tickets) {
        const bucket = new Date(t.createdAt);
        bucket.setMinutes(0, 0, 0);
        const key = bucket.toISOString();
        volume.set(key, (volume.get(key) ?? 0) + 1);
      }

      res.json({
        total: tickets.length,
        unresolved: tickets.filter((t) => TICKET_ACTIVE_STATUSES.includes(t.status as never))
          .length,
        closed: tickets.filter((t) => t.status === 'CLOSED').length,
        reopened: tickets.filter((t) => t.reopenCount > 0).length,
        critical: tickets.filter((t) => t.priority === 'CRITICAL').length,
        avgFirstResponseMinutes: averageMinutes(firstResponse),
        avgResolutionMinutes: averageMinutes(resolution),
        firstResponseSamples: firstResponse.length,
        resolutionSamples: resolution.length,
        timeline: [...volume.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([at, count]) => ({ at, count })),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
