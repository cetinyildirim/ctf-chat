import type { ScoreboardEntry, ScoreboardSnapshot, SolveTimelinePoint } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { serializeScoreboardEntry } from '../serializers.js';

interface PreviousRankMap {
  [teamId: string]: number;
}

let lastSnapshot: ScoreboardSnapshot | null = null;

export async function getScoreboard(): Promise<ScoreboardSnapshot> {
  const teams = await prisma.team.findMany({
    include: {
      _count: { select: { members: true } },
      solves: {
        select: { challenge: { select: { points: true } }, firstBlood: true, solvedAt: true },
        orderBy: { solvedAt: 'asc' },
      },
    },
  });
  const totalChallenges = await prisma.challenge.count({ where: { isReleased: true } });

  const previousRanks: PreviousRankMap = {};
  if (lastSnapshot) {
    for (const entry of lastSnapshot.entries) {
      previousRanks[entry.team.id] = entry.rank;
    }
  }

  const computed = teams.map((team) => {
    const score = team.solves.reduce((acc, s) => acc + (s.challenge?.points ?? 0), 0);
    const solveCount = team.solves.length;
    const bloodCount = team.solves.filter((s) => s.firstBlood).length;
    const lastSolveAt =
      team.solves.length > 0
        ? team.solves[team.solves.length - 1]?.solvedAt ?? null
        : null;
    return {
      team,
      score,
      solveCount,
      bloodCount,
      lastSolveAt,
      memberCount: team._count.members,
    };
  });

  computed.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.lastSolveAt && b.lastSolveAt) {
      return a.lastSolveAt.getTime() - b.lastSolveAt.getTime();
    }
    return 0;
  });

  const entries: ScoreboardEntry[] = computed.map((row, idx) => {
    const rank = idx + 1;
    const previousRank = previousRanks[row.team.id] ?? null;
    return serializeScoreboardEntry(row.team as unknown as Record<string, unknown>, {
      rank,
      previousRank,
      score: row.score,
      solveCount: row.solveCount,
      bloodCount: row.bloodCount,
      lastSolveAt: row.lastSolveAt,
      memberCount: row.memberCount,
    });
  });

  const snap: ScoreboardSnapshot = {
    generatedAt: new Date().toISOString(),
    entries,
    totalChallenges,
    totalTeams: entries.length,
  };
  lastSnapshot = snap;
  return snap;
}

export async function getSolveTimeline(limit = 200): Promise<SolveTimelinePoint[]> {
  const solves = await prisma.solve.findMany({
    orderBy: { solvedAt: 'asc' },
    take: limit,
    include: { challenge: { select: { points: true } } },
  });
  return solves.map((s) => ({
    at: s.solvedAt.toISOString(),
    teamId: s.teamId,
    challengeId: s.challengeId,
    points: s.challenge?.points ?? 0,
    firstBlood: s.firstBlood,
  }));
}

export function getCachedSnapshot(): ScoreboardSnapshot | null {
  return lastSnapshot;
}

export async function getServerScoreboard(serverId: string): Promise<ScoreboardSnapshot> {
  const serverChannels = await prisma.channel.findMany({
    where: { serverId, challengeId: { not: null } },
    select: { challengeId: true },
  });
  const serverChallengeIds = serverChannels
    .map((c) => c.challengeId)
    .filter((id): id is string => !!id);

  const teams = await prisma.team.findMany({
    where: { serverId },
    include: {
      _count: { select: { members: true } },
      solves: {
        where: { challengeId: { in: serverChallengeIds } },
        select: { challenge: { select: { points: true } }, firstBlood: true, solvedAt: true },
        orderBy: { solvedAt: 'asc' },
      },
    },
  });

  const totalChallenges = serverChallengeIds.length;

  const computed = teams.map((team) => {
    const score = team.solves.reduce((acc, s) => acc + (s.challenge?.points ?? 0), 0);
    const solveCount = team.solves.length;
    const bloodCount = team.solves.filter((s) => s.firstBlood).length;
    const lastSolveAt =
      team.solves.length > 0 ? (team.solves[team.solves.length - 1]?.solvedAt ?? null) : null;
    return { team, score, solveCount, bloodCount, lastSolveAt, memberCount: team._count.members };
  });

  computed.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.lastSolveAt && b.lastSolveAt) return a.lastSolveAt.getTime() - b.lastSolveAt.getTime();
    return 0;
  });

  const entries: ScoreboardEntry[] = computed.map((row, idx) =>
    serializeScoreboardEntry(row.team as unknown as Record<string, unknown>, {
      rank: idx + 1,
      previousRank: null,
      score: row.score,
      solveCount: row.solveCount,
      bloodCount: row.bloodCount,
      lastSolveAt: row.lastSolveAt,
      memberCount: row.memberCount,
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    entries,
    totalChallenges,
    totalTeams: entries.length,
  };
}

export async function getServerSolveTimeline(serverId: string, limit = 500): Promise<SolveTimelinePoint[]> {
  const serverChallengeIds = (
    await prisma.channel.findMany({
      where: { serverId, challengeId: { not: null } },
      select: { challengeId: true },
    })
  )
    .map((c) => c.challengeId)
    .filter((id): id is string => !!id);

  const solves = await prisma.solve.findMany({
    where: {
      team: { serverId },
      challengeId: { in: serverChallengeIds },
    },
    orderBy: { solvedAt: 'asc' },
    take: limit,
    include: { challenge: { select: { points: true } } },
  });
  return solves.map((s) => ({
    at: s.solvedAt.toISOString(),
    teamId: s.teamId,
    challengeId: s.challengeId,
    points: s.challenge?.points ?? 0,
    firstBlood: s.firstBlood,
  }));
}
