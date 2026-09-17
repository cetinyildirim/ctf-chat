/** Avoid double sound/toast when `ticket:created` and `notification:new` both fire. */
const recent = new Map<string, number>();
const WINDOW_MS = 2500;

export function shouldShowTicketAlert(ticketId: string): boolean {
  const now = Date.now();
  const last = recent.get(ticketId);
  if (last != null && now - last < WINDOW_MS) return false;
  recent.set(ticketId, now);
  if (recent.size > 200) {
    for (const [id, at] of recent) {
      if (now - at > WINDOW_MS) recent.delete(id);
    }
  }
  return true;
}
