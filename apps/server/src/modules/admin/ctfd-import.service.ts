import { parse } from 'csv-parse/sync';
import { nanoid } from 'nanoid';
import { prisma } from '../../prisma.js';
import { emitChannelsRefresh } from '../../realtime/broadcasters.js';
import type { Prisma } from '@prisma/client';

const DUMMY_FLAG = 'ctfd-import-not-used-in-chat';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export type NormRow = {
  id?: string;
  name: string;
  category: string;
  description: string;
  value: string;
  state: string;
};

function normalizeRecords(rows: Record<string, string>[]): NormRow[] {
  const out: NormRow[] = [];
  for (const raw of rows) {
    const n: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const key = k.trim().toLowerCase();
      n[key] = typeof v === 'string' ? v : String(v ?? '');
    }
    const name = (n.name ?? n.title ?? '').trim();
    if (!name) continue;
    out.push({
      id: (n.id ?? '').trim() || undefined,
      name,
      category: (n.category ?? 'General').trim() || 'General',
      description: (n.description ?? '').trim(),
      value: (n.value ?? n.points ?? '0').trim(),
      state: (n.state ?? 'visible').trim().toLowerCase(),
    });
  }
  return out;
}

export function parseChallengesFromCsv(csvText: string): NormRow[] {
  try {
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];
    return normalizeRecords(records);
  } catch {
    return [];
  }
}

export function challengeRowKey(row: NormRow): string {
  return row.id ? `id:${row.id}` : `${row.category}::${row.name}`;
}

export interface CtfdChallengesPreviewChannel {
  key: string;
  name: string;
  category: string;
  description: string;
  value: string;
  state: string;
  ctfdId?: string;
}

export interface CtfdChallengesPreviewCategory {
  key: string;
  name: string;
  channels: CtfdChallengesPreviewChannel[];
}

export interface CtfdChallengesPreview {
  categories: CtfdChallengesPreviewCategory[];
  totalCategories: number;
  totalChannels: number;
}

export function previewCtfdChallengesCsv(csvText: string): CtfdChallengesPreview {
  const rows = parseChallengesFromCsv(csvText);
  const byCat = new Map<string, NormRow[]>();
  for (const row of rows) {
    const list = byCat.get(row.category) ?? [];
    list.push(row);
    byCat.set(row.category, list);
  }

  const categories: CtfdChallengesPreviewCategory[] = [...byCat.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, catRows]) => ({
      key: name,
      name,
      channels: catRows.map((r) => ({
        key: challengeRowKey(r),
        name: r.name,
        category: r.category,
        description: r.description,
        value: r.value,
        state: r.state,
        ctfdId: r.id,
      })),
    }));

  return {
    categories,
    totalCategories: categories.length,
    totalChannels: rows.length,
  };
}

export function challengeItemToRow(item: {
  name: string;
  category: string;
  description: string;
  value: string;
  state: string;
  ctfdId?: string;
}): NormRow {
  return {
    id: item.ctfdId,
    name: item.name,
    category: item.category,
    description: item.description,
    value: item.value,
    state: item.state,
  };
}

export interface CtfdImportResult {
  categoriesCreated: number;
  categoriesReused: number;
  challengesCreated: number;
  challengesUpdated: number;
  channelsCreated: number;
  channelsUpdated: number;
  skipped: number;
}

function challengeSlugForRow(serverId: string, row: NormRow): string {
  const serverPart = serverId.slice(-8);
  if (row.id) return `ctfd-${serverPart}-${row.id}`;
  return `ctfd-${serverPart}-${slugify(row.category)}-${slugify(row.name)}`;
}

async function resolveChallengeForImport(
  tx: Prisma.TransactionClient,
  serverId: string,
  row: NormRow,
  challengeData: Prisma.ChallengeCreateInput,
  result: CtfdImportResult,
): Promise<string> {
  const scopedSlug = challengeSlugForRow(serverId, row);
  let existing = await tx.challenge.findUnique({ where: { slug: scopedSlug } });

  if (!existing && row.id) {
    const legacy = await tx.challenge.findUnique({ where: { slug: `ctfd-${row.id}` } });
    if (legacy) {
      const onThisServer = await tx.channel.findFirst({
        where: { challengeId: legacy.id, serverId },
      });
      if (onThisServer) existing = legacy;
    }
  }

  if (existing) {
    const takenElsewhere = await tx.channel.findFirst({
      where: { challengeId: existing.id, NOT: { serverId } },
    });
    if (takenElsewhere) existing = null;
  }

  if (existing) {
    await tx.challenge.update({
      where: { id: existing.id },
      data: {
        title: row.name,
        description: row.description || '—',
        category: row.category,
        points: Math.max(0, Math.floor(Number.parseInt(row.value, 10) || 0)),
        isReleased: row.state !== 'hidden',
      },
    });
    result.challengesUpdated += 1;
    return existing.id;
  }

  let createSlug = scopedSlug;
  if (await tx.challenge.findUnique({ where: { slug: createSlug } })) {
    createSlug = `${scopedSlug}-${nanoid(4)}`;
  }

  const ch = await tx.challenge.create({
    data: { ...challengeData, slug: createSlug },
  });
  result.challengesCreated += 1;
  return ch.id;
}

export async function importCtfdChallengeRows(rows: NormRow[], serverId: string): Promise<CtfdImportResult> {
  const result: CtfdImportResult = {
    categoriesCreated: 0,
    categoriesReused: 0,
    challengesCreated: 0,
    challengesUpdated: 0,
    channelsCreated: 0,
    channelsUpdated: 0,
    skipped: 0,
  };

  if (rows.length === 0) return result;

  const categoryNames = [...new Set(rows.map((r) => r.category))];
  const catMap = new Map<string, string>();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    let pos =
      (await tx.category.findFirst({ where: { serverId }, orderBy: { position: 'desc' } }))?.position ?? 0;

    for (const name of categoryNames) {
      const existing = await tx.category.findFirst({ where: { name, serverId } });
      if (existing) {
        catMap.set(name, existing.id);
        result.categoriesReused += 1;
      } else {
        pos += 1;
        const created = await tx.category.create({
          data: { name, position: pos, staffOnly: false, serverId },
        });
        catMap.set(name, created.id);
        result.categoriesCreated += 1;
      }
    }

    let chPos = 0;
    for (const row of rows) {
      chPos += 1;
      const points = Math.max(0, Math.floor(Number.parseInt(row.value, 10) || 0));
      const isReleased = row.state !== 'hidden';
      const categoryId = catMap.get(row.category);
      if (!categoryId) {
        result.skipped += 1;
        continue;
      }

      const challengeData: Prisma.ChallengeCreateInput = {
        slug: challengeSlugForRow(serverId, row),
        title: row.name,
        description: row.description || '—',
        category: row.category,
        difficulty: 'MEDIUM',
        points,
        tagsJson: '[]',
        isReleased,
        flag: DUMMY_FLAG,
      };

      const challengeId = await resolveChallengeForImport(tx, serverId, row, challengeData, result);

      const existingChan = await tx.channel.findFirst({
        where: { challengeId, serverId },
      });

      const slug =
        existingChan?.slug ??
        `${slugify(row.category).slice(0, 20)}-${slugify(row.name).slice(0, 20)}-${serverId.slice(-4)}-${nanoid(4)}`.slice(
          0,
          80,
        );

      const channelData = {
        name: row.name,
        slug,
        topic: row.category ? `Soru · ${row.category}` : null,
        type: 'CHALLENGE_DISCUSSION' as const,
        position: chPos,
        categoryId,
        challengeId,
        serverId,
        iconKey: 'flag' as const,
        isPrivate: false,
        isLocked: false,
      };

      if (existingChan) {
        await tx.channel.update({
          where: { id: existingChan.id },
          data: {
            name: channelData.name,
            topic: channelData.topic,
            position: channelData.position,
            categoryId,
          },
        });
        result.channelsUpdated += 1;
      } else {
        await tx.channel.create({ data: channelData });
        result.channelsCreated += 1;
      }
    }
  });

  emitChannelsRefresh(serverId);
  return result;
}

export async function importCtfdChallengesCsv(csvText: string, serverId: string): Promise<CtfdImportResult> {
  return importCtfdChallengeRows(parseChallengesFromCsv(csvText), serverId);
}
