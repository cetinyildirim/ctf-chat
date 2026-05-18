import type { Role } from './rbac';
import type {
  ChallengeCategory,
  ChallengeDifficulty,
  ChannelType,
  IncidentSeverity,
  IncidentStatus,
  TicketSeverity,
  TicketStatus,
  UserStatus,
} from './constants';
import type { FriendshipStatus } from './notifications-channel';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  role: Role;
  status: UserStatus;
  team: { id: string; name: string; color: string; logoUrl?: string | null } | null;
}

export interface SessionUser extends PublicUser {
  email: string;
  permissions: string[];
  /** UI language */
  locale: 'tr' | 'en';
  /** Preferred UI theme stored on account */
  theme: 'light' | 'dark';
  /** Default channel notify when pref is DEFAULT */
  defaultNotifyMode: 'ALL' | 'MENTIONS_ONLY' | 'NONE';
}

export interface Team {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  color: string;
  logoUrl: string | null;
  captainId: string | null;
  memberCount: number;
  score: number;
  rank: number;
  solveCount: number;
  bloodCount: number;
}

export interface Category {
  id: string;
  name: string;
  position: number;
  logoUrl: string | null;
  staffOnly?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  slug: string;
  topic: string | null;
  type: ChannelType;
  categoryId: string | null;
  position: number;
  isPrivate: boolean;
  isLocked: boolean;
  challengeId: string | null;
  teamId: string | null;
  iconKey: string | null;
  logoUrl: string | null;
  /** For DIRECT_MESSAGE listings: the other participant */
  dmPeer?: PublicUser | null;
}

/** GET /channels payload */
export interface ChannelsListPayload {
  categories: Category[];
  channels: Channel[];
  dmChannels: Channel[];
  notificationPrefs: {
    defaultNotifyMode: 'ALL' | 'MENTIONS_ONLY' | 'NONE';
    /** channelId → stored mode incl. DEFAULT / MUTED */
    overrides: Record<string, string>;
  };
}

export interface FriendshipRow {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  requester: PublicUser;
  addressee: PublicUser;
}

export interface MessageAttachment {
  id: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  author: PublicUser;
  content: string;
  replyToId: string | null;
  replyTo: Pick<Message, 'id' | 'authorId' | 'content'> | null;
  pinned: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  mentions: string[];
}

export interface Challenge {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  points: number;
  tags: string[];
  solveCount: number;
  firstBloodTeamId: string | null;
  hintCount: number;
  discussionChannelId: string | null;
  authorName: string | null;
  isReleased: boolean;
  isSolvedByMyTeam: boolean;
}

export interface ChallengeHint {
  id: string;
  order: number;
  text: string;
  cost: number;
  unlocked: boolean;
}

export interface Ticket {
  id: string;
  code: string;
  title: string;
  status: TicketStatus;
  severity: TicketSeverity;
  challengeId: string | null;
  channelId: string | null;
  openedBy: PublicUser;
  claimedBy: PublicUser | null;
  team: Pick<Team, 'id' | 'name' | 'color'> | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
}

export type TicketEventType =
  | 'CREATED'
  | 'COMMENT'
  | 'INTERNAL_NOTE'
  | 'CLAIMED'
  | 'STATUS_CHANGE'
  | 'SEVERITY_CHANGE'
  | 'RESOLVED'
  | 'CLOSED';

export interface TicketEvent {
  id: string;
  ticketId: string;
  type: TicketEventType;
  author: PublicUser | null;
  body: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  openedBy: PublicUser;
  assignedTo: PublicUser | null;
  createdAt: string;
  resolvedAt: string | null;
  channelId: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: IncidentSeverity;
  author: PublicUser;
  createdAt: string;
  scheduledFor: string | null;
}

export interface ScoreboardEntry {
  rank: number;
  previousRank: number | null;
  team: Team;
  score: number;
  solveCount: number;
  lastSolveAt: string | null;
}

export interface ScoreboardSnapshot {
  generatedAt: string;
  entries: ScoreboardEntry[];
  totalChallenges: number;
  totalTeams: number;
}

export interface SolveTimelinePoint {
  at: string;
  teamId: string;
  challengeId: string;
  points: number;
  firstBlood: boolean;
}

export interface PresenceState {
  userId: string;
  status: UserStatus;
  lastSeen: string;
}

export interface KPISnapshot {
  activeUsers: number;
  onlineTeams: number;
  messagesLastMinute: number;
  openTickets: number;
  openIncidents: number;
  totalSolves: number;
  generatedAt: string;
}

export interface ActivityBucket {
  at: string;
  messages: number;
  solves: number;
  tickets: number;
}

export interface AuditLogEntry {
  id: string;
  actor: PublicUser | null;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export type {
  SurveyDto,
  SurveyQuestionDto,
  SurveyOptionDto,
  SurveyStatsDto,
  SurveyQuestionStat,
  SurveyOptionStat,
  SurveyQuestionType,
} from './types/survey';
