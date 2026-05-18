export const APP_NAME = 'SYDT';
export const APP_TAGLINE = 'CTF Operations Console';

export const ChannelType = {
  GLOBAL_ANNOUNCEMENT: 'GLOBAL_ANNOUNCEMENT',
  GLOBAL_CHAT: 'GLOBAL_CHAT',
  TEAM_SUPPORT: 'TEAM_SUPPORT',
  CHALLENGE_DISCUSSION: 'CHALLENGE_DISCUSSION',
  INCIDENT: 'INCIDENT',
  VOICE_PLACEHOLDER: 'VOICE_PLACEHOLDER',
  STAFF_COORD: 'STAFF_COORD',
  ORGANIZER_INTERNAL: 'ORGANIZER_INTERNAL',
  LOGS: 'LOGS',
  TEAM_PRIVATE: 'TEAM_PRIVATE',
  DIRECT_MESSAGE: 'DIRECT_MESSAGE',
} as const;

export type ChannelType = (typeof ChannelType)[keyof typeof ChannelType];

export const TicketStatus = {
  OPEN: 'OPEN',
  CLAIMED: 'CLAIMED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type TicketSeverity = (typeof TicketSeverity)[keyof typeof TicketSeverity];

export const IncidentSeverity = {
  INFO: 'INFO',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type IncidentSeverity = (typeof IncidentSeverity)[keyof typeof IncidentSeverity];

export const IncidentStatus = {
  OPEN: 'OPEN',
  INVESTIGATING: 'INVESTIGATING',
  MITIGATED: 'MITIGATED',
  RESOLVED: 'RESOLVED',
  POSTMORTEM: 'POSTMORTEM',
} as const;
export type IncidentStatus = (typeof IncidentStatus)[keyof typeof IncidentStatus];

export const ChallengeDifficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
  INSANE: 'INSANE',
} as const;
export type ChallengeDifficulty = (typeof ChallengeDifficulty)[keyof typeof ChallengeDifficulty];

export const ChallengeCategory = {
  WEB: 'WEB',
  PWN: 'PWN',
  REV: 'REV',
  CRYPTO: 'CRYPTO',
  FORENSICS: 'FORENSICS',
  OSINT: 'OSINT',
  MISC: 'MISC',
} as const;
export type ChallengeCategory = (typeof ChallengeCategory)[keyof typeof ChallengeCategory];

export const UserStatus = {
  ONLINE: 'ONLINE',
  IDLE: 'IDLE',
  DND: 'DND',
  OFFLINE: 'OFFLINE',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const MESSAGE_PAGE_SIZE = 50;
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const TYPING_TTL_MS = 6_000;
export const PRESENCE_HEARTBEAT_MS = 25_000;
export const PRESENCE_OFFLINE_MS = 60_000;

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  CLAIMED: 'Claimed',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const SEVERITY_ORDER: Record<TicketSeverity, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};
