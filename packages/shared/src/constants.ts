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

/**
 * CTF ticket lifecycle:
 * OPEN -> IN_PROGRESS -> WAITING_FOR_COMPETITOR -> RESOLVED -> CLOSED, with
 * REOPENED available when the competitor rejects the resolution.
 * Assignment is tracked separately from status (see Ticket.assignedTo).
 */
export const TicketStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_COMPETITOR: 'WAITING_FOR_COMPETITOR',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TICKET_STATUSES = Object.values(TicketStatus) as TicketStatus[];

/** Statuses that still require organizer attention. */
export const TICKET_ACTIVE_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_FOR_COMPETITOR,
  TicketStatus.REOPENED,
];

export const TicketPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

export const TICKET_PRIORITIES = Object.values(TicketPriority) as TicketPriority[];

/** Retained alias: the DB column was named `severity` before M1. */
export const TicketSeverity = TicketPriority;
export type TicketSeverity = TicketPriority;

export const TicketRelationKind = {
  RELATED: 'RELATED',
  DUPLICATE: 'DUPLICATE',
  PARENT: 'PARENT',
  CHILD: 'CHILD',
} as const;
export type TicketRelationKind = (typeof TicketRelationKind)[keyof typeof TicketRelationKind];

export const CompetitionStatus = {
  UPCOMING: 'UPCOMING',
  LIVE: 'LIVE',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED',
} as const;
export type CompetitionStatus = (typeof CompetitionStatus)[keyof typeof CompetitionStatus];

/** Who may open tickets in the current competition state. */
export const TicketPolicy = {
  OPEN: 'OPEN',
  ORGANIZER_ONLY: 'ORGANIZER_ONLY',
  CLOSED: 'CLOSED',
} as const;
export type TicketPolicy = (typeof TicketPolicy)[keyof typeof TicketPolicy];

/** Seeded per competition; admins may rename, reorder or deactivate them. */
export const DEFAULT_TICKET_CATEGORIES: ReadonlyArray<{
  key: string;
  name: string;
  requiresChallenge?: boolean;
}> = [
  { key: 'CHALLENGE_ISSUE', name: 'Challenge Issue', requiresChallenge: true },
  { key: 'CHALLENGE_CLARIFICATION', name: 'Challenge Clarification', requiresChallenge: true },
  { key: 'TECHNICAL_ISSUE', name: 'Technical Issue' },
  { key: 'INFRASTRUCTURE', name: 'Infrastructure' },
  { key: 'FLAG_SUBMISSION', name: 'Flag Submission Issue' },
  { key: 'SCORE_ISSUE', name: 'Score Issue' },
  { key: 'ACCOUNT_TEAM', name: 'Account / Team' },
  { key: 'COMPETITION', name: 'Competition' },
  { key: 'OTHER', name: 'Other' },
];

export const NotificationKind = {
  TICKET_CREATED: 'TICKET_CREATED',
  TICKET_REPLY: 'TICKET_REPLY',
  TICKET_STATUS: 'TICKET_STATUS',
  TICKET_ASSIGNED: 'TICKET_ASSIGNED',
  TICKET_RESOLVED: 'TICKET_RESOLVED',
  TICKET_REOPENED: 'TICKET_REOPENED',
  TICKET_CRITICAL: 'TICKET_CRITICAL',
  TICKET_MULTI_TEAM: 'TICKET_MULTI_TEAM',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  MENTION: 'MENTION',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];

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
  IN_PROGRESS: 'In progress',
  WAITING_FOR_COMPETITOR: 'Waiting for competitor',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
};

export const SEVERITY_ORDER: Record<TicketPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export const PRIORITY_ORDER = SEVERITY_ORDER;

export const TICKET_PAGE_SIZE = 25;
export const TICKET_PAGE_SIZE_MAX = 100;
/** Ticket attachments: tighter than message uploads, checked per request. */
export const TICKET_ATTACHMENT_MAX_COUNT = 5;

/**
 * Allowed status transitions. Organizers move tickets forward; competitors may
 * only reopen a resolved ticket (enforced separately by permission).
 */
export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_COMPETITOR', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'WAITING_FOR_COMPETITOR', 'RESOLVED', 'CLOSED'],
  WAITING_FOR_COMPETITOR: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'REOPENED', 'IN_PROGRESS'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS', 'WAITING_FOR_COMPETITOR', 'RESOLVED', 'CLOSED'],
};

export function canTransitionTicketStatus(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return true;
  return (TICKET_STATUS_TRANSITIONS[from] ?? []).includes(to);
}
