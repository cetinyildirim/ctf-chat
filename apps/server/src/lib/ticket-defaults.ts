import { DEFAULT_TICKET_CATEGORIES } from '@sydt/shared';
import { prisma } from '../prisma.js';

type Db = typeof prisma | import('@prisma/client').Prisma.TransactionClient;

/** `sydt-26` -> `SYDT26`; falls back to `CTF` when nothing usable remains. */
function derivePrefix(source: string): string {
  const cleaned = source.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.slice(0, 8) || 'CTF';
}

/**
 * Ticket codes are `<PREFIX>-000001` and must stay globally unique because
 * `Ticket.code` is unique, so each competition owns a distinct prefix.
 */
async function allocatePrefix(db: Db, serverId: string, base: string): Promise<string> {
  const candidate = derivePrefix(base);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const value = attempt === 0 ? candidate : `${candidate.slice(0, 6)}${attempt + 1}`;
    const clash = await db.competitionSettings.findFirst({
      where: { ticketPrefix: value, NOT: { serverId } },
      select: { serverId: true },
    });
    if (!clash) return value;
  }
  return `CTF${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

export async function ensureCompetitionSettings(serverId: string, db: Db = prisma) {
  const existing = await db.competitionSettings.findUnique({ where: { serverId } });
  if (existing) return existing;

  const server = await db.chatServer.findUnique({
    where: { id: serverId },
    select: { slug: true, name: true },
  });
  const prefix = await allocatePrefix(db, serverId, server?.slug ?? server?.name ?? 'CTF');

  return db.competitionSettings.create({
    data: { serverId, ticketPrefix: prefix },
  });
}

export async function ensureTicketCategories(serverId: string, db: Db = prisma) {
  const existing = await db.ticketCategory.findMany({ where: { serverId } });
  if (existing.length > 0) return existing;

  await db.ticketCategory.createMany({
    data: DEFAULT_TICKET_CATEGORIES.map((c, index) => ({
      serverId,
      key: c.key,
      name: c.name,
      position: index,
      requiresChallenge: c.requiresChallenge ?? false,
    })),
  });
  return db.ticketCategory.findMany({ where: { serverId }, orderBy: { position: 'asc' } });
}

/** Idempotent; safe to call on every server create and on demand. */
export async function ensureCompetitionDefaults(serverId: string, db: Db = prisma) {
  const competition = await ensureCompetitionSettings(serverId, db);
  const categories = await ensureTicketCategories(serverId, db);
  return { competition, categories };
}
