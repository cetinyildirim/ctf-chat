import { ChannelType } from '@sydt/shared';
import type { Dict } from '@/i18n/dict';

/** Admin-create channel types with human labels (kept small on purpose). */
export const ADMIN_CHANNEL_TYPE_OPTIONS: ChannelType[] = [
  ChannelType.GLOBAL_CHAT,
  ChannelType.GLOBAL_ANNOUNCEMENT,
  ChannelType.CHALLENGE_DISCUSSION,
  ChannelType.TEAM_SUPPORT,
  ChannelType.STAFF_COORD,
];

export function channelTypeLabel(type: ChannelType, t: Dict): string {
  const map: Partial<Record<ChannelType, string>> = {
    [ChannelType.GLOBAL_CHAT]: t.channelTypeGlobalChat,
    [ChannelType.GLOBAL_ANNOUNCEMENT]: t.channelTypeAnnouncement,
    [ChannelType.CHALLENGE_DISCUSSION]: t.channelTypeChallenge,
    [ChannelType.TEAM_SUPPORT]: t.channelTypeTeamSupport,
    [ChannelType.STAFF_COORD]: t.channelTypeStaff,
    [ChannelType.TEAM_PRIVATE]: t.channelTypeTeamPrivate,
    [ChannelType.DIRECT_MESSAGE]: t.channelTypeDm,
    [ChannelType.ORGANIZER_INTERNAL]: t.channelTypeOrganizer,
    [ChannelType.LOGS]: t.channelTypeLogs,
    [ChannelType.INCIDENT]: t.channelTypeIncident,
    [ChannelType.VOICE_PLACEHOLDER]: t.channelTypeVoice,
  };
  return map[type] ?? type;
}
