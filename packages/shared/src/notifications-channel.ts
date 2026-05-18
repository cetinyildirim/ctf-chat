/** Per-channel row; DEFAULT defers to user account notifyDefault */
export const ChannelNotifyMode = {
  DEFAULT: 'DEFAULT',
  ALL: 'ALL',
  MENTIONS_ONLY: 'MENTIONS_ONLY',
  NONE: 'NONE',
  MUTED: 'MUTED',
} as const;

export type ChannelNotifyMode = (typeof ChannelNotifyMode)[keyof typeof ChannelNotifyMode];

/** Account-level default only (muted is per-channel) */
export const UserNotifyDefaultMode = {
  ALL: 'ALL',
  MENTIONS_ONLY: 'MENTIONS_ONLY',
  NONE: 'NONE',
} as const;

export type UserNotifyDefaultMode = (typeof UserNotifyDefaultMode)[keyof typeof UserNotifyDefaultMode];

export const FriendshipStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
} as const;

export type FriendshipStatus = (typeof FriendshipStatus)[keyof typeof FriendshipStatus];

export type EffectiveChannelNotify =
  | 'ALL'
  | 'MENTIONS_ONLY'
  | 'NONE'
  | 'MUTED';
