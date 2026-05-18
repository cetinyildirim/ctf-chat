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
  channels: ['channels'] as const,
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
  usersOnline: ['users', 'online'] as const,
  incidents: ['incidents'] as const,
  incident: (id: string) => ['incidents', id] as const,
  announcements: ['announcements'] as const,
  kpis: ['admin', 'kpis'] as const,
  activity: ['admin', 'activity'] as const,
  audit: ['admin', 'audit'] as const,
  auditActions: ['admin', 'audit', 'actions'] as const,
  adminSystem: ['admin', 'system'] as const,
  adminTeams: ['admin', 'teams'] as const,
  adminSurveys: ['admin', 'surveys'] as const,
  adminSurveyStats: (id: string) => ['admin', 'surveys', id, 'stats'] as const,
  surveysPending: ['surveys', 'pending'] as const,
  friends: ['friends'] as const,
  userProfile: (id: string) => ['users', id, 'profile'] as const,
  adminReports: (status?: string) => ['admin', 'reports', status ?? 'all'] as const,
};
