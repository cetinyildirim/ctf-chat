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
  ChatServer,
  ServerInvite,
  ServerMemberProfile,
  SurveyDto,
  SurveyStatsDto,
  PlatformBranding,
  PlatformPage,
} from '@sydt/shared';
import { schemas } from '@sydt/shared';
import type { z } from 'zod';
import { api } from './axios';

export const authApi = {
  async ensureCsrf() {
    await api.get('/auth/csrf');
  },
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
  async logoutAll() {
    await api.post('/auth/logout-all');
  },
  async refresh() {
    const { data } = await api.post<{ user: SessionUser }>('/auth/refresh');
    return data.user;
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

export type ServerInvitePreview = {
  code: string;
  server: ChatServer;
  channelId: string | null;
  channelName: string | null;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  expired: boolean;
  alreadyMember: boolean;
  bannedFromServer?: boolean;
};

export const invitesApi = {
  async preview(code: string) {
    const { data } = await api.get<{ invite: ServerInvitePreview }>(`/invites/${encodeURIComponent(code)}`);
    return data.invite;
  },
  async accept(code: string) {
    const { data } = await api.post<{
      server: ChatServer;
      channelId: string | null;
      joined: boolean;
      alreadyMember: boolean;
    }>(`/invites/${encodeURIComponent(code)}/accept`);
    return data;
  },
};

export const serversApi = {
  async list() {
    const { data } = await api.get<{ servers: ChatServer[] }>('/servers');
    return data.servers;
  },
  async listManageable() {
    const { data } = await api.get<{ servers: ChatServer[] }>('/servers/manageable');
    return data.servers;
  },
  async create(body: z.infer<typeof schemas.createChatServerSchema>) {
    const { data } = await api.post<{ server: ChatServer }>('/servers', body);
    return data.server;
  },
  async update(id: string, body: z.infer<typeof schemas.updateChatServerSchema>) {
    const { data } = await api.patch<{ server: ChatServer }>(`/servers/${id}`, body);
    return data.server;
  },
  async remove(id: string) {
    await api.delete(`/servers/${id}`);
  },
  async uploadLogo(id: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<{ server: ChatServer }>(`/servers/${id}/logo`, form, { timeout: 60_000 });
    return data.server;
  },
  async clearLogo(id: string) {
    const { data } = await api.delete<{ server: ChatServer }>(`/servers/${id}/logo`);
    return data.server;
  },
  async getMe(serverId: string) {
    const { data } = await api.get<{ member: ServerMemberProfile }>(`/servers/${serverId}/me`);
    return data.member;
  },
  async patchMe(serverId: string, body: z.infer<typeof schemas.patchServerMemberSchema>) {
    const { data } = await api.patch<{ member: ServerMemberProfile }>(`/servers/${serverId}/me`, body);
    return data.member;
  },
  async uploadMeAvatar(serverId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<{ member: ServerMemberProfile }>(`/servers/${serverId}/me/avatar`, form, {
      timeout: 60_000,
    });
    return data.member;
  },
  async clearMeAvatar(serverId: string) {
    const { data } = await api.delete<{ member: ServerMemberProfile }>(`/servers/${serverId}/me/avatar`);
    return data.member;
  },
  async setNotify(serverId: string, notifyMode: ChannelNotifyMode) {
    const { data } = await api.patch<{ prefs: { serverId: string; notifyMode: string } }>(
      `/servers/${serverId}/me/notifications`,
      { notifyMode },
    );
    return data.prefs;
  },
  async listInvites(serverId: string) {
    const { data } = await api.get<{ invites: ServerInvite[] }>(`/servers/${serverId}/invites`);
    return data.invites;
  },
  async createInvite(serverId: string, body: z.infer<typeof schemas.createServerInviteSchema>) {
    const { data } = await api.post<{ invite: ServerInvite }>(`/servers/${serverId}/invites`, body);
    return data.invite;
  },
  async deleteInvite(serverId: string, inviteId: string) {
    await api.delete(`/servers/${serverId}/invites/${inviteId}`);
  },
  async listMembers(serverId: string, opts?: { q?: string; bannedOnly?: boolean }) {
    const { data } = await api.get<{
      members: Array<
        import('@sydt/shared').PublicUser & {
          nickname: string | null;
          serverAvatarUrl: string | null;
          isBanned?: boolean;
          banReason?: string | null;
        }
      >;
    }>(`/servers/${serverId}/members`, {
      params: {
        ...(opts?.q ? { q: opts.q } : {}),
        ...(opts?.bannedOnly ? { bannedOnly: 'true' } : {}),
      },
    });
    return data.members;
  },
  async banMember(serverId: string, userId: string, reason?: string | null) {
    await api.post(`/servers/${serverId}/members/${userId}/ban`, { reason: reason ?? null });
  },
  async unbanMember(serverId: string, userId: string) {
    await api.delete(`/servers/${serverId}/members/${userId}/ban`);
  },
  async getMyTeam(serverId: string) {
    const { data } = await api.get<{ team: Team | null }>(`/servers/${serverId}/me/team`);
    return data.team;
  },
  async getIntegrations(serverId: string) {
    const { data } = await api.get<{ integrations: import('@sydt/shared').ServerIntegrations }>(
      `/servers/${serverId}/integrations`,
    );
    return data.integrations;
  },
  async patchIntegrations(serverId: string, body: z.infer<typeof schemas.patchServerIntegrationsSchema>) {
    const { data } = await api.patch<{ integrations: import('@sydt/shared').ServerIntegrations }>(
      `/servers/${serverId}/integrations`,
      body,
    );
    return data.integrations;
  },
  async listWebhooks(serverId: string) {
    const { data } = await api.get<{ webhooks: import('@sydt/shared').ServerWebhook[] }>(
      `/servers/${serverId}/webhooks`,
    );
    return data.webhooks;
  },
  async createWebhook(serverId: string, body: z.infer<typeof schemas.createServerWebhookSchema>) {
    const { data } = await api.post<{ webhook: import('@sydt/shared').ServerWebhook }>(
      `/servers/${serverId}/webhooks`,
      body,
    );
    return data.webhook;
  },
  async deleteWebhook(serverId: string, webhookId: string) {
    await api.delete(`/servers/${serverId}/webhooks/${webhookId}`);
  },
  async listAnnouncements(serverId: string) {
    const { data } = await api.get<{ announcements: Announcement[] }>(`/servers/${serverId}/announcements`);
    return data.announcements;
  },
  async createAnnouncement(serverId: string, body: z.infer<typeof schemas.createServerAnnouncementSchema>) {
    const { data } = await api.post<{ announcement: Announcement }>(`/servers/${serverId}/announcements`, body);
    return data.announcement;
  },
  async listRoles(serverId: string) {
    const { data } = await api.get<{ roles: import('@sydt/shared').ServerRole[] }>(`/servers/${serverId}/roles`);
    return data.roles;
  },
  async createRole(serverId: string, body: z.infer<typeof schemas.createServerRoleSchema>) {
    const { data } = await api.post<{ role: import('@sydt/shared').ServerRole }>(`/servers/${serverId}/roles`, body);
    return data.role;
  },
  async updateRole(serverId: string, roleId: string, body: z.infer<typeof schemas.updateServerRoleSchema>) {
    const { data } = await api.patch<{ role: import('@sydt/shared').ServerRole }>(
      `/servers/${serverId}/roles/${roleId}`,
      body,
    );
    return data.role;
  },
  async deleteRole(serverId: string, roleId: string) {
    await api.delete(`/servers/${serverId}/roles/${roleId}`);
  },
  async getMemberRoles(serverId: string, userId: string) {
    const { data } = await api.get<{ roleIds: string[] }>(`/servers/${serverId}/members/${userId}/roles`);
    return data.roleIds;
  },
  async setMemberRoles(serverId: string, userId: string, roleIds: string[]) {
    const { data } = await api.put<{ roleIds: string[] }>(`/servers/${serverId}/members/${userId}/roles`, {
      roleIds,
    });
    return data.roleIds;
  },
  async listPinsByCategory(serverId: string) {
    const { data } = await api.get<{ groups: import('@sydt/shared').PinsByCategoryGroup[] }>(
      `/servers/${serverId}/pins-by-category`,
    );
    return data.groups;
  },
  async getMemberRoleGroups(serverId: string) {
    const { data } = await api.get<{
      groups: Array<{ role: import('@sydt/shared').ServerRole; members: import('@sydt/shared').PublicUser[] }>;
      unassigned: import('@sydt/shared').PublicUser[];
    }>(`/servers/${serverId}/members/by-role`);
    return data;
  },
};

export const channelsApi = {
  async list(serverId: string) {
    const { data } = await api.get<ChannelsListPayload>('/channels', { params: { serverId } });
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
  async mentionSuggest(channelId: string, q: string) {
    const { data } = await api.get<{ users: PublicUser[] }>(`/channels/${channelId}/mention-suggest`, {
      params: { q: q || undefined, limit: 12 },
    });
    return data.users;
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
    const { data } = await api.get<{
      team: Team;
      members: PublicUser[];
      scoreboard?: { totalChallenges: number; totalTeams: number; generatedAt: string };
    }>(`/teams/${id}`);
    return data;
  },
  async getCtfd(id: string) {
    const { data } = await api.get<import('@sydt/shared').TeamCtfdLinkDto>(`/teams/${id}/ctfd`);
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
  async leaveServer(serverId: string) {
    const { data } = await api.delete<{ me: SessionUser }>('/teams/my/membership', {
      data: { serverId },
    });
    return data.me;
  },
};

export const usersApi = {
  async suggest(q: string, opts?: { serverId?: string; limit?: number }) {
    const { data } = await api.get<{ users: PublicUser[] }>('/users/suggest', {
      params: { q, serverId: opts?.serverId, limit: opts?.limit ?? 10 },
    });
    return data.users;
  },
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
};

export const adminTeamsApi = {
  async list(serverId: string) {
    const { data } = await api.get<{ teams: AdminTeamRow[] }>('/admin/teams', { params: { serverId } });
    return data.teams;
  },
  async getInvite(teamId: string) {
    const { data } = await api.get<{ inviteCode: string }>(`/admin/teams/${teamId}/invite`);
    return data.inviteCode;
  },
  async create(serverId: string, body: z.infer<typeof schemas.adminCreateTeamSchema>) {
    const { data } = await api.post<{ team: AdminTeamRow }>('/admin/teams', body, { params: { serverId } });
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
    const { data } = await api.post<{ team: AdminTeamRow; inviteCode: string }>(
      `/admin/teams/${teamId}/invite/regenerate`,
    );
    return data;
  },
};

export const adminApi = {
  async runtime() {
    const { data } = await api.get<AdminRuntimeInfo>('/admin/runtime');
    return data;
  },
  async importCtfd(file: File, serverId: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('serverId', serverId);
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

export const adminPagesApi = {
  async list() {
    const { data } = await api.get<{ pages: PlatformPage[] }>('/admin/pages');
    return data.pages;
  },
  async create(body: z.infer<typeof schemas.createPlatformPageSchema>) {
    const { data } = await api.post<{ page: PlatformPage }>('/admin/pages', body);
    return data.page;
  },
  async update(id: string, body: z.infer<typeof schemas.updatePlatformPageSchema>) {
    const { data } = await api.patch<{ page: PlatformPage }>(`/admin/pages/${id}`, body);
    return data.page;
  },
  async remove(id: string) {
    await api.delete(`/admin/pages/${id}`);
  },
};

export const pagesApi = {
  async getBySlug(slug: string) {
    const { data } = await api.get<{ page: PlatformPage }>(`/pages/${slug}`);
    return data.page;
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
