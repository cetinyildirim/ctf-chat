'use client';

import * as React from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Filter, LifeBuoy, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  Permission,
  TICKET_ACTIVE_STATUSES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@sydt/shared';
import { ticketsApi } from '@/lib/api/endpoints';
import { ticketPriorityLabel, ticketStatusLabel, ticketCategoryLabel } from '@/i18n/ticket-labels';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { TicketComposer } from '@/components/tickets/TicketComposer';
import { StatusPill } from '@/components/tickets/StatusPill';
import { SeverityPill } from '@/components/common/SeverityPill';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { relative } from '@/lib/format/time';
import { useServerStore } from '@/store/server';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/components/providers/LocaleProvider';
import { cn } from '@/lib/utils';

type Scope = 'all' | 'open' | 'mine' | 'team' | 'unassigned';

/** Debounces the search box so each keystroke does not hit the API. */
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function TicketsPage() {
  const { t } = useI18n();
  const activeServerId = useServerStore((s) => s.activeServerId);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [q, setQ] = React.useState('');
  const [scope, setScope] = React.useState<Scope>('all');
  const [statuses, setStatuses] = React.useState<TicketStatus[]>([]);
  const [priorities, setPriorities] = React.useState<TicketPriority[]>([]);
  const [categoryId, setCategoryId] = React.useState('');
  const [showFilters, setShowFilters] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const debouncedQ = useDebounced(q);

  const { data: meta } = useQuery({
    queryKey: queryKeys.ticketMeta(activeServerId ?? ''),
    queryFn: () => ticketsApi.meta(activeServerId!),
    enabled: !!activeServerId,
  });
  const canViewAll = !!meta?.canViewAll;
  const canBulk = canViewAll && !!user?.permissions.includes(Permission.TICKET_BULK);

  // Filtering happens on the server; the client never receives tickets it may
  // not see, so there is nothing to filter locally.
  const filters = React.useMemo(
    () => ({
      ...(debouncedQ.trim() ? { q: debouncedQ.trim() } : {}),
      ...(statuses.length ? { status: statuses } : {}),
      ...(scope === 'open' && !statuses.length ? { status: [...TICKET_ACTIVE_STATUSES] } : {}),
      ...(priorities.length ? { priority: priorities } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(scope === 'mine' ? { scope: 'mine' as const } : {}),
      ...(scope === 'team' ? { scope: 'team' as const } : {}),
      ...(scope === 'unassigned' ? { unassigned: true } : {}),
    }),
    [debouncedQ, scope, statuses, priorities, categoryId],
  );

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: queryKeys.tickets(activeServerId ?? undefined, filters),
    queryFn: ({ pageParam }) =>
      ticketsApi.list(activeServerId!, { ...filters, ...(pageParam ? { cursor: pageParam } : {}) }),
    enabled: !!activeServerId,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const tickets = data?.pages.flatMap((p) => p.tickets) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const hasActiveFilters =
    !!debouncedQ.trim() ||
    statuses.length > 0 ||
    priorities.length > 0 ||
    !!categoryId ||
    scope !== 'all';

  const bulkMutation = useMutation({
    mutationFn: (action: Parameters<typeof ticketsApi.bulk>[1]['action']) =>
      ticketsApi.bulk(activeServerId!, { ticketIds: selected, action }),
    onSuccess: (result) => {
      setSelected([]);
      toast.success(
        result.skipped.length
          ? `${result.applied} ${t.ticketsBulkApplied} · ${result.skipped.length} ${t.ticketBulkSkipped}`
          : `${result.applied} ${t.ticketsBulkApplied}`,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticketsAll });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleFromList = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  const clearFilters = () => {
    setStatuses([]);
    setPriorities([]);
    setCategoryId('');
    setQ('');
    setScope('all');
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        title={
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-accent-rose" />
            <span>{t.ticketsTitle}</span>
          </div>
        }
        subtitle={data ? `${total} ${t.ticketsCount}` : t.ticketsLead}
        right={
          <div className="flex items-center gap-2">
            {canViewAll ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/tickets/ops">
                  <Activity className="h-3.5 w-3.5" /> {t.ticketOpsTitle}
                </Link>
              </Button>
            ) : null}
            <TicketComposer />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            placeholder={t.ticketsSearchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <TabsList>
            <TabsTrigger value="all">{t.ticketsScopeAll}</TabsTrigger>
            <TabsTrigger value="open">{t.ticketsScopeOpen}</TabsTrigger>
            <TabsTrigger value="mine">{t.ticketsScopeMine}</TabsTrigger>
            {canViewAll ? (
              <TabsTrigger value="unassigned">{t.ticketsScopeUnassigned}</TabsTrigger>
            ) : (
              <TabsTrigger value="team">{t.ticketsScopeTeam}</TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        <Button
          size="sm"
          variant={showFilters ? 'subtle' : 'ghost'}
          onClick={() => setShowFilters((prev) => !prev)}
        >
          <Filter className="h-3.5 w-3.5" /> {t.ticketsFilters}
        </Button>
      </div>

      {showFilters ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2">
          {TICKET_STATUSES.map((status) => (
            <FilterChip
              key={status}
              active={statuses.includes(status)}
              onClick={() => setStatuses((prev) => toggleFromList(prev, status))}
            >
              {ticketStatusLabel(t, status)}
            </FilterChip>
          ))}
          <span className="mx-1 h-4 w-px bg-white/10" />
          {TICKET_PRIORITIES.map((priority) => (
            <FilterChip
              key={priority}
              active={priorities.includes(priority)}
              onClick={() => setPriorities((prev) => toggleFromList(prev, priority))}
            >
              {ticketPriorityLabel(t, priority)}
            </FilterChip>
          ))}
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border border-white/10 bg-bg-elev px-2 py-1 text-xs"
          >
            <option value="">{t.ticketFieldCategory}</option>
            {(meta?.categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {ticketCategoryLabel(t, category)}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            {t.ticketsFiltersClear}
          </Button>
        </div>
      ) : null}

      {canBulk && selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-accent-cyan/5 px-4 py-2 text-xs">
          <span className="font-semibold text-accent-cyan">
            {selected.length} {t.ticketBulkSelected}
          </span>
          <select
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              bulkMutation.mutate({ status: e.target.value as TicketStatus });
              e.target.value = '';
            }}
            className="rounded-md border border-white/10 bg-bg-elev px-2 py-1"
          >
            <option value="">{t.ticketBulkStatus}</option>
            {TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ticketStatusLabel(t, status)}
              </option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              bulkMutation.mutate({ priority: e.target.value as TicketPriority });
              e.target.value = '';
            }}
            className="rounded-md border border-white/10 bg-bg-elev px-2 py-1"
          >
            <option value="">{t.ticketBulkPriority}</option>
            {TICKET_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {ticketPriorityLabel(t, priority)}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="subtle"
            disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ assignedToId: user?.id ?? null })}
          >
            {bulkMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t.ticketBulkAssign}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            {t.ticketBulkClear}
          </Button>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-4">
          {!activeServerId ? (
            <EmptyState
              icon={LifeBuoy}
              title={t.ticketsNoCompetition}
              description={t.ticketsNoCompetitionHint}
            />
          ) : null}

          {activeServerId && isLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
            : null}

          {activeServerId && !isLoading && tickets.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title={
                hasActiveFilters ? t.ticketsNoMatch : canViewAll ? t.ticketsEmpty : t.ticketsNoneMine
              }
              description={hasActiveFilters ? t.ticketsNoMatchHint : t.ticketsOpenHint}
              action={<TicketComposer />}
            />
          ) : null}

          {tickets.map((ticket) => (
            <div key={ticket.id} className="flex items-center gap-2">
              {canBulk ? (
                <input
                  type="checkbox"
                  aria-label={`select ${ticket.code}`}
                  checked={selected.includes(ticket.id)}
                  onChange={() => toggleSelected(ticket.id)}
                  className="h-4 w-4 shrink-0 accent-current"
                />
              ) : null}
              <Link href={`/tickets/${ticket.id}`} className="block min-w-0 flex-1">
                <GlassPanel
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-all hover:border-accent-cyan/30 hover:shadow-glow-cyan/30"
                  tone={
                    ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH'
                      ? 'rose'
                      : ticket.priority === 'MEDIUM'
                        ? 'amber'
                        : 'emerald'
                  }
                >
                  <div className="flex flex-col items-center gap-1">
                    <Avatar
                      name={ticket.openedBy.displayName}
                      src={ticket.openedBy.avatarUrl}
                      size="md"
                    />
                    <span className="font-mono text-[10px] text-muted-fg">{ticket.code}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-fg">{ticket.title}</span>
                      <SeverityPill severity={ticket.priority} />
                      <StatusPill status={ticket.status} />
                      {ticket.unreadCount > 0 ? (
                        <span className="rounded-full bg-accent-cyan/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-cyan">
                          {ticket.unreadCount}
                        </span>
                      ) : null}
                      {ticket.attachmentCount > 0 ? (
                        <span className="rounded border border-white/10 px-1 text-[10px] text-muted-fg">
                          {ticket.attachmentCount} 📎
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-fg-subtle">{ticket.body}</p>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-fg">
                      <span>{ticket.openedBy.displayName}</span>
                      {ticket.team ? (
                        <span style={{ color: ticket.team.color }}>· {ticket.team.name}</span>
                      ) : null}
                      {ticket.category ? (
                        <span>· {ticketCategoryLabel(t, ticket.category)}</span>
                      ) : null}
                      {ticket.challenge ? <span>· {ticket.challenge.title}</span> : null}
                      <span>· {relative(ticket.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-fg-subtle">
                    {ticket.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          name={ticket.assignedTo.displayName}
                          src={ticket.assignedTo.avatarUrl}
                          size="xs"
                        />
                        <span>{ticket.assignedTo.displayName}</span>
                      </div>
                    ) : (
                      <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-fg">
                        {t.ticketNoAssignee}
                      </span>
                    )}
                  </div>
                </GlassPanel>
              </Link>
            </div>
          ))}

          {hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                {isFetchingNextPage ? t.ticketsLoading : t.ticketsLoadMore}
              </Button>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded border px-1.5 py-0.5 text-[11px] capitalize transition-colors',
        active
          ? 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan'
          : 'border-white/10 text-muted-fg hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
