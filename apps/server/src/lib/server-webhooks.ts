import { prisma } from '../prisma.js';
import { logger } from './logger.js';
import { assertSafeOutboundUrl } from './url-safety.js';

export async function dispatchServerWebhooks(
  serverId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const hooks = await prisma.serverWebhook.findMany({
    where: { serverId, enabled: true },
  });

  for (const hook of hooks) {
    let events: string[] = [];
    try {
      events = JSON.parse(hook.eventsJson) as string[];
    } catch {
      events = ['announcement.publish'];
    }
    if (!events.includes(event)) continue;

    let safeUrl: string;
    try {
      safeUrl = await assertSafeOutboundUrl(hook.url);
    } catch {
      logger.warn({ webhookId: hook.id }, 'webhook URL blocked');
      continue;
    }

    void fetch(safeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SYDT-Event': event,
        ...(hook.secret ? { 'X-SYDT-Secret': hook.secret } : {}),
      },
      body: JSON.stringify({ event, serverId, payload, ts: new Date().toISOString() }),
    }).catch((err) => {
      logger.warn({ err, webhookId: hook.id, event }, 'webhook dispatch failed');
    });
  }
}
