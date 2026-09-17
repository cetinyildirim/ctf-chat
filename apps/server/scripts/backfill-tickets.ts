/**
 * Ticket normalizer - idempotent, safe to re-run.
 * Run: pnpm tsx scripts/backfill-tickets.ts
 *
 * - seeds competition settings + default categories for every ChatServer
 * - keeps `priorityRank` in sync with `priority`
 * - rewrites ticket codes that do not match the competition prefix
 * - assigns the fallback category to tickets that have none
 *
 * The original M1 migration (serverId / seq / priority / assignedTo backfill from
 * the retired `severity` and `claimedById` columns) ran once against the pre-M1
 * schema and is intentionally not repeated here.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PRIORITY_ORDER } from '@sydt/shared';
import { ensureCompetitionDefaults } from '../src/lib/ticket-defaults.js';

const prisma = new PrismaClient();

function formatCode(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(6, '0')}`;
}

async function main() {
  const servers = await prisma.chatServer.findMany({ select: { id: true, name: true } });
  let fixedCodes = 0;
  let fixedRanks = 0;
  let fixedCategories = 0;

  for (const server of servers) {
    const { competition, categories } = await ensureCompetitionDefaults(server.id);
    const fallbackCategoryId = categories.find((c) => c.key === 'OTHER')?.id ?? null;

    const tickets = await prisma.ticket.findMany({
      where: { serverId: server.id },
      select: { id: true, code: true, seq: true, priority: true, priorityRank: true, categoryId: true },
      orderBy: { seq: 'asc' },
    });

    for (const ticket of tickets) {
      const expectedCode = formatCode(competition.ticketPrefix, ticket.seq);
      const expectedRank = PRIORITY_ORDER[ticket.priority as keyof typeof PRIORITY_ORDER] ?? 1;
      const data: Record<string, unknown> = {};

      if (ticket.code !== expectedCode) {
        data.code = expectedCode;
        fixedCodes += 1;
      }
      if (ticket.priorityRank !== expectedRank) {
        data.priorityRank = expectedRank;
        fixedRanks += 1;
      }
      if (!ticket.categoryId && fallbackCategoryId) {
        data.categoryId = fallbackCategoryId;
        fixedCategories += 1;
      }
      if (Object.keys(data).length > 0) {
        await prisma.ticket.update({ where: { id: ticket.id }, data });
      }
    }

    console.log(
      `[${server.name}] prefix=${competition.ticketPrefix} categories=${categories.length} tickets=${tickets.length}`,
    );
  }

  console.log(
    `[normalize] codes=${fixedCodes} priorityRank=${fixedRanks} categories=${fixedCategories}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
