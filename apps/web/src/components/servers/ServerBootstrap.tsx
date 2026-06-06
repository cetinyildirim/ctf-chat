'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useServerStore } from '@/store/server';

export function ServerBootstrap() {
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServerId = useServerStore((s) => s.setActiveServerId);

  const { data: servers = [] } = useQuery({
    queryKey: queryKeys.servers,
    queryFn: serversApi.list,
  });

  React.useEffect(() => {
    if (!servers.length) return;
    if (activeServerId && servers.some((s) => s.id === activeServerId)) return;
    const preferred = servers.find((s) => s.slug === 'sydt-26') ?? servers[0];
    if (preferred) setActiveServerId(preferred.id);
  }, [servers, activeServerId, setActiveServerId]);

  return null;
}
