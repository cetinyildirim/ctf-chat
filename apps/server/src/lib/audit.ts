import type { Request } from 'express';
import { prisma } from '../prisma.js';
import { logger } from './logger.js';

export interface AuditEntryInput {
  actorId?: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

export async function audit(entry: AuditEntryInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        target: entry.target ?? null,
        metaJson: JSON.stringify(entry.meta ?? {}),
        ip: entry.ip ?? null,
        userAgent: entry.userAgent?.slice(0, 400) ?? null,
      },
    });
  } catch (err) {
    logger.warn({ err, entry }, 'audit-log write failed');
  }
}

/**
 * Audit entry enriched with request forensics (actor, IP, user agent), which the
 * CTF ticket spec requires for every ticket-related action.
 */
export async function auditRequest(
  req: Request,
  entry: Omit<AuditEntryInput, 'actorId' | 'ip' | 'userAgent'>,
): Promise<void> {
  await audit({
    ...entry,
    actorId: req.user?.id ?? null,
    ip: req.ip ?? req.headers['x-forwarded-for']?.toString() ?? null,
    userAgent: req.header('user-agent') ?? null,
  });
}
