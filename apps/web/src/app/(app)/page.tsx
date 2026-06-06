'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { channelsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useServerStore } from '@/store/server';
import { LoadingScreen } from '@/components/common/LoadingScreen';

export default function Home() {
  const router = useRouter();
  const activeServerId = useServerStore((s) => s.activeServerId);
  const { data, isLoading } = useQuery({
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

  if (isLoading || !data) return <LoadingScreen />;
  return null;
}
