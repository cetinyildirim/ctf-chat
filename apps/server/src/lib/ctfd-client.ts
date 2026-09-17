import { assertSafeOutboundUrl } from './url-safety.js';

export type CtfdScoreboardRow = {
  team_id?: number;
  account_id?: number;
  name?: string;
  score?: number;
  place?: number;
  pos?: number;
  solves?: number;
};

export type CtfdTeamStats = {
  place: number | null;
  score: number;
  solves: number | null;
  name: string | null;
};

export type CtfdScoreboardEntry = {
  place: number;
  ctfdTeamId: number | null;
  name: string;
  score: number;
  solves: number | null;
};

const teamStatsCache = new Map<string, { at: number; data: CtfdTeamStats | null }>();
const boardCache = new Map<string, { at: number; rows: CtfdScoreboardRow[] | null }>();
const statsCache = new Map<string, { at: number; data: CtfdAdminStats | null }>();
const CACHE_MS = 60_000;

export type CtfdAdminStats = {
  available: boolean;
  challengeCount: number;
  totalSolves: number;
  registeredTeams: number | null;
  challengeSolves: Array<{ id: number; name: string; solves: number }>;
  categories: Array<{ name: string; solves: number }>;
};

type CtfdApiEnvelope<T> = { success?: boolean; data?: T };

type CtfdChallengeListRow = {
  id: number;
  name: string;
  category?: string;
  solves?: number | null;
};

type CtfdFetchMeta = {
  challengesOk: boolean;
  statisticsOk: boolean;
  publicSolvesOk: boolean;
};

const STATS_FAIL_CACHE_MS = 15_000;
const CHALLENGE_SOLVE_FETCH_LIMIT = 120;
const CHALLENGE_SOLVE_CONCURRENCY = 12;

function emptyStats(): CtfdAdminStats {
  return {
    available: false,
    challengeCount: 0,
    totalSolves: 0,
    registeredTeams: null,
    challengeSolves: [],
    categories: [],
  };
}

export function invalidateCtfdCaches(): void {
  teamStatsCache.clear();
  boardCache.clear();
  statsCache.clear();
}

/** CTFd integration is active only when both URL and API token are saved. */
export function isCtfdConfigured(
  server:
    | {
        ctfdBaseUrl: string | null | undefined;
        ctfdAccessToken: string | null | undefined;
      }
    | null
    | undefined,
): server is { ctfdBaseUrl: string; ctfdAccessToken: string | null } {
  return !!(server?.ctfdBaseUrl?.trim() && server.ctfdAccessToken?.trim());
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function parseScoreboardPayload(json: { data?: CtfdScoreboardRow[] } | CtfdScoreboardRow[]): CtfdScoreboardRow[] {
  return Array.isArray(json) ? json : (json.data ?? []);
}

async function fetchScoreboardRows(
  baseUrl: string,
  accessToken: string | null | undefined,
): Promise<CtfdScoreboardRow[] | null> {
  if (!accessToken?.trim()) return null;

  const cacheKey = `${baseUrl}:${accessToken.trim()}`;
  const hit = boardCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rows;

  const rows = await ctfdGetJson(baseUrl, accessToken, '/api/v1/scoreboard', (json) => {
    const payload = json as { data?: CtfdScoreboardRow[] } | CtfdScoreboardRow[];
    return parseScoreboardPayload(payload);
  }, { requireToken: true });

  boardCache.set(cacheKey, { at: Date.now(), rows });
  return rows;
}

async function ctfdGetJson<T>(
  baseUrl: string,
  accessToken: string | null | undefined,
  path: string,
  parse: (json: unknown) => T | null,
  opts?: { requireToken?: boolean },
): Promise<T | null> {
  if (opts?.requireToken && !accessToken?.trim()) return null;

  try {
    const root = normalizeBaseUrl(await assertSafeOutboundUrl(baseUrl));
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (accessToken?.trim()) headers.Authorization = `Token ${accessToken.trim()}`;

    const res = await fetch(`${root}${path}`, { headers, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;

    const json = (await res.json()) as unknown;
    return parse(json);
  } catch {
    return null;
  }
}

function parseCtfdChallengeList(json: unknown): CtfdChallengeListRow[] | null {
  const env = json as CtfdApiEnvelope<CtfdChallengeListRow[]>;
  if (!Array.isArray(env.data)) return null;
  return env.data
    .filter((row) => row && typeof row.id === 'number' && typeof row.name === 'string')
    .map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      solves: row.solves,
    }));
}

async function fetchCtfdChallengeList(
  baseUrl: string,
  accessToken: string | null | undefined,
): Promise<{ rows: CtfdChallengeListRow[] | null; ok: boolean }> {
  const attempts: Array<{ path: string; token: string | null | undefined }> = [];
  if (accessToken?.trim()) {
    attempts.push({ path: '/api/v1/challenges?view=admin', token: accessToken });
    attempts.push({ path: '/api/v1/challenges', token: accessToken });
  }
  attempts.push({ path: '/api/v1/challenges', token: null });

  for (const { path, token } of attempts) {
    const rows = await ctfdGetJson(baseUrl, token, path, parseCtfdChallengeList);
    if (rows?.length) return { rows, ok: true };
    if (rows && rows.length === 0) return { rows, ok: true };
  }

  return { rows: null, ok: false };
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const part = await Promise.all(batch.map((item) => fn(item)));
    out.push(...part);
  }
  return out;
}

async function enrichChallengesWithPublicSolveCounts(
  baseUrl: string,
  accessToken: string | null | undefined,
  challenges: CtfdChallengeListRow[],
): Promise<{ rows: CtfdChallengeListRow[]; ok: boolean }> {
  const slice = challenges.slice(0, CHALLENGE_SOLVE_FETCH_LIMIT);
  let anyOk = false;

  const enriched = await mapPool(slice, CHALLENGE_SOLVE_CONCURRENCY, async (ch) => {
    if (typeof ch.solves === 'number') return ch;

    const detail = await ctfdGetJson(
      baseUrl,
      accessToken,
      `/api/v1/challenges/${ch.id}`,
      (json) => {
        const env = json as CtfdApiEnvelope<{ solves?: number | null; category?: string }>;
        return env.data ?? null;
      },
    );
    if (detail && typeof detail.solves === 'number') {
      anyOk = true;
      return {
        ...ch,
        solves: detail.solves,
        category: detail.category ?? ch.category,
      };
    }

    const solveCount = await ctfdGetJson(
      baseUrl,
      accessToken,
      `/api/v1/challenges/${ch.id}/solves`,
      (json) => {
        const env = json as CtfdApiEnvelope<unknown[]>;
        return Array.isArray(env.data) ? env.data.length : null;
      },
    );
    if (typeof solveCount === 'number') {
      anyOk = true;
      return { ...ch, solves: solveCount };
    }

    return { ...ch, solves: 0 };
  });

  return { rows: enriched, ok: anyOk };
}

function buildStatsFromChallenges(challenges: CtfdChallengeListRow[]): {
  challengeSolves: Array<{ id: number; name: string; solves: number }>;
  categories: Array<{ name: string; solves: number }>;
  totalSolves: number;
} {
  const challengeSolves = challenges
    .map((c) => ({
      id: c.id,
      name: c.name,
      solves: typeof c.solves === 'number' ? c.solves : 0,
    }))
    .sort((a, b) => b.solves - a.solves);

  const categorySolves: Record<string, number> = {};
  for (const ch of challenges) {
    const solves = typeof ch.solves === 'number' ? ch.solves : 0;
    const cat = (ch.category ?? 'Misc').trim() || 'Misc';
    categorySolves[cat] = (categorySolves[cat] ?? 0) + solves;
  }

  const categories = Object.entries(categorySolves)
    .map(([name, solves]) => ({ name, solves }))
    .sort((a, b) => b.solves - a.solves);

  const totalSolves = challengeSolves.reduce((acc, c) => acc + c.solves, 0);

  return { challengeSolves, categories, totalSolves };
}

export async function fetchCtfdAdminStats(
  baseUrl: string,
  accessToken: string | null | undefined,
): Promise<CtfdAdminStats> {
  const cacheKey = `${baseUrl}:${accessToken?.trim() ?? ''}:stats`;
  const hit = statsCache.get(cacheKey);
  if (hit) {
    const ttl = hit.data?.available ? CACHE_MS : STATS_FAIL_CACHE_MS;
    if (Date.now() - hit.at < ttl) return hit.data ?? emptyStats();
  }

  const unavailable = emptyStats();
  if (!accessToken?.trim()) {
    statsCache.set(cacheKey, { at: Date.now(), data: unavailable });
    return unavailable;
  }

  const [challengeListResult, challengeSolvesRaw, teamStatsRaw, categoryStatsRaw] = await Promise.all([
    fetchCtfdChallengeList(baseUrl, accessToken),
    ctfdGetJson(baseUrl, accessToken, '/api/v1/statistics/challenges/solves', (json) => {
      const env = json as CtfdApiEnvelope<Array<{ id: number; name: string; solves: number }>>;
      return Array.isArray(env.data) ? env.data : null;
    }, { requireToken: true }),
    ctfdGetJson(baseUrl, accessToken, '/api/v1/statistics/teams', (json) => {
      const env = json as CtfdApiEnvelope<{ registered?: number }>;
      return env.data ?? null;
    }, { requireToken: true }),
    ctfdGetJson(baseUrl, accessToken, '/api/v1/statistics/challenges/categories', (json) => {
      const env = json as CtfdApiEnvelope<Record<string, number>>;
      if (!env.data || typeof env.data !== 'object') return null;
      return Object.entries(env.data)
        .map(([name, solves]) => ({ name, solves: Number(solves) || 0 }))
        .sort((a, b) => b.solves - a.solves);
    }, { requireToken: true }),
  ]);

  let challengesRaw = challengeListResult.rows;
  const meta: CtfdFetchMeta = {
    challengesOk: challengeListResult.ok,
    statisticsOk: !!challengeSolvesRaw?.length,
    publicSolvesOk: false,
  };

  if (challengesRaw?.length && !challengesRaw.some((c) => typeof c.solves === 'number')) {
    const enriched = await enrichChallengesWithPublicSolveCounts(baseUrl, accessToken, challengesRaw);
    challengesRaw = enriched.rows;
    meta.publicSolvesOk = enriched.ok;
  }

  let challengeSolves: Array<{ id: number; name: string; solves: number }> = [];
  let categories: Array<{ name: string; solves: number }> = [];
  let totalSolves = 0;
  let challengeCount = 0;

  const challengesWithSolves = challengesRaw?.some((c) => typeof c.solves === 'number') ?? false;

  if (challengesRaw?.length && challengesWithSolves) {
    const built = buildStatsFromChallenges(challengesRaw);
    challengeSolves = built.challengeSolves;
    categories = built.categories;
    totalSolves = built.totalSolves;
    challengeCount = challengesRaw.length;
  } else if (challengeSolvesRaw?.length) {
    meta.statisticsOk = true;
    challengeSolves = challengeSolvesRaw
      .map((c) => ({ id: c.id, name: c.name, solves: c.solves ?? 0 }))
      .sort((a, b) => b.solves - a.solves);
    totalSolves = challengeSolves.reduce((acc, c) => acc + c.solves, 0);
    challengeCount = challengeSolves.length;

    const categoryByChallengeId = new Map<number, string>();
    for (const ch of challengesRaw ?? []) {
      categoryByChallengeId.set(ch.id, (ch.category ?? 'Misc').trim() || 'Misc');
    }

    const categorySolves: Record<string, number> = {};
    for (const ch of challengeSolves) {
      const cat = categoryByChallengeId.get(ch.id) ?? 'Misc';
      categorySolves[cat] = (categorySolves[cat] ?? 0) + ch.solves;
    }
    categories = Object.entries(categorySolves)
      .map(([name, solves]) => ({ name, solves }))
      .sort((a, b) => b.solves - a.solves);
  } else if (challengesRaw?.length) {
    challengeCount = challengesRaw.length;
    challengeSolves = challengesRaw
      .map((c) => ({ id: c.id, name: c.name, solves: typeof c.solves === 'number' ? c.solves : 0 }))
      .sort((a, b) => b.solves - a.solves);
    const built = buildStatsFromChallenges(challengesRaw);
    categories = built.categories;
    totalSolves = built.totalSolves;
  }

  if (categoryStatsRaw?.length && !categories.length) {
    categories = categoryStatsRaw;
    if (!totalSolves) totalSolves = categoryStatsRaw.reduce((acc, c) => acc + c.solves, 0);
  }

  if (!challengeCount && !challengeSolvesRaw?.length && !challengesRaw?.length) {
    statsCache.set(cacheKey, { at: Date.now(), data: unavailable });
    return unavailable;
  }

  const hasSolveData = totalSolves > 0 || challengesWithSolves || !!challengeSolvesRaw?.length || meta.publicSolvesOk;

  const result: CtfdAdminStats = {
    available: challengeCount > 0 && (hasSolveData || meta.challengesOk),
    challengeCount,
    totalSolves,
    registeredTeams: teamStatsRaw?.registered ?? null,
    challengeSolves: challengeSolves.slice(0, 30),
    categories,
  };

  statsCache.set(cacheKey, { at: Date.now(), data: result });
  return result;
}

export async function fetchCtfdTeamStats(
  baseUrl: string,
  accessToken: string | null | undefined,
  opts: { ctfdTeamId?: number | null; teamName: string },
): Promise<CtfdTeamStats | null> {
  const key = `${baseUrl}:${opts.ctfdTeamId ?? ''}:${opts.teamName.toLowerCase()}`;
  const hit = teamStatsCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const rows = await fetchScoreboardRows(baseUrl, accessToken);
  if (!rows) {
    teamStatsCache.set(key, { at: Date.now(), data: null });
    return null;
  }

  let row: CtfdScoreboardRow | undefined;
  const accountId = opts.ctfdTeamId;
  if (accountId != null) {
    row = rows.find((r) => r.account_id === accountId || r.team_id === accountId);
  }
  if (!row) {
    const nameLower = opts.teamName.trim().toLowerCase();
    row = rows.find((r) => (r.name ?? '').trim().toLowerCase() === nameLower);
  }

  const stats: CtfdTeamStats | null = row
    ? {
        place: row.place ?? null,
        score: row.score ?? 0,
        solves: row.solves ?? null,
        name: row.name ?? null,
      }
    : null;

  teamStatsCache.set(key, { at: Date.now(), data: stats });
  return stats;
}

export async function fetchCtfdScoreboard(
  baseUrl: string,
  accessToken: string | null | undefined,
): Promise<CtfdScoreboardEntry[] | null> {
  const rows = await fetchScoreboardRows(baseUrl, accessToken);
  if (!rows) return null;

  const entries = rows
    .map((row, idx) => ({
      place: row.pos ?? row.place ?? idx + 1,
      ctfdTeamId: row.account_id ?? row.team_id ?? null,
      name: (row.name ?? '').trim() || `Team ${row.account_id ?? row.team_id ?? idx + 1}`,
      score: row.score ?? 0,
      solves: row.solves ?? null,
    }))
    .sort((a, b) => {
      if (a.place !== b.place) return a.place - b.place;
      return b.score - a.score;
    });

  return entries.map((entry, idx) => ({ ...entry, place: entry.place || idx + 1 }));
}

export function ctfdScoreboardUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/scoreboard`;
}

export type CtfdConnectionTestResult = {
  ok: boolean;
  teamCount: number | null;
  statsAvailable: boolean;
  statsChallengeCount: number | null;
  code: 'success' | 'auth_failed' | 'unreachable' | 'invalid_url' | 'token_required' | 'error';
};

export async function testCtfdConnection(
  baseUrl: string,
  accessToken: string | null | undefined,
): Promise<CtfdConnectionTestResult> {
  const token = accessToken?.trim();
  if (!token) {
    return {
      ok: false,
      teamCount: null,
      statsAvailable: false,
      statsChallengeCount: null,
      code: 'token_required',
    };
  }

  try {
    const root = normalizeBaseUrl(await assertSafeOutboundUrl(baseUrl));
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Token ${token}`,
    };

    const res = await fetch(`${root}/api/v1/scoreboard`, {
      headers,
      signal: AbortSignal.timeout(12_000),
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, teamCount: null, statsAvailable: false, statsChallengeCount: null, code: 'auth_failed' };
    }
    if (!res.ok) {
      return { ok: false, teamCount: null, statsAvailable: false, statsChallengeCount: null, code: 'unreachable' };
    }

    const json = (await res.json()) as { data?: CtfdScoreboardRow[] } | CtfdScoreboardRow[];
    const rows = parseScoreboardPayload(json);
    const cacheKey = `${baseUrl}:${token}`;
    boardCache.set(cacheKey, { at: Date.now(), rows });

    return {
      ok: true,
      teamCount: rows.length,
      statsAvailable: false,
      statsChallengeCount: null,
      code: 'success',
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('URL')) {
      return { ok: false, teamCount: null, statsAvailable: false, statsChallengeCount: null, code: 'invalid_url' };
    }
    return { ok: false, teamCount: null, statsAvailable: false, statsChallengeCount: null, code: 'error' };
  }
}
