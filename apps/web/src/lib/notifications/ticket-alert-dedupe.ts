/**
 * Avoid double sound/toast when the same event arrives on two socket channels
 * (e.g. `ticket:created` + `notification:new`, or `announcement:new` + inbox).
 */
const recent = new Map<string, number>();
const WINDOW_MS = 2500;

export function shouldShowRealtimeAlert(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key);
  if (last != null && now - last < WINDOW_MS) return false;
  recent.set(key, now);
  if (recent.size > 200) {
    for (const [id, at] of recent) {
      if (now - at > WINDOW_MS) recent.delete(id);
    }
  }
  return true;
}

export function shouldShowTicketAlert(ticketId: string): boolean {
  return shouldShowRealtimeAlert(ticketId);
}
