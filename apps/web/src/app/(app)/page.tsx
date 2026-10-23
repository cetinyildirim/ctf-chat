'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { channelsApi, serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useServerStore } from '@/store/server';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { NoServerOnboarding } from '@/components/servers/NoServerOnboarding';
import { useI18n } from '@/components/providers/LocaleProvider';

export default function Home() {
  const { t } = useI18n();
  const router = useRouter();
  const activeServerId = useServerStore((s) => s.activeServerId);

  const { data: servers = [], isLoading: serversLoading } = useQuery({
    queryKey: queryKeys.servers,
    queryFn: serversApi.list,
  });

  const { data } = useQuery({
    queryKey: queryKeys.channels(activeServerId ?? ''),
    queryFn: () => channelsApi.list(activeServerId!),
    enabled: !!activeServerId,
  });

  React.useEffect(() => {
    if (!data) return;
    const preferred =
      data.channels.find((c) => c.name === 'live-ops') ??
      data.channels.find((c) => c.name === 'lobby') ??
      data.channels.find((c) => !c.isLocked && c.type !== 'GLOBAL_ANNOUNCEMENT') ??
      data.channels[0];
    if (preferred) router.replace(`/channels/${preferred.id}`);
  }, [data, router]);

  if (serversLoading) return <LoadingScreen label={t.ticketsLoading} />;

  if (!servers.length) return <NoServerOnboarding />;

  // Keep the loading UI visible while channels resolve and while we redirect into a channel.
  // Returning null here produced a blank first paint on `/`.
  return <LoadingScreen label={t.ticketsLoading} />;
}
