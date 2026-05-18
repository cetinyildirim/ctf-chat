import { parse } from 'csv-parse/sync';
import { nanoid } from 'nanoid';
import { prisma } from '../../prisma.js';
import { emitChannelsRefresh } from '../../realtime/broadcasters.js';
import type { Prisma } from '@prisma/client';
import { provisionTeamRoomsForCategory } from '../categories/category-team-rooms.service.js';

const DUMMY_FLAG = 'ctfd-import-not-used-in-chat';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

type NormRow = {
  id?: string;
  name: string;
  category: string;
  description: string;
  value: string;
  state: string;
};

function normalizeRecords(
  rows: Record<string, string>[],
): NormRow[] {
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

export interface CtfdImportResult {
  categoriesCreated: number;
  categoriesReused: number;
  challengesCreated: number;
  challengesUpdated: number;
  channelsCreated: number;
  channelsUpdated: number;
  skipped: number;
}

export async function importCtfdChallengesCsv(csvText: string): Promise<CtfdImportResult> {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, string>[];

  const rows = normalizeRecords(records);
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
    let pos = (await tx.category.findFirst({ orderBy: { position: 'desc' } }))?.position ?? 0;

    for (const name of categoryNames) {
      const existing = await tx.category.findFirst({ where: { name } });
      if (existing) {
        catMap.set(name, existing.id);
        result.categoriesReused += 1;
      } else {
        pos += 1;
        const created = await tx.category.create({
          data: { name, position: pos, staffOnly: false },
        });
        catMap.set(name, created.id);
        result.categoriesCreated += 1;
      }
    }

    let chPos = 0;
    for (const row of rows) {
      chPos += 1;
      const slugBase = row.id
        ? `ctfd-${row.id}`
        : `ctfd-${slugify(row.category)}-${slugify(row.name)}-${nanoid(6)}`;

      const points = Math.max(0, Math.floor(Number.parseInt(row.value, 10) || 0));
      const isReleased = row.state !== 'hidden';
      const categoryId = catMap.get(row.category);
      if (!categoryId) {
        result.skipped += 1;
        continue;
      }

      const existingCh = await tx.challenge.findUnique({ where: { slug: slugBase } });
      const challengeData: Prisma.ChallengeCreateInput = {
        slug: slugBase,
        title: row.name,
        description: row.description || '—',
        category: row.category,
        difficulty: 'MEDIUM',
        points,
        tagsJson: '[]',
        isReleased,
        flag: DUMMY_FLAG,
      };

      let challengeId: string;
      if (existingCh) {
        await tx.challenge.update({
          where: { id: existingCh.id },
          data: {
            title: row.name,
            description: row.description || '—',
            category: row.category,
            points,
            isReleased,
          },
        });
        challengeId = existingCh.id;
        result.challengesUpdated += 1;
      } else {
        const ch = await tx.challenge.create({ data: challengeData });
        challengeId = ch.id;
        result.challengesCreated += 1;
      }

      const existingChan = await tx.channel.findFirst({
        where: { challengeId },
      });

      const slug =
        existingChan?.slug ??
        `${slugify(row.category).slice(0, 24)}-${slugify(row.name).slice(0, 24)}-${nanoid(4)}`.slice(
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

  const uniqCatIds = [...new Set(catMap.values())];
  for (const cid of uniqCatIds) {
    const cat = await prisma.category.findUnique({ where: { id: cid } });
    if (cat) await provisionTeamRoomsForCategory(prisma, cat);
  }

  emitChannelsRefresh();
  return result;
}
