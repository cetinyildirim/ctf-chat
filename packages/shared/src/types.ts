import type { Role } from './rbac';
import type {
  ChallengeCategory,
  ChallengeDifficulty,
  ChannelType,
  CompetitionStatus,
  IncidentSeverity,
  IncidentStatus,
  NotificationKind,
  TicketPolicy,
  TicketPriority,
  TicketRelationKind,
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
  /** Server IDs where this user must change password before continuing */
  mustChangePasswordServerIds: string[];
}

export interface Team {
  id: string;
  serverId?: string;
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

export interface ChatServer {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  position: number;
  requirePasswordChangeOnJoin?: boolean;
}

export interface ServerMemberProfile {
  nickname: string | null;
  avatarUrl: string | null;
  displayName: string;
  username: string;
}

export interface ServerInvite {
  id: string;
  code: string;
  serverId: string;
  channelId: string | null;
  channelName: string | null;
  creator: PublicUser;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  position: number;
  logoUrl: string | null;
  staffOnly?: boolean;
  serverId?: string | null;
  /** Present when this category is a team's private workspace. */
  teamId?: string | null;
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
  serverId?: string | null;
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
  serverNotifyMode?: string;
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

export interface PinnedMessageEntry {
  message: Message;
  channelId: string;
  channelName: string;
  pinnedAt: string;
}

export interface PlatformPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  authorId: string | null;
}

export interface PinsByCategoryGroup {
  categoryId: string | null;
  categoryName: string;
  categoryPosition: number;
  pins: PinnedMessageEntry[];
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

export interface TicketCategoryDto {
  id: string;
  key: string;
  name: string;
  position: number;
  isActive: boolean;
  requiresChallenge: boolean;
}

export interface TicketTagDto {
  id: string;
  name: string;
  color: string;
}

export interface TicketChallengeRef {
  id: string;
  title: string;
  category: string;
}

export interface Ticket {
  id: string;
  serverId: string;
  code: string;
  seq: number;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  /** @deprecated mirrors `priority`; kept so existing callers keep compiling. */
  severity: TicketPriority;
  category: TicketCategoryDto | null;
  challengeId: string | null;
  challenge: TicketChallengeRef | null;
  channelId: string | null;
  openedBy: PublicUser;
  assignedTo: PublicUser | null;
  /** @deprecated mirrors `assignedTo`. */
  claimedBy: PublicUser | null;
  team: Pick<Team, 'id' | 'name' | 'color'> | null;
  tags: TicketTagDto[];
  body: string;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  reopenCount: number;
  messageCount: number;
  attachmentCount: number;
  unreadCount: number;
}

export type TicketEventType =
  | 'CREATED'
  | 'COMMENT'
  | 'INTERNAL_NOTE'
  | 'CLAIMED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'STATUS_CHANGE'
  | 'SEVERITY_CHANGE'
  | 'PRIORITY_CHANGE'
  | 'CATEGORY_CHANGE'
  | 'CHALLENGE_CHANGE'
  | 'TAGS_CHANGE'
  | 'RELATION_ADDED'
  | 'RELATION_REMOVED'
  | 'ATTACHMENT_ADDED'
  | 'REOPENED'
  | 'RESOLVED'
  | 'CLOSED';

export interface TicketAttachmentDto {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface TicketEvent {
  id: string;
  ticketId: string;
  type: TicketEventType;
  author: PublicUser | null;
  body: string | null;
  meta: Record<string, unknown> | null;
  attachments: TicketAttachmentDto[];
  createdAt: string;
}

export interface TicketRelationDto {
  id: string;
  kind: TicketRelationKind;
  /** The ticket on the other side of the relation. */
  ticket: Pick<Ticket, 'id' | 'code' | 'title' | 'status' | 'priority'>;
  createdAt: string;
}

export interface TicketListPage {
  tickets: Ticket[];
  nextCursor: string | null;
  total: number;
}

/** What the requesting user may do on one ticket, decided server-side. */
export interface TicketViewerCapabilities {
  canSeeInternal: boolean;
  canViewAll: boolean;
  canAssign: boolean;
  canClaim: boolean;
  canManageFields: boolean;
}

export interface TicketDetailResponse {
  ticket: Ticket;
  events: TicketEvent[];
  relations: TicketRelationDto[];
  viewer: TicketViewerCapabilities;
}

export interface TicketMeta {
  categories: TicketCategoryDto[];
  tags: TicketTagDto[];
  statuses: TicketStatus[];
  priorities: TicketPriority[];
  challenges: TicketChallengeRef[];
  competition: CompetitionSettingsDto;
  /** Whether the current user may open a ticket right now. */
  canCreate: boolean;
  canViewAll: boolean;
  team: Pick<Team, 'id' | 'name' | 'color'> | null;
}

/** Organizer dashboard (§19) plus the live operations counters (§20). */
export interface TicketStatsDto {
  total: number;
  active: number;
  statusCounts: Record<TicketStatus, number>;
  priorityCounts: Record<TicketPriority, number>;
  unassignedActive: number;
  arrivals: { last5: number; last15: number; last30: number };
  perTeam: Array<{ teamId: string; name: string; color: string; count: number }>;
  perChallenge: Array<{
    challengeId: string;
    title: string;
    category: string | null;
    count: number;
  }>;
  perCategory: Array<{
    categoryId: string | null;
    key: string | null;
    name: string;
    count: number;
  }>;
  perAssignee: Array<{ userId: string; name: string; count: number }>;
  /** Challenges reported by more than one team. */
  multiTeam: Array<{ challengeId: string; challengeTitle: string; teamCount: number }>;
  recent: Ticket[];
}

/** Post-event report (§46-47). Response times are operational, never scoring. */
export interface TicketReportDto {
  total: number;
  unresolved: number;
  closed: number;
  reopened: number;
  critical: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  firstResponseSamples: number;
  resolutionSamples: number;
  timeline: Array<{ at: string; count: number }>;
}

export interface NotificationsPage {
  notifications: NotificationDto[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface TicketBulkResult {
  tickets: Ticket[];
  applied: number;
  skipped: Array<{ id: string; reason: string }>;
}

export interface CompetitionSettingsDto {
  serverId: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  status: CompetitionStatus;
  ticketPolicy: TicketPolicy;
  archivedAt: string | null;
}

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  refType: string | null;
  refId: string | null;
  serverId: string | null;
  read: boolean;
  createdAt: string;
  /**
   * Structured context for the event. `title`/`body` are stored in English;
   * clients rebuild the headline from `kind` + `meta` in the viewer's locale.
   */
  meta: Record<string, unknown>;
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
  serverId: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: IncidentSeverity;
  author: PublicUser;
  createdAt: string;
  scheduledFor: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  serverId?: string | null;
  channelId?: string | null;
  /** Set when the announcement was raised from a ticket. */
  sourceTicketId?: string | null;
}

export interface ServerIntegrations {
  themePrimary: string | null;
  themeAccent: string | null;
  emailNotifyEnabled: boolean;
  emailReplyTo: string | null;
  ctfdBaseUrl: string | null;
  ctfdAccessTokenConfigured: boolean;
}

export type CtfdScoreboardEntryDto = {
  place: number;
  ctfdTeamId: number | null;
  name: string;
  score: number;
  solves: number | null;
  localTeam: { id: string; name: string; color: string; logoUrl: string | null } | null;
};

export type CtfdChallengeSolveStatDto = {
  id: number;
  name: string;
  solves: number;
};

export type CtfdCategoryStatDto = {
  name: string;
  solves: number;
};

export type CtfdStatsSnapshotDto = {
  available: boolean;
  challengeCount: number;
  totalSolves: number;
  registeredTeams: number | null;
  challengeSolves: CtfdChallengeSolveStatDto[];
  categories: CtfdCategoryStatDto[];
};

export type CtfdScoreboardSnapshotDto = {
  configured: boolean;
  /** URL saved but API token missing — CTFd data must not load until token is set. */
  needsToken?: boolean;
  scoreboardUrl: string | null;
  generatedAt: string;
  entries: CtfdScoreboardEntryDto[];
  stats: CtfdStatsSnapshotDto | null;
};

export interface CtfdTeamStatsDto {
  place: number | null;
  score: number;
  solves: number | null;
  name: string | null;
}

export interface TeamCtfdLinkDto {
  configured: boolean;
  scoreboardUrl: string | null;
  stats: CtfdTeamStatsDto | null;
  linked: boolean;
}

export interface ServerRole {
  id: string;
  serverId: string;
  name: string;
  color: string;
  position: number;
  hoist: boolean;
  permissions: Record<string, boolean>;
  memberCount: number;
}

export interface ServerWebhook {
  id: string;
  serverId: string;
  label: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
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
  ip: string | null;
  userAgent: string | null;
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
