import type {
  Announcement,
  Category,
  Challenge,
  ChallengeHint,
  Channel,
  Incident,
  KPISnapshot,
  Message,
  PublicUser,
  ScoreboardSnapshot,
  SessionUser,
  SolveTimelinePoint,
  Team,
  Ticket,
  TicketEvent,
  AuditLogEntry,
  ActivityBucket,
  ChannelsListPayload,
  ChannelNotifyMode,
  SurveyDto,
  SurveyStatsDto,
  PlatformBranding,
} from '@sydt/shared';
import { schemas } from '@sydt/shared';
import type { z } from 'zod';
import { api } from './axios';

export const authApi = {
  async me() {
    const { data } = await api.get<{ user: SessionUser }>('/auth/me');
    return data.user;
  },
  async login(identifier: string, password: string) {
    const { data } = await api.post<{ user: SessionUser }>('/auth/login', { identifier, password });
    return data.user;
  },
  async register(input: {
    email: string;
    username: string;
    displayName: string;
    password: string;
    confirmPassword: string;
    teamCode?: string;
  }) {
    const { data } = await api.post<{ user: SessionUser }>('/auth/register', input);
    return data.user;
  },
  async logout() {
    await api.post('/auth/logout');
  },
};

export type AdminCategory = Category & { staffOnly?: boolean };

export const categoriesApi = {
  async create(body: z.infer<typeof schemas.createCategorySchema>) {
    const { data } = await api.post<{ category: AdminCategory }>('/categories', body);
    return data.category;
  },
  async update(id: string, body: z.infer<typeof schemas.updateCategorySchema>) {
    const { data } = await api.patch<{ category: AdminCategory }>(`/categories/${id}`, body);
    return data.category;
  },
  async uploadLogo(categoryId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<{ category: AdminCategory }>(`/categories/${categoryId}/logo`, form, {
      timeout: 60_000,
    });
    return data.category;
  },
  async clearLogo(categoryId: string) {
    const { data } = await api.delete<{ category: AdminCategory }>(`/categories/${categoryId}/logo`);
    return data.category;
  },
  async remove(categoryId: string) {
    await api.delete(`/categories/${categoryId}`);
  },
};

export const channelsApi = {
  async list() {
    const { data } = await api.get<ChannelsListPayload>('/channels');
    return data;
  },
  async get(id: string) {
    const { data } = await api.get<{ channel: Channel }>(`/channels/${id}`);
    return data.channel;
  },
  async create(body: z.infer<typeof schemas.createChannelSchema>) {
    const { data } = await api.post<{ channel: Channel }>('/channels', body);
    return data.channel;
  },
  async update(id: string, body: z.infer<typeof schemas.updateChannelSchema>) {
    const { data } = await api.patch<{ channel: Channel }>(`/channels/${id}`, body);
    return data.channel;
  },
  async uploadLogo(channelId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<{ channel: Channel }>(`/channels/${channelId}/logo`, form, {
      timeout: 60_000,
    });
    return data.channel;
  },
  async clearLogo(channelId: string) {
    const { data } = await api.delete<{ channel: Channel }>(`/channels/${channelId}/logo`);
    return data.channel;
  },
  async remove(channelId: string) {
    await api.delete(`/channels/${channelId}`);
  },
  async setChannelNotify(channelId: string, notifyMode: ChannelNotifyMode) {
    const { data } = await api.patch<{ prefs: { channelId: string; notifyMode: ChannelNotifyMode } }>(
      `/channels/${channelId}/me/notifications`,
      { notifyMode },
    );
    return data.prefs;
  },
};

export const messagesApi = {
  async list(channelId: string, cursor?: string) {
    const { data } = await api.get<{ messages: Message[]; nextCursor: string | null; hasMore: boolean }>(
      `/channels/${channelId}/messages`,
      { params: { take: 50, direction: 'backward', cursor } },
    );
    return data;
  },
  async send(channelId: string, content: string, replyToId?: string | null) {
    const { data } = await api.post<{ message: Message }>(`/channels/${channelId}/messages`, {
      content,
      replyToId: replyToId ?? null,
    });
    return data.message;
  },
  /**
   * Multipart: field `content` (optional), `replyToId` (optional), files under `files`.
   */
  async sendWithFiles(
    channelId: string,
    body: { content: string; replyToId?: string | null; files: File[] },
  ) {
    const form = new FormData();
    if (body.content.trim()) form.append('content', body.content);
    if (body.replyToId) form.append('replyToId', body.replyToId);
    for (const f of body.files) {
      form.append('files', f);
    }
    const { data } = await api.post<{ message: Message }>(`/channels/${channelId}/messages`, form, {
      timeout: 120_000,
    });
    return data.message;
  },
  async edit(messageId: string, content: string) {
    const { data } = await api.patch<{ message: Message }>(`/messages/${messageId}`, { content });
    return data.message;
  },
  async remove(messageId: string) {
    await api.delete(`/messages/${messageId}`);
  },
  async react(messageId: string, emoji: string) {
    const { data } = await api.post<{ reactions: Message['reactions'] }>(`/messages/${messageId}/react`, {
      emoji,
    });
    return data.reactions;
  },
  async pin(messageId: string) {
    await api.post(`/messages/${messageId}/pin`);
  },
  async listPins(channelId: string) {
    const { data } = await api.get<{ pins: Message[] }>(`/channels/${channelId}/pins`);
    return data.pins;
  },
};

export const challengesApi = {
  async list(filters?: { category?: string; difficulty?: string; q?: string; solved?: 'true' | 'false' }) {
    const { data } = await api.get<{ challenges: Challenge[] }>('/challenges', { params: filters });
    return data.challenges;
  },
  async get(id: string) {
    const { data } = await api.get<{
      challenge: Challenge;
      hints: ChallengeHint[];
      solves: Array<{ team: { id: string; name: string; color: string }; solvedAt: string; firstBlood: boolean }>;
    }>(`/challenges/${id}`);
    return data;
  },
  async unlockHint(hintId: string) {
    const { data } = await api.post<{ hint: ChallengeHint }>(`/challenges/hints/${hintId}/unlock`);
    return data.hint;
  },
};

export const ticketsApi = {
  async list() {
    const { data } = await api.get<{ tickets: Ticket[] }>('/tickets');
    return data.tickets;
  },
  async get(id: string) {
    const { data } = await api.get<{ ticket: Ticket; events: TicketEvent[] }>(`/tickets/${id}`);
    return data;
  },
  async create(input: { title: string; body: string; severity?: string; challengeId?: string | null }) {
    const { data } = await api.post<{ ticket: Ticket }>('/tickets', input);
    return data.ticket;
  },
  async comment(id: string, body: string, internal = false) {
    const { data } = await api.post<{ ticket: Ticket; event: TicketEvent }>(`/tickets/${id}/comment`, {
      body,
      internal,
    });
    return data;
  },
  async claim(id: string) {
    const { data } = await api.post<{ ticket: Ticket }>(`/tickets/${id}/claim`);
    return data.ticket;
  },
  async setStatus(id: string, status: string) {
    const { data } = await api.post<{ ticket: Ticket }>(`/tickets/${id}/status`, { status });
    return data.ticket;
  },
  async setSeverity(id: string, severity: string) {
    const { data } = await api.post<{ ticket: Ticket }>(`/tickets/${id}/severity`, { severity });
    return data.ticket;
  },
};

export const scoreboardApi = {
  async snapshot() {
    const { data } = await api.get<ScoreboardSnapshot>('/scoreboard');
    return data;
  },
  async timeline() {
    const { data } = await api.get<{ points: SolveTimelinePoint[] }>('/scoreboard/timeline');
    return data.points;
  },
};

export const configApi = {
  async branding() {
    const { data } = await api.get<PlatformBranding>('/config/branding');
    return data;
  },
};

export const teamsApi = {
  async list() {
    const { data } = await api.get<{ teams: Team[] }>('/teams');
    return data.teams;
  },
  async get(id: string) {
    const { data } = await api.get<{ team: Team; members: PublicUser[] }>(`/teams/${id}`);
    return data;
  },
  async createMy(body: z.infer<typeof schemas.createTeamByUserSchema>) {
    const { data } = await api.post<{ team: Team; me: SessionUser }>('/teams/my', body);
    return data;
  },
  async uploadMyLogo(file: File) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<{ team: Team }>('/teams/my/logo', form);
    return data.team;
  },
  async clearMyLogo() {
    const { data } = await api.delete<{ team: Team }>('/teams/my/logo');
    return data.team;
  },
};

export const usersApi = {
  async patchMe(body: z.infer<typeof schemas.updateMeSchema>) {
    const { data } = await api.patch<{ user: SessionUser }>('/users/me', body);
    return data.user;
  },
  async uploadAvatar(file: File) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<{ user: SessionUser }>('/users/me/avatar', form, {
      timeout: 60_000,
    });
    return data.user;
  },
  async clearAvatar() {
    const { data } = await api.delete<{ user: SessionUser }>('/users/me/avatar');
    return data.user;
  },
  async online() {
    const { data } = await api.get<{
      users: PublicUser[];
      presences: Array<{ userId: string; status: string; lastSeen: string }>;
    }>('/users/online');
    return data;
  },
  async get(id: string) {
    const { data } = await api.get<{ user: PublicUser }>(`/users/${id}`);
    return data.user;
  },
  async profile(id: string) {
    const { data } = await api.get<{ card: UserProfileCard }>(`/users/${id}/profile`);
    return data.card;
  },
};

export type UserProfileCard = {
  user: PublicUser;
  bio: string | null;
  createdAt: string;
  presenceStatus: string;
  friendship: {
    id: string;
    status: string;
    isIncoming: boolean;
    isOutgoing: boolean;
  } | null;
  mutualFriends: PublicUser[];
  sharedTeam: { id: string; name: string; color: string } | null;
  teamChannels: { id: string; name: string; type: string }[];
  platformChannels: { id: string; name: string; type: string }[];
  isSelf: boolean;
};

export const reportsApi = {
  async create(body: z.infer<typeof schemas.createUserReportSchema>) {
    const { data } = await api.post<{ ok: boolean; reportId: string }>('/reports', body);
    return data;
  },
};

export type AdminUserReport = {
  id: string;
  reason: string;
  details: string | null;
  contextType: string | null;
  contextId: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reporter: PublicUser;
  reported: PublicUser;
  reviewedBy: PublicUser | null;
};

export const adminReportsApi = {
  async list(status?: string) {
    const { data } = await api.get<{ reports: AdminUserReport[] }>('/admin/reports', {
      params: status ? { status } : {},
    });
    return data.reports;
  },
  async patch(id: string, body: z.infer<typeof schemas.patchUserReportSchema>) {
    const { data } = await api.patch<{ report: AdminUserReport }>(`/admin/reports/${id}`, body);
    return data.report;
  },
};

export const incidentsApi = {
  async list() {
    const { data } = await api.get<{ incidents: Incident[] }>('/incidents');
    return data.incidents;
  },
  async get(id: string) {
    const { data } = await api.get<{ incident: Incident }>(`/incidents/${id}`);
    return data.incident;
  },
  async update(id: string, body: z.infer<typeof schemas.updateIncidentSchema>) {
    const { data } = await api.patch<{ incident: Incident }>(`/incidents/${id}`, body);
    return data.incident;
  },
};

export const announcementsApi = {
  async list() {
    const { data } = await api.get<{ announcements: Announcement[] }>('/announcements');
    return data.announcements;
  },
};

export interface CtfdImportStats {
  categoriesCreated: number;
  categoriesReused: number;
  challengesCreated: number;
  challengesUpdated: number;
  channelsCreated: number;
  channelsUpdated: number;
  skipped: number;
}

export interface AdminRuntimeInfo {
  nodeEnv: string;
  uploadMaxMb: number;
  uploadDir: string;
  accessTokenTtlSec: number;
  refreshTokenTtlSec: number;
  cookieSecure: boolean;
  corsOrigin: string;
}

export const friendsApi = {
  async summary() {
    const { data } = await api.get<{
      accepted: FriendshipRowLite[];
      pendingIncoming: FriendshipRowLite[];
      pendingOutgoing: FriendshipRowLite[];
    }>('/friends');
    return data;
  },
  async request(username: string) {
    const { data } = await api.post('/friends/request', { username });
    return data;
  },
  async accept(id: string) {
    const { data } = await api.post(`/friends/${id}/accept`);
    return data;
  },
  async reject(id: string) {
    const { data } = await api.post(`/friends/${id}/reject`);
    return data;
  },
  async unfriend(id: string) {
    await api.delete(`/friends/${id}`);
  },
};

type FriendshipRowLite = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: string;
  requester: PublicUser;
  addressee: PublicUser;
};

export const directApi = {
  async open(peerUserId: string) {
    const { data } = await api.post<{ channel: Channel; channelId: string }>('/direct/open', { peerUserId });
    return data;
  },
};

export type AdminTeamRow = {
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
  captain: PublicUser | null;
  inviteCode: string;
};

export const adminTeamsApi = {
  async list() {
    const { data } = await api.get<{ teams: AdminTeamRow[] }>('/admin/teams');
    return data.teams;
  },
  async create(body: z.infer<typeof schemas.adminCreateTeamSchema>) {
    const { data } = await api.post<{ team: AdminTeamRow }>('/admin/teams', body);
    return data.team;
  },
  async update(id: string, body: z.infer<typeof schemas.adminPatchTeamSchema>) {
    const { data } = await api.patch<{ team: AdminTeamRow }>(`/admin/teams/${id}`, body);
    return data.team;
  },
  async remove(id: string) {
    await api.delete(`/admin/teams/${id}`);
  },
  async members(teamId: string) {
    const { data } = await api.get<{ users: PublicUser[] }>(`/admin/teams/${teamId}/members`);
    return data.users;
  },
  async assignMember(teamId: string, identifier: string) {
    const trimmed = identifier.trim().replace(/^@/, '');
    const body = /^c[a-z0-9]{20,}$/i.test(trimmed) ? { userId: trimmed } : { username: trimmed };
    const { data } = await api.post<{ users: PublicUser[] }>(`/admin/teams/${teamId}/members`, body);
    return data.users;
  },
  async removeMember(teamId: string, userId: string) {
    const { data } = await api.delete<{ users: PublicUser[] }>(
      `/admin/teams/${teamId}/members/${userId}`,
    );
    return data.users;
  },
  async setCaptain(teamId: string, userId: string | null) {
    const { data } = await api.patch<{ team: AdminTeamRow }>(`/admin/teams/${teamId}/captain`, { userId });
    return data.team;
  },
  async regenerateInvite(teamId: string) {
    const { data } = await api.post<{ team: AdminTeamRow }>(`/admin/teams/${teamId}/invite/regenerate`);
    return data.team;
  },
};

export const adminApi = {
  async runtime() {
    const { data } = await api.get<AdminRuntimeInfo>('/admin/runtime');
    return data;
  },
  async importCtfd(file: File) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<{ ok: boolean; stats: CtfdImportStats }>('/admin/import/ctfd', form, {
      timeout: 120_000,
    });
    return data;
  },
  async kpis() {
    const { data } = await api.get<KPISnapshot>('/admin/kpis');
    return data;
  },
  async activity() {
    const { data } = await api.get<{ buckets: ActivityBucket[] }>('/admin/activity');
    return data.buckets;
  },
  async audit(filters?: {
    q?: string;
    action?: string;
    actorId?: string;
    target?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) {
    const { data } = await api.get<{
      entries: AuditLogEntry[];
      total: number;
      limit: number;
      offset: number;
    }>('/admin/audit', { params: filters });
    return data;
  },
  async auditActions() {
    const { data } = await api.get<{ actions: string[] }>('/admin/audit/actions');
    return data.actions;
  },
  async system() {
    const { data } = await api.get<AdminSystemInfo>('/admin/system');
    return data;
  },
  async getUploadMaxMb() {
    const { data } = await api.get<{ uploadMaxMb: number }>('/admin/settings/upload');
    return data.uploadMaxMb;
  },
  async setUploadMaxMb(uploadMaxMb: number) {
    const { data } = await api.patch<{ uploadMaxMb: number }>('/admin/settings/upload', { uploadMaxMb });
    return data.uploadMaxMb;
  },
  async getBranding() {
    const { data } = await api.get<PlatformBranding>('/admin/settings/branding');
    return data;
  },
  async setBranding(body: z.infer<typeof schemas.patchPlatformBrandingSchema>) {
    const { data } = await api.patch<PlatformBranding>('/admin/settings/branding', body);
    return data;
  },
};

export type AdminBroadcastRow = {
  id: string;
  kind: 'MASS_DM' | 'PLATFORM_ANNOUNCEMENT' | string;
  title: string;
  body: string;
  recipientCount: number;
  createdAt: string;
  createdBy: PublicUser | null;
};

export const adminBroadcastsApi = {
  async history() {
    const { data } = await api.get<{ broadcasts: AdminBroadcastRow[] }>('/admin/broadcasts/history');
    return data.broadcasts;
  },
  async massDm(body: { title: string; body: string }) {
    const { data } = await api.post<{ broadcast: AdminBroadcastRow }>('/admin/broadcasts/mass-dm', body);
    return data.broadcast;
  },
  async announcement(body: z.infer<typeof schemas.createAnnouncementSchema>) {
    const { data } = await api.post<{ broadcast: AdminBroadcastRow }>('/admin/broadcasts/announcement', body);
    return data.broadcast;
  },
};

export type AdminModerationUser = PublicUser & {
  isBanned: boolean;
  mutedUntil: string | null;
  mutedSince?: string | null;
};

export type MuteHistoryEntry = {
  id: string;
  at: string;
  userId: string | null;
  username: string;
  displayName: string;
  teamName: string | null;
  kind: 'mute' | 'unmute' | 'ban' | 'unban' | 'other';
  muteMinutes: number | null;
  mutedSince: string | null;
  mutedUntil: string | null;
  isBanned: boolean | null;
  status: 'active' | 'ended' | '—';
  actor: PublicUser | null;
};

export const adminUsersApi = {
  async search(q?: string) {
    const { data } = await api.get<{ users: AdminModerationUser[] }>('/admin/users', { params: q ? { q } : {} });
    return data.users;
  },
  async setModeration(
    userId: string,
    body: { isBanned?: boolean; mutedUntil?: string | null; muteMinutes?: number },
  ) {
    const { data } = await api.patch<{ user: AdminModerationUser }>(`/admin/users/${userId}/moderation`, body);
    return data.user;
  },
  async listMuted() {
    const { data } = await api.get<{ users: AdminModerationUser[] }>('/admin/users/muted');
    return data.users;
  },
  async muteHistory() {
    const { data } = await api.get<{ entries: MuteHistoryEntry[] }>('/admin/users/mutes/history');
    return data.entries;
  },
};

export type AdminSystemInfo = {
  userCount: number;
  bannedCount: number;
  teamCount: number;
  channelCount: number;
  messageCount: number;
  auditCount: number;
  activeSurveys: number;
  onlineUsers: number;
};

export const surveysApi = {
  async pending() {
    const { data } = await api.get<{ surveys: SurveyDto[] }>('/surveys/pending');
    return data.surveys;
  },
  async respond(surveyId: string, body: z.infer<typeof schemas.submitSurveyResponseSchema>) {
    await api.post(`/surveys/${surveyId}/respond`, body);
  },
};

export const adminSurveysApi = {
  async list() {
    const { data } = await api.get<{ surveys: SurveyDto[] }>('/admin/surveys');
    return data.surveys;
  },
  async create(body: z.infer<typeof schemas.createSurveySchema>) {
    const { data } = await api.post<{ survey: SurveyDto }>('/admin/surveys', body);
    return data.survey;
  },
  async update(id: string, body: z.infer<typeof schemas.patchSurveySchema>) {
    const { data } = await api.patch<{ survey: SurveyDto }>(`/admin/surveys/${id}`, body);
    return data.survey;
  },
  async remove(id: string) {
    await api.delete(`/admin/surveys/${id}`);
  },
  async stats(id: string) {
    const { data } = await api.get<{ stats: SurveyStatsDto }>(`/admin/surveys/${id}/stats`);
    return data.stats;
  },
};
