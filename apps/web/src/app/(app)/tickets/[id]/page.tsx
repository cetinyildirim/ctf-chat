'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LifeBuoy,
  Send,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  CircleSlash,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import type { TicketEvent } from '@sydt/shared';
import { Permission } from '@sydt/shared';
import { ticketsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { StatusPill } from '@/components/tickets/StatusPill';
import { SeverityPill } from '@/components/common/SeverityPill';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/common/Skeleton';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Can, useCan } from '@/lib/rbac/Can';
import { RoleBadge } from '@/components/common/RoleBadge';
import { MessageMarkdown } from '@/components/chat/MessageMarkdown';
import { relative, smartDate } from '@/lib/format/time';
import { cn } from '@/lib/utils';

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();

  const canClaim = useCan(Permission.TICKET_CLAIM);
  const canResolve = useCan(Permission.TICKET_RESOLVE);
  const canInternal = useCan(Permission.TICKET_INTERNAL_NOTE);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.ticket(id),
    queryFn: () => ticketsApi.get(id),
  });

  const [tab, setTab] = React.useState<'thread' | 'internal'>('thread');
  const [draft, setDraft] = React.useState('');

  const claimMutation = useMutation({
    mutationFn: () => ticketsApi.claim(id),
    onSuccess: () => toast.success('Ticket claimed.'),
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => ticketsApi.setStatus(id, status),
    onSuccess: (_t, status) => toast.success(`Ticket marked ${status.toLowerCase()}.`),
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const commentMutation = useMutation({
    mutationFn: ({ body, internal }: { body: string; internal: boolean }) =>
      ticketsApi.comment(id, body, internal),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(id) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  if (isLoading || !data) return <LoadingScreen label="Loading ticket..." />;
  const { ticket, events } = data;

  const post = () => {
    if (!draft.trim()) return;
    commentMutation.mutate({ body: draft.trim(), internal: tab === 'internal' });
  };

  const threadEvents = events.filter((e) => e.type !== 'INTERNAL_NOTE');
  const internalEvents = events.filter((e) => e.type === 'INTERNAL_NOTE');

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        title={
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-accent-rose" />
            <span className="font-mono">{ticket.code}</span>
            <span className="text-fg-subtle">·</span>
            <span className="truncate">{ticket.title}</span>
            <StatusPill status={ticket.status} />
            <SeverityPill severity={ticket.severity} />
          </div>
        }
        subtitle={`Opened ${relative(ticket.createdAt)} · last updated ${relative(ticket.updatedAt)}`}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_18rem] gap-4 p-4">
        <div className="flex min-h-0 flex-col gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'thread' | 'internal')}>
            <TabsList>
              <TabsTrigger value="thread">Conversation</TabsTrigger>
              {canInternal ? (
                <TabsTrigger value="internal">
                  <ShieldAlert className="h-3 w-3" /> Internal
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="thread" className="m-0">
              <GlassPanel className="min-h-[60vh] p-0">
                <ScrollArea className="h-[60vh] p-4">
                  <EventList events={threadEvents} initialBody={ticket.body} />
                </ScrollArea>
              </GlassPanel>
            </TabsContent>

            {canInternal ? (
              <TabsContent value="internal" className="m-0">
                <GlassPanel tone="violet" className="min-h-[60vh] p-0">
                  <ScrollArea className="h-[60vh] p-4">
                    {internalEvents.length === 0 ? (
                      <div className="rounded-md border border-dashed border-white/10 p-4 text-center text-xs text-muted-fg">
                        No internal notes yet. These are visible to staff only.
                      </div>
                    ) : (
                      <EventList events={internalEvents} />
                    )}
                  </ScrollArea>
                </GlassPanel>
              </TabsContent>
            ) : null}
          </Tabs>

          <div className="flex gap-2 rounded-xl border border-white/10 bg-bg-elev/60 p-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(6, Math.max(2, draft.split('\n').length))}
              placeholder={
                tab === 'internal'
                  ? 'Internal note (staff only)…'
                  : 'Reply to ticket… markdown supported'
              }
              className="border-0 bg-transparent focus-visible:ring-0"
            />
            <Button
              variant="primary"
              onClick={post}
              disabled={!draft.trim() || commentMutation.isPending}
              className="self-end"
            >
              {commentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {tab === 'internal' ? 'Post note' : 'Reply'}
            </Button>
          </div>
        </div>

        <aside className="space-y-3">
          <GlassPanel className="p-3 space-y-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">Reporter</div>
            <div className="flex items-center gap-2">
              <Avatar name={ticket.openedBy.displayName} src={ticket.openedBy.avatarUrl} size="md" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{ticket.openedBy.displayName}</div>
                <div className="flex items-center gap-1 truncate text-[11px] text-fg-subtle">
                  <RoleBadge role={ticket.openedBy.role} iconOnly />
                  {ticket.team ? (
                    <span style={{ color: ticket.team.color }}>{ticket.team.name}</span>
                  ) : (
                    <span>No team</span>
                  )}
                </div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="p-3 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">Assignee</div>
            {ticket.claimedBy ? (
              <div className="flex items-center gap-2">
                <Avatar name={ticket.claimedBy.displayName} src={ticket.claimedBy.avatarUrl} size="md" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{ticket.claimedBy.displayName}</div>
                  <div className="text-[11px] text-fg-subtle">Claimed {relative(ticket.updatedAt)}</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-fg">Unclaimed.</div>
            )}

            <Can permission={Permission.TICKET_CLAIM}>
              {!ticket.claimedBy ? (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => claimMutation.mutate()}
                  disabled={claimMutation.isPending}
                >
                  <UserCheck className="h-3.5 w-3.5" /> Claim
                </Button>
              ) : null}
            </Can>
          </GlassPanel>

          <Can permission={Permission.TICKET_RESOLVE}>
            <GlassPanel className="p-3 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
                Status controls
              </div>
              <div className="flex flex-col gap-1.5">
                <Button
                  size="sm"
                  variant="subtle"
                  className={cn(ticket.status === 'IN_PROGRESS' && 'border-accent-amber/40 text-accent-amber')}
                  onClick={() => statusMutation.mutate('IN_PROGRESS')}
                >
                  <AlertTriangle className="h-3.5 w-3.5" /> Mark in-progress
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  className={cn(ticket.status === 'RESOLVED' && 'border-accent-emerald/40 text-accent-emerald')}
                  onClick={() => statusMutation.mutate('RESOLVED')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => statusMutation.mutate('CLOSED')}
                >
                  <CircleSlash className="h-3.5 w-3.5" /> Close
                </Button>
              </div>
            </GlassPanel>
          </Can>

          <GlassPanel className="p-3 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">Meta</div>
            <Row k="Severity" v={<SeverityPill severity={ticket.severity} />} />
            <Row k="Status" v={<StatusPill status={ticket.status} />} />
            <Row k="Opened" v={smartDate(ticket.createdAt)} />
            <Row k="Updated" v={smartDate(ticket.updatedAt)} />
          </GlassPanel>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-fg">{k}</span>
      <span className="text-fg">{v}</span>
    </div>
  );
}

function EventList({ events, initialBody }: { events: TicketEvent[]; initialBody?: string }) {
  return (
    <div className="space-y-3">
      {initialBody ? (
        <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-fg">Original report</div>
          <MessageMarkdown content={initialBody} />
        </div>
      ) : null}
      {events.length === 0 && !initialBody ? <Skeleton className="h-24 w-full" /> : null}
      {events.map((e) => (
        <div key={e.id} className="flex gap-3">
          <Avatar
            name={e.author?.displayName ?? 'system'}
            src={e.author?.avatarUrl}
            size="md"
            className="mt-0.5"
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
              <span className="font-semibold text-fg">
                {e.author?.displayName ?? 'system'}
              </span>
              {e.author ? <RoleBadge role={e.author.role} iconOnly /> : null}
              <span>·</span>
              <span>{smartDate(e.createdAt)}</span>
              <span className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[9px] uppercase">
                {e.type.replace('_', ' ')}
              </span>
            </div>
            {e.body ? <MessageMarkdown content={e.body} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
