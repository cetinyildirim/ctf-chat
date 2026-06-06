import { assertSafeOutboundUrl } from './url-safety.js';

export type CtfdScoreboardRow = {
  team_id?: number;
  name?: string;
  score?: number;
  place?: number;
  solves?: number;
};

export type CtfdTeamStats = {
  place: number | null;
  score: number;
  solves: number | null;
  name: string | null;
};

const cache = new Map<string, { at: number; data: CtfdTeamStats | null }>();
const CACHE_MS = 60_000;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function fetchCtfdTeamStats(
  baseUrl: string,
  accessToken: string | null | undefined,
  opts: { ctfdTeamId?: number | null; teamName: string },
): Promise<CtfdTeamStats | null> {
  const key = `${baseUrl}:${opts.ctfdTeamId ?? ''}:${opts.teamName.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const root = normalizeBaseUrl(await assertSafeOutboundUrl(baseUrl));
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken?.trim()) headers.Authorization = `Token ${accessToken.trim()}`;

  const res = await fetch(`${root}/api/v1/scoreboard`, { headers, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) {
    cache.set(key, { at: Date.now(), data: null });
    return null;
  }

  const json = (await res.json()) as { data?: CtfdScoreboardRow[] } | CtfdScoreboardRow[];
  const rows = Array.isArray(json) ? json : (json.data ?? []);

  let row: CtfdScoreboardRow | undefined;
  if (opts.ctfdTeamId != null) {
    row = rows.find((r) => r.team_id === opts.ctfdTeamId);
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

  cache.set(key, { at: Date.now(), data: stats });
  return stats;
}

export function ctfdScoreboardUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/scoreboard`;
}
