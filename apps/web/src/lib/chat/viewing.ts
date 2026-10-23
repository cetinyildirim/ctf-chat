/** Direct conversations open inside the inbox page via `?c=<channelId>`. */
export function directConversationHref(channelId: string): string {
  return `/messages?c=${encodeURIComponent(channelId)}`;
}

/** True while the given channel is on screen (channel page or inbox conversation pane). */
export function isViewingChannel(channelId: string): boolean {
  if (typeof window === 'undefined') return false;
  const { pathname, search } = window.location;
  if (pathname === `/channels/${channelId}`) return true;
  return pathname === '/messages' && new URLSearchParams(search).get('c') === channelId;
}
