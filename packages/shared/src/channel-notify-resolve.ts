import { ChannelNotifyMode, type EffectiveChannelNotify, UserNotifyDefaultMode } from './notifications-channel';

function normalizeAccountDefault(v: string | null | undefined): 'ALL' | 'MENTIONS_ONLY' | 'NONE' {
  if (v === UserNotifyDefaultMode.MENTIONS_ONLY || v === 'MENTIONS_ONLY') return 'MENTIONS_ONLY';
  if (v === UserNotifyDefaultMode.NONE || v === 'NONE') return 'NONE';
  return 'ALL';
}

/** Resolves per-channel preference + account default → effective routing for notifications. */
export function resolveEffectiveNotify(
  stored: string | null | undefined,
  accountDefault: string | null | undefined,
): EffectiveChannelNotify {
  if (stored === ChannelNotifyMode.MUTED || stored === 'MUTED') return 'MUTED';
  const acc = normalizeAccountDefault(accountDefault);
  if (
    stored === null ||
    stored === undefined ||
    stored === ChannelNotifyMode.DEFAULT ||
    stored === 'DEFAULT'
  ) {
    return acc;
  }
  if (stored === ChannelNotifyMode.ALL || stored === 'ALL') return 'ALL';
  if (stored === ChannelNotifyMode.MENTIONS_ONLY || stored === 'MENTIONS_ONLY') return 'MENTIONS_ONLY';
  if (stored === ChannelNotifyMode.NONE || stored === 'NONE') return 'NONE';
  return acc;
}
