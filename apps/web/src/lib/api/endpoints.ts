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
  TicketBulkResult,
  TicketCategoryDto,
  TicketDetailResponse,
  TicketEvent,
  TicketListPage,
  TicketMeta,
  TicketRelationDto,
  TicketReportDto,
  TicketStatsDto,
  TicketTagDto,
  CompetitionSettingsDto,
  NotificationsPage,
  AuditLogEntry,
  ActivityBucket,
  ChannelsListPayload,
  ChannelNotifyMode,
  CtfdScoreboardSnapshotDto,
  ChatServer,
  ServerInvite,
  ServerMemberProfile,
  SurveyDto,
  SurveyStatsDto,
  PlatformBranding,
  PlatformPage,
  RegistrationSettings,
} from '@sydt/shared';
import { schemas } from '@sydt/shared';
import type { Role } from '@sydt/shared';
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
  async changePassword(body: z.infer<typeof schemas.changePasswordSchema>) {
    const { data } = await api.post<{ user: SessionUser }>('/auth/change-password', body);
    return data.user;
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
  async listTeams(serverId: string) {
    const { data } = await api.get<{
      teams: Array<{
        id: string;
        name: string;
        color: string;
        logoUrl: string | null;
        tagline: string | null;
        memberCount: number;
      }>;
    }>(`/servers/${serverId}/teams`);
    return data.teams;
  },
  async getCtfdScoreboard(serverId: string) {
    const { data } = await api.get<CtfdScoreboardSnapshotDto>(`/servers/${serverId}/scoreboard/ctfd`);
    return data;
  },
  async getCtfdStats(serverId: string) {
    const { data } = await api.get<{ stats: import('@sydt/shared').CtfdStatsSnapshotDto | null; generatedAt: string }>(
      `/servers/${serverId}/scoreboard/ctfd/stats`,
    );
    return data;
  },
  async getServerScoreboard(serverId: string) {
    const { data } = await api.get<ScoreboardSnapshot>(`/servers/${serverId}/scoreboard`);
    return data;
  },
  async getServerScoreboardTimeline(serverId: string) {
    const { data } = await api.get<{ points: SolveTimelinePoint[] }>(`/servers/${serverId}/scoreboard/timeline`);
    return data.points;
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
  async testCtfdConnection(
    serverId: string,
    body: z.infer<typeof schemas.testCtfdConnectionSchema> = {},
  ) {
    const { data } = await api.post<{
      ok: boolean;
      teamCount: number | null;
      statsAvailable: boolean;
      statsChallengeCount: number | null;
      code: 'success' | 'auth_failed' | 'unreachable' | 'invalid_url' | 'token_required' | 'error';
      detail?: string;
    }>(`/servers/${serverId}/integrations/ctfd/test`, body);
    return data;
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
  async myPermissions(serverId: string) {
    const { data } = await api.get<{ permissions: import('@sydt/shared').ServerPermKey[] }>(
      `/servers/${serverId}/my-permissions`,
    );
    return data.permissions;
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
  async list(serverId: string, opts?: { includeEmpty?: boolean }) {
    const { data } = await api.get<ChannelsListPayload>('/channels', {
      params: {
        serverId,
        ...(opts?.includeEmpty ? { includeEmpty: '1' } : {}),
      },
    });
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
  async createTeamChannel(body: z.infer<typeof schemas.createTeamChannelSchema>) {
    const { data } = await api.post<{ channel: Channel }>('/channels/team', body);
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

export interface TicketFilters {
  status?: string[];
  priority?: string[];
  categoryId?: string;
  challengeId?: string;
  assignedToId?: string;
  teamId?: string;
  tagId?: string;
  scope?: 'mine' | 'team' | 'all';
  q?: string;
  unassigned?: boolean;
  sort?: 'updated' | 'created' | 'priority';
  cursor?: string;
  limit?: number;
}

export const ticketsApi = {
  /** Tickets are always scoped to one competition (server). */
  async list(serverId: string, filters?: TicketFilters) {
    const { data } = await api.get<TicketListPage>(`/servers/${serverId}/tickets`, {
      params: {
        ...(filters?.status?.length ? { status: filters.status.join(',') } : {}),
        ...(filters?.priority?.length ? { priority: filters.priority.join(',') } : {}),
        ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters?.challengeId ? { challengeId: filters.challengeId } : {}),
        ...(filters?.assignedToId ? { assignedToId: filters.assignedToId } : {}),
        ...(filters?.teamId ? { teamId: filters.teamId } : {}),
        ...(filters?.tagId ? { tagId: filters.tagId } : {}),
        ...(filters?.scope ? { scope: filters.scope } : {}),
        ...(filters?.q ? { q: filters.q } : {}),
        ...(filters?.unassigned ? { unassigned: true } : {}),
        ...(filters?.sort ? { sort: filters.sort } : {}),
        ...(filters?.cursor ? { cursor: filters.cursor } : {}),
        ...(filters?.limit ? { limit: filters.limit } : {}),
      },
    });
    return data;
  },
  async meta(serverId: string) {
    const { data } = await api.get<TicketMeta>(`/servers/${serverId}/tickets/meta`);
    return data;
  },
  async get(id: string) {
    const { data } = await api.get<TicketDetailResponse>(`/tickets/${id}`);
    return data;
  },
  /** Files are optional; with them the request switches to multipart. */
  async create(
    serverId: string,
    input: z.infer<typeof schemas.createTicketSchema>,
    files?: File[],
  ) {
    if (!files?.length) {
      const { data } = await api.post<{ ticket: Ticket }>(`/servers/${serverId}/tickets`, input);
      return data.ticket;
    }
    const form = new FormData();
    form.append('title', input.title);
    form.append('body', input.body);
    form.append('priority', input.priority);
    if (input.categoryId) form.append('categoryId', input.categoryId);
    if (input.challengeId) form.append('challengeId', input.challengeId);
    if (input.tagIds?.length) form.append('tagIds', input.tagIds.join(','));
    for (const file of files) form.append('files', file);
    const { data } = await api.post<{ ticket: Ticket }>(`/servers/${serverId}/tickets`, form);
    return data.ticket;
  },
  async comment(id: string, body: string, internal = false, files?: File[]) {
    if (!files?.length) {
      const { data } = await api.post<{ ticket: Ticket; event: TicketEvent }>(
        `/tickets/${id}/comment`,
        { body, internal },
      );
      return data;
    }
    const form = new FormData();
    form.append('body', body);
    form.append('internal', String(internal));
    for (const file of files) form.append('files', file);
    const { data } = await api.post<{ ticket: Ticket; event: TicketEvent }>(
      `/tickets/${id}/comment`,
      form,
    );
    return data;
  },
  async patch(id: string, patch: z.infer<typeof schemas.patchTicketSchema>) {
    const { data } = await api.patch<{ ticket: Ticket }>(`/tickets/${id}`, patch);
    return data.ticket;
  },
  async claim(id: string) {
    const { data } = await api.post<{ ticket: Ticket }>(`/tickets/${id}/claim`);
    return data.ticket;
  },
  async reopen(id: string, body: string) {
    const { data } = await api.post<{ ticket: Ticket; event: TicketEvent }>(`/tickets/${id}/reopen`, {
      body,
    });
    return data;
  },
  async markRead(id: string) {
    await api.post(`/tickets/${id}/read`);
  },
  async setStatus(id: string, status: string) {
    const { data } = await api.patch<{ ticket: Ticket }>(`/tickets/${id}`, { status });
    return data.ticket;
  },
  async setPriority(id: string, priority: string) {
    const { data } = await api.patch<{ ticket: Ticket }>(`/tickets/${id}`, { priority });
    return data.ticket;
  },
  async bulk(serverId: string, input: z.infer<typeof schemas.ticketBulkSchema>) {
    const { data } = await api.post<TicketBulkResult>(`/servers/${serverId}/tickets/bulk`, input);
    return data;
  },
  async addRelation(id: string, input: z.infer<typeof schemas.ticketRelationSchema>) {
    const { data } = await api.post<{ relation: TicketRelationDto }>(
      `/tickets/${id}/relations`,
      input,
    );
    return data.relation;
  },
  async removeRelation(id: string, relationId: string) {
    await api.delete(`/tickets/${id}/relations/${relationId}`);
  },
  async announce(id: string, input: z.infer<typeof schemas.ticketAnnounceSchema>) {
    const { data } = await api.post<{ announcement: Announcement; ticket: Ticket }>(
      `/tickets/${id}/announce`,
      input,
    );
    return data;
  },
  async stats(serverId: string) {
    const { data } = await api.get<TicketStatsDto>(`/servers/${serverId}/tickets/stats`);
    return data;
  },
  async report(serverId: string) {
    const { data } = await api.get<TicketReportDto>(`/servers/${serverId}/tickets/report`);
    return data;
  },
};

/** Ticket configuration for one competition (organizer admin surface). */
export const ticketAdminApi = {
  async categories(serverId: string) {
    const { data } = await api.get<{
      categories: Array<TicketCategoryDto & { ticketCount: number }>;
    }>(`/servers/${serverId}/ticket-categories`);
    return data.categories;
  },
  async createCategory(serverId: string, input: z.infer<typeof schemas.ticketCategorySchema>) {
    const { data } = await api.post<{ category: TicketCategoryDto }>(
      `/servers/${serverId}/ticket-categories`,
      input,
    );
    return data.category;
  },
  async patchCategory(
    serverId: string,
    categoryId: string,
    input: Partial<z.infer<typeof schemas.ticketCategorySchema>>,
  ) {
    const { data } = await api.patch<{ category: TicketCategoryDto }>(
      `/servers/${serverId}/ticket-categories/${categoryId}`,
      input,
    );
    return data.category;
  },
  async deleteCategory(serverId: string, categoryId: string) {
    const { data } = await api.delete<{ deactivated: boolean }>(
      `/servers/${serverId}/ticket-categories/${categoryId}`,
    );
    return data;
  },
  async tags(serverId: string) {
    const { data } = await api.get<{ tags: Array<TicketTagDto & { ticketCount: number }> }>(
      `/servers/${serverId}/ticket-tags`,
    );
    return data.tags;
  },
  async createTag(serverId: string, input: z.infer<typeof schemas.ticketTagSchema>) {
    const { data } = await api.post<{ tag: TicketTagDto }>(
      `/servers/${serverId}/ticket-tags`,
      input,
    );
    return data.tag;
  },
  async deleteTag(serverId: string, tagId: string) {
    await api.delete(`/servers/${serverId}/ticket-tags/${tagId}`);
  },
  async competition(serverId: string) {
    const { data } = await api.get<{ competition: CompetitionSettingsDto }>(
      `/servers/${serverId}/competition`,
    );
    return data.competition;
  },
  async patchCompetition(
    serverId: string,
    input: z.infer<typeof schemas.patchCompetitionSchema>,
  ) {
    const { data } = await api.patch<{ competition: CompetitionSettingsDto }>(
      `/servers/${serverId}/competition`,
      input,
    );
    return data.competition;
  },
};

export const notificationsApi = {
  async list(params?: { unreadOnly?: boolean; cursor?: string; limit?: number }) {
    const { data } = await api.get<NotificationsPage>('/notifications', { params });
    return data;
  },
  async markRead(id: string) {
    const { data } = await api.post<{ unreadCount: number }>(`/notifications/${id}/read`);
    return data.unreadCount;
  },
  async markAllRead() {
    await api.post('/notifications/read-all');
  },
  async remove(id: string) {
    await api.delete(`/notifications/${id}`);
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
  async joinPreview(inviteCode: string, serverId?: string) {
    const { data } = await api.get<{
      team: {
        id: string;
        name: string;
        color: string;
        logoUrl: string | null;
        memberCount: number;
        server: ChatServer | null;
      };
      alreadyOnTeam: boolean;
      alreadyOnOtherTeam: boolean;
    }>('/teams/my/join-preview', {
      params: { inviteCode, ...(serverId ? { serverId } : {}) },
    });
    return data;
  },
  async joinByInvite(inviteCode: string, serverId?: string) {
    const { data } = await api.post<{
      team: Team;
      me: SessionUser;
      alreadyMember: boolean;
    }>('/teams/my/join', {
      inviteCode,
      ...(serverId ? { serverId } : {}),
    });
    return data;
  },
  async getMyInvite() {
    const { data } = await api.get<{ inviteCode: string; teamId: string; serverId: string | null }>(
      '/teams/my/invite',
    );
    return data;
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
  async list(serverId?: string) {
    const { data } = await api.get<{ incidents: Incident[] }>('/incidents', {
      params: serverId ? { serverId } : undefined,
    });
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
  async pendingAck() {
    const { data } = await api.get<{ announcements: Announcement[] }>('/announcements/pending-ack');
    return data.announcements;
  },
  async ack(id: string) {
    await api.post(`/announcements/${id}/ack`);
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

export interface CtfdChallengesPreviewChannel {
  key: string;
  name: string;
  category: string;
  description: string;
  value: string;
  state: string;
  ctfdId?: string;
}

export interface CtfdChallengesPreviewCategory {
  key: string;
  name: string;
  channels: CtfdChallengesPreviewChannel[];
}

export interface CtfdChallengesPreview {
  categories: CtfdChallengesPreviewCategory[];
  totalCategories: number;
  totalChannels: number;
}

export type CtfdTeamsPreviewMemberStatus =
  | 'create'
  | 'create_username_suffix'
  | 'update_existing'
  | 'update_server_member';

export interface CtfdTeamsPreviewMember {
  key: string;
  displayName: string;
  email: string;
  isCaptain: boolean;
  status: CtfdTeamsPreviewMemberStatus;
  plannedUsername: string;
}

export type CtfdTeamsPreviewTeamStatus = 'create' | 'reuse';

export interface CtfdTeamsPreviewTeam {
  key: string;
  name: string;
  teamStatus: CtfdTeamsPreviewTeamStatus;
  members: CtfdTeamsPreviewMember[];
}

export interface CtfdTeamsPreview {
  teams: CtfdTeamsPreviewTeam[];
  totalTeams: number;
  totalMembers: number;
}

export interface CtfdTeamsImportCredential {
  teamName: string;
  username: string;
  email: string;
  password: string;
  role: 'captain' | 'member';
}

export interface CtfdTeamsImportStats {
  teamsCreated: number;
  teamsReused: number;
  usersCreated: number;
  usersUpdated: number;
  serverMembersAdded: number;
  skipped: number;
  credentials: CtfdTeamsImportCredential[];
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
      accepted: Array<FriendshipRowLite & { dmChannelId: string | null; unreadCount: number }>;
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

export type DirectConversation = {
  channelId: string;
  peer: PublicUser;
  lastMessage: {
    id: string;
    authorId: string;
    preview: string;
    attachmentCount: number;
    createdAt: string;
  };
  unreadCount: number;
};

export const directApi = {
  async conversations() {
    const { data } = await api.get<{ conversations: DirectConversation[]; totalUnread: number }>('/direct');
    return data;
  },
  async open(peerUserId: string) {
    const { data } = await api.post<{ channel: Channel; channelId: string }>('/direct/open', { peerUserId });
    return data;
  },
  async markRead(channelId: string) {
    await api.post(`/direct/${channelId}/read`);
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
  async previewCtfdChallenges(file: File) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<{ ok: boolean; preview: CtfdChallengesPreview }>(
      '/admin/import/ctfd/preview',
      form,
      { timeout: 60_000 },
    );
    return data.preview;
  },
  async applyCtfdChallenges(serverId: string, channels: CtfdChallengesPreviewChannel[]) {
    const { data } = await api.post<{ ok: boolean; stats: CtfdImportStats }>(
      '/admin/import/ctfd/apply',
      { serverId, channels },
      { timeout: 120_000 },
    );
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
  async importCtfdTeams(file: File, serverId: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('serverId', serverId);
    const { data } = await api.post<{ ok: boolean; stats: CtfdTeamsImportStats }>(
      '/admin/import/ctfd-teams/apply',
      form,
      { timeout: 180_000 },
    );
    return data;
  },
  async previewCtfdTeams(file: File, serverId: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('serverId', serverId);
    const { data } = await api.post<{ ok: boolean; preview: CtfdTeamsPreview }>(
      '/admin/import/ctfd-teams/preview',
      form,
      { timeout: 60_000 },
    );
    return data.preview;
  },
  async applyCtfdTeams(
    serverId: string,
    members: Array<{
      key: string;
      teamName: string;
      displayName: string;
      email: string;
      isCaptain: boolean;
      serverRoleId?: string;
    }>,
  ) {
    const { data } = await api.post<{ ok: boolean; stats: CtfdTeamsImportStats }>(
      '/admin/import/ctfd-teams/apply',
      { serverId, members },
      { timeout: 180_000 },
    );
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
  async getRegistrationSettings() {
    const { data } = await api.get<RegistrationSettings>('/admin/settings/registration');
    return data;
  },
  async setRegistrationSettings(body: z.infer<typeof schemas.patchRegistrationSettingsSchema>) {
    const { data } = await api.patch<RegistrationSettings>('/admin/settings/registration', body);
    return data;
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

export type BackupFrequency = 'EVERY_6H' | 'EVERY_12H' | 'DAILY' | 'WEEKLY';

export type BackupSettings = {
  enabled: boolean;
  frequency: BackupFrequency;
  hour: number;
  weekday: number;
  retention: number;
  includeUploads: boolean;
};

export type BackupFile = {
  name: string;
  sizeBytes: number;
  createdAt: string;
  trigger: 'auto' | 'manual';
};

export type BackupOverview = {
  settings: BackupSettings;
  lastRun: {
    at: string;
    status: 'OK' | 'FAILED' | null;
    error: string | null;
    durationMs: number | null;
    sizeBytes: number | null;
  } | null;
  nextRunAt: string | null;
  running: { trigger: 'auto' | 'manual'; startedAt: string } | null;
  backupDir: string;
  uploadDir: string;
  diskFreeBytes: number | null;
  serverTime: string;
  backups: BackupFile[];
};

export const adminBackupsApi = {
  async overview() {
    const { data } = await api.get<BackupOverview>('/admin/backups');
    return data;
  },
  async updateSettings(patch: Partial<BackupSettings>) {
    const { data } = await api.patch<{ ok: true; nextRunAt: string | null }>('/admin/backups/settings', patch);
    return data;
  },
  async run() {
    await api.post('/admin/backups/run');
  },
  async remove(name: string) {
    await api.delete(`/admin/backups/${encodeURIComponent(name)}`);
  },
  downloadUrl(name: string) {
    return `/api/admin/backups/${encodeURIComponent(name)}/download`;
  },
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

export type ModerationBody = {
  isBanned?: boolean;
  mutedUntil?: string | null;
  muteMinutes?: number;
  banMinutes?: number | null;
  reason?: string | null;
};

export type AdminModerationUser = PublicUser & {
  isBanned: boolean;
  bannedUntil?: string | null;
  banReason?: string | null;
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
    body: ModerationBody,
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

export type ManagedUserStatusFilter = 'active' | 'disabled' | 'banned' | 'muted' | 'mustChange';

export type ManagedUserFilters = {
  q?: string;
  role?: Role | '';
  serverId?: string;
  status?: ManagedUserStatusFilter | '';
};

export type ManagedUser = PublicUser & {
  email: string;
  createdAt: string;
  lastSeenAt: string | null;
  isBanned: boolean;
  bannedUntil: string | null;
  mutedUntil: string | null;
  disabledAt: string | null;
  disabledReason: string | null;
  mustChangePassword: boolean;
  serverCount: number;
};

export type ManagedUserDetail = {
  user: ManagedUser;
  activeSessions: number;
  servers: Array<{
    serverId: string;
    name: string;
    iconUrl: string | null;
    joinedAt: string;
    bannedAt: string | null;
    roles: Array<{ id: string; name: string; color: string }>;
    team: { id: string; name: string; color: string } | null;
  }>;
};

export type ManagedServer = {
  id: string;
  name: string;
  iconUrl: string | null;
  autoJoinNewUsers: boolean;
  memberCount: number;
  roles: Array<{ id: string; name: string; color: string }>;
};

export type BulkMembershipSource =
  | { type: 'all' }
  | { type: 'users'; userIds: string[] }
  | { type: 'platformRole'; role: Role }
  | { type: 'server'; serverId: string; roleId?: string | null };

export type BulkMembershipBody = {
  action: 'add' | 'move' | 'remove';
  source: BulkMembershipSource;
  targetServerId?: string;
  targetRoleId?: string | null;
  fromServerId?: string;
  includeDisabled?: boolean;
};

export type BulkMembershipResult = {
  matched: number;
  added: number;
  unbanned: number;
  existing: number;
  removed: number;
};

export type CreateManagedUserBody = {
  email: string;
  username: string;
  displayName: string;
  password?: string;
  mustChangePassword?: boolean;
  role: Role;
  serverId?: string;
  serverRoleId?: string | null;
};

function managedFilterParams(f: ManagedUserFilters) {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ''));
}

export const adminUserManageApi = {
  async list(filters: ManagedUserFilters & { page?: number; pageSize?: number }) {
    const { data } = await api.get<{ users: ManagedUser[]; total: number; page: number; pageSize: number }>(
      '/admin/users/manage',
      { params: managedFilterParams(filters) },
    );
    return data;
  },
  async exportCsv(filters: ManagedUserFilters) {
    const { data } = await api.get<Blob>('/admin/users/manage/export.csv', {
      params: managedFilterParams(filters),
      responseType: 'blob',
    });
    return data;
  },
  async detail(userId: string) {
    const { data } = await api.get<ManagedUserDetail>(`/admin/users/manage/${userId}`);
    return data;
  },
  async create(body: CreateManagedUserBody) {
    const { data } = await api.post<{ id: string; username: string; temporaryPassword: string | null }>(
      '/admin/users/manage',
      body,
    );
    return data;
  },
  async updateProfile(userId: string, body: { displayName?: string; username?: string; email?: string }) {
    await api.patch(`/admin/users/manage/${userId}/profile`, body);
  },
  async setPassword(userId: string, password: string, mustChangePassword: boolean) {
    const { data } = await api.post<{ temporaryPassword: string | null }>(
      `/admin/users/manage/${userId}/password`,
      { mode: 'set', password, mustChangePassword },
    );
    return data;
  },
  async resetPassword(userId: string) {
    const { data } = await api.post<{ temporaryPassword: string | null }>(
      `/admin/users/manage/${userId}/password`,
      { mode: 'reset' },
    );
    return data.temporaryPassword;
  },
  async setRole(userId: string, role: Role) {
    await api.patch(`/admin/users/manage/${userId}/role`, { role });
  },
  async setDisabled(userId: string, disabled: boolean, reason?: string | null) {
    await api.patch(`/admin/users/manage/${userId}/status`, { disabled, reason: reason ?? null });
  },
  async revokeSessions(userId: string) {
    await api.post(`/admin/users/manage/${userId}/sessions/revoke`);
  },
  async addToServer(userId: string, serverId: string, roleId?: string | null) {
    await api.put(`/admin/users/manage/${userId}/servers/${serverId}`, { roleId: roleId ?? null });
  },
  async removeFromServer(userId: string, serverId: string) {
    await api.delete(`/admin/users/manage/${userId}/servers/${serverId}`);
  },
  async servers() {
    const { data } = await api.get<{ servers: ManagedServer[] }>('/admin/users/manage/servers');
    return data.servers;
  },
  async setAutoJoin(serverId: string, enabled: boolean) {
    await api.patch(`/admin/users/manage/servers/${serverId}/auto-join`, { enabled });
  },
  async bulkPreview(body: BulkMembershipBody) {
    const { data } = await api.post<{ matched: number; alreadyInTarget: number }>(
      '/admin/users/manage/membership/bulk',
      { ...body, dryRun: true },
    );
    return data;
  },
  async bulkApply(body: BulkMembershipBody) {
    const { data } = await api.post<BulkMembershipResult>('/admin/users/manage/membership/bulk', body);
    return data;
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
