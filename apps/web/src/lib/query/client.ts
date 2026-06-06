import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status === 401 || status === 403 || status === 404) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export const queryKeys = {
  me: ['auth', 'me'] as const,
  channels: (serverId?: string) => ['channels', serverId ?? ''] as const,
  channelsAll: ['channels'] as const,
  servers: ['servers'] as const,
  server: (id: string) => ['servers', id] as const,
  serverMembers: (id: string, q?: string) => ['servers', id, 'members', q ?? ''] as const,
  serverInvites: (id: string) => ['servers', id, 'invites'] as const,
  serverMe: (id: string) => ['servers', id, 'me'] as const,
  channel: (id: string) => ['channel', id] as const,
  messages: (channelId: string) => ['messages', channelId] as const,
  pins: (channelId: string) => ['pins', channelId] as const,
  scoreboard: ['scoreboard'] as const,
  timeline: ['scoreboard', 'timeline'] as const,
  challenges: (filters?: unknown) => ['challenges', filters] as const,
  challenge: (id: string) => ['challenge', id] as const,
  tickets: ['tickets'] as const,
  ticket: (id: string) => ['ticket', id] as const,
  teams: ['teams'] as const,
  team: (id: string) => ['team', id] as const,
  teamCtfd: (id: string) => ['team', id, 'ctfd'] as const,
  usersOnline: ['users', 'online'] as const,
  incidents: ['incidents'] as const,
  incident: (id: string) => ['incidents', id] as const,
  announcements: ['announcements'] as const,
  kpis: ['admin', 'kpis'] as const,
  activity: ['admin', 'activity'] as const,
  audit: ['admin', 'audit'] as const,
  auditActions: ['admin', 'audit', 'actions'] as const,
  adminSystem: ['admin', 'system'] as const,
  adminTeams: (serverId: string) => ['admin', 'teams', serverId] as const,
  serverIntegrations: (id: string) => ['servers', id, 'integrations'] as const,
  serverWebhooks: (id: string) => ['servers', id, 'webhooks'] as const,
  serverAnnouncements: (id: string) => ['servers', id, 'announcements'] as const,
  serverMyTeam: (id: string) => ['servers', id, 'my-team'] as const,
  serverRoles: (id: string) => ['servers', id, 'roles'] as const,
  memberRoles: (serverId: string, userId: string) => ['servers', serverId, 'members', userId, 'roles'] as const,
  serverMemberRoleGroups: (serverId: string) => ['servers', serverId, 'members', 'by-role'] as const,
  serverPinsByCategory: (serverId: string) => ['servers', serverId, 'pins-by-category'] as const,
  channelMentionSuggest: (channelId: string, q: string) => ['channels', channelId, 'mention-suggest', q] as const,
  platformPages: ['platform-pages'] as const,
  platformPage: (slug: string) => ['platform-pages', slug] as const,
  userSuggest: (q: string, serverId?: string) => ['users', 'suggest', q, serverId ?? ''] as const,
  notificationsFeed: ['notifications', 'announcements'] as const,
  adminSurveys: ['admin', 'surveys'] as const,
  adminSurveyStats: (id: string) => ['admin', 'surveys', id, 'stats'] as const,
  surveysPending: ['surveys', 'pending'] as const,
  friends: ['friends'] as const,
  userProfile: (id: string) => ['users', id, 'profile'] as const,
  adminReports: (status?: string) => ['admin', 'reports', status ?? 'all'] as const,
};
