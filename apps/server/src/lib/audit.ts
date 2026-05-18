import { prisma } from '../prisma.js';
import { logger } from './logger.js';

export interface AuditEntryInput {
  actorId?: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
}

export async function audit(entry: AuditEntryInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        target: entry.target ?? null,
        metaJson: JSON.stringify(entry.meta ?? {}),
      },
    });
  } catch (err) {
    logger.warn({ err, entry }, 'audit-log write failed');
  }
}
