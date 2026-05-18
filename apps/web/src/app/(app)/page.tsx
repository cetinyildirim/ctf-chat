'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { channelsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { LoadingScreen } from '@/components/common/LoadingScreen';

export default function Home() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.channels,
    queryFn: channelsApi.list,
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
