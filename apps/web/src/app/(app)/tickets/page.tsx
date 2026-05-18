'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { LifeBuoy, Search } from 'lucide-react';
import { ticketsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { TicketComposer } from '@/components/tickets/TicketComposer';
import { StatusPill } from '@/components/tickets/StatusPill';
import { SeverityPill } from '@/components/common/SeverityPill';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { relative } from '@/lib/format/time';
import { useAuthStore } from '@/store/auth';

export default function TicketsPage() {
  const userId = useAuthStore((s) => s.user?.id);

  const { data: tickets, isLoading } = useQuery({
    queryKey: queryKeys.tickets,
    queryFn: ticketsApi.list,
  });

  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState<'all' | 'open' | 'mine'>('all');

  const filtered = React.useMemo(() => {
    let list = tickets ?? [];
    if (filter === 'open') {
      list = list.filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED');
    }
    if (filter === 'mine' && userId) {
      list = list.filter((t) => t.openedBy.id === userId);
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(needle) ||
          t.code.toLowerCase().includes(needle) ||
          t.body.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [tickets, q, filter, userId]);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        title={
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-accent-rose" />
            <span>Support tickets</span>
          </div>
        }
        subtitle="Open issues are routed to staff in realtime"
        right={<TicketComposer />}
      />

      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            placeholder="Search tickets…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'open' | 'mine')}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="mine">Mine</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
            : null}
          {!isLoading && filtered.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title={
                filter === 'mine'
                  ? 'No tickets opened by you'
                  : !tickets?.length
                    ? 'No tickets yet'
                    : 'No tickets match'
              }
              description={
                filter === 'mine'
                  ? 'Switch to All or Open, or create a new ticket.'
                  : q.trim()
                    ? 'Try a different search.'
                    : 'Open one if you hit infrastructure or scoring issues.'
              }
              action={<TicketComposer />}
            />
          ) : null}

          {filtered.map((t) => (
            <Link key={t.id} href={`/tickets/${t.id}`} className="block">
              <GlassPanel
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-all hover:border-accent-cyan/30 hover:shadow-glow-cyan/30"
                tone={
                  t.severity === 'CRITICAL'
                    ? 'rose'
                    : t.severity === 'HIGH'
                    ? 'rose'
                    : t.severity === 'MEDIUM'
                    ? 'amber'
                    : 'emerald'
                }
              >
                <div className="flex flex-col items-center gap-1">
                  <Avatar name={t.openedBy.displayName} src={t.openedBy.avatarUrl} size="md" />
                  <span className="font-mono text-[10px] text-muted-fg">{t.code}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-fg">{t.title}</span>
                    <SeverityPill severity={t.severity} />
                    <StatusPill status={t.status} />
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-fg-subtle">{t.body}</p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-fg">
                    <span>By {t.openedBy.displayName}</span>
                    {t.team ? (
                      <span style={{ color: t.team.color }}>· {t.team.name}</span>
                    ) : null}
                    <span>· updated {relative(t.updatedAt)}</span>
                  </div>
                </div>
                <div className="text-right text-[11px] text-fg-subtle">
                  {t.claimedBy ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar name={t.claimedBy.displayName} src={t.claimedBy.avatarUrl} size="xs" />
                      <span>{t.claimedBy.displayName}</span>
                    </div>
                  ) : (
                    <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-fg">
                      unclaimed
                    </span>
                  )}
                </div>
              </GlassPanel>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
