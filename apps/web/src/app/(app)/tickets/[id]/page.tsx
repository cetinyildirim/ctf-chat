'use client';

import * as React from 'react';
import Link from 'next/link';
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
  ArrowLeft,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { Permission, TICKET_PRIORITIES, type TicketEvent } from '@sydt/shared';
import { ticketsApi } from '@/lib/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/components/providers/LocaleProvider';
import type { Dict } from '@/i18n/dict';
import { TicketAttachmentList } from '@/components/tickets/TicketAttachmentList';
import { TicketAttachmentPicker } from '@/components/tickets/TicketAttachmentPicker';
import { TicketRelationsPanel } from '@/components/tickets/TicketRelationsPanel';
import { TicketAnnounceDialog } from '@/components/tickets/TicketAnnounceDialog';
import { ticketEventLabel, ticketPriorityLabel, ticketStatusLabel, ticketCategoryLabel } from '@/i18n/ticket-labels';
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
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RoleBadge } from '@/components/common/RoleBadge';
import { MessageMarkdown } from '@/components/chat/MessageMarkdown';
import { relative, smartDate } from '@/lib/format/time';
import { cn } from '@/lib/utils';

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.ticket(id),
    queryFn: () => ticketsApi.get(id),
  });

  const [tab, setTab] = React.useState<'thread' | 'internal'>('thread');
  const [draft, setDraft] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);

  // The server decides what this viewer may do; the UI only mirrors it.
  const viewer = data?.viewer;
  const canInternal = !!viewer?.canSeeInternal;
  const canManage = !!viewer?.canManageFields;
  const canClaim = !!viewer?.canClaim && !!viewer?.canViewAll;
  const canAssign = !!viewer?.canAssign;
  const canAnnounce =
    !!viewer?.canViewAll && !!user?.permissions.includes(Permission.TICKET_ANNOUNCE);

  // Categories and tags for the organizer field controls.
  const { data: meta } = useQuery({
    queryKey: queryKeys.ticketMeta(data?.ticket.serverId ?? ''),
    queryFn: () => ticketsApi.meta(data!.ticket.serverId),
    enabled: canManage && !!data?.ticket.serverId,
  });

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.ticketsAll });
  }, [queryClient, id]);

  // Clears the unread badge once the thread has been opened.
  React.useEffect(() => {
    if (!data) return;
    void ticketsApi
      .markRead(id)
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.ticketsAll }))
      .catch(() => undefined);
  }, [data, id, queryClient]);

  const claimMutation = useMutation({
    mutationFn: () => ticketsApi.claim(id),
    onSuccess: () => {
      toast.success(t.ticketToastAssigned);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => ticketsApi.setStatus(id, status),
    onSuccess: (_t, status) => {
      toast.success(`${t.ticketToastStatusChanged} · ${ticketStatusLabel(t, status)}`);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const reopenMutation = useMutation({
    mutationFn: (body: string) => ticketsApi.reopen(id, body),
    onSuccess: () => {
      setDraft('');
      toast.success(t.ticketToastReopened);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const commentMutation = useMutation({
    mutationFn: ({ body, internal }: { body: string; internal: boolean }) =>
      ticketsApi.comment(id, body, internal, files),
    onSuccess: () => {
      setDraft('');
      setFiles([]);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const patchMutation = useMutation({
    mutationFn: (patch: Parameters<typeof ticketsApi.patch>[1]) => ticketsApi.patch(id, patch),
    onSuccess: invalidate,
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  if (isLoading) return <LoadingScreen label={t.ticketLoadingDetail} />;

  // A ticket can be gone or out of reach (deleted, or access revoked); the API
  // answers 404 for both so no existence is leaked.
  if (!data) {
    return (
      <div className="flex h-full min-w-0 flex-col">
        <TopBar
          title={
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-accent-rose" />
              <span>{t.ticketNotFound}</span>
            </div>
          }
        />
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <EmptyState
            icon={LifeBuoy}
            title={t.ticketNotFound}
            description={t.ticketNotFoundHint}
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/tickets">
                  <ArrowLeft className="h-3.5 w-3.5" /> {t.ticketBackToList}
                </Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const { ticket, events } = data;

  const isClosed = ticket.status === 'CLOSED' || ticket.status === 'RESOLVED';
  const canReopen = isClosed;

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
          <div className="flex min-w-0 items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1.5 px-2 text-fg-subtle hover:text-fg">
              <Link href="/tickets" aria-label={t.ticketBackToList}>
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{t.ticketBackToList}</span>
              </Link>
            </Button>
            <span className="hidden h-4 w-px shrink-0 bg-white/15 sm:block" aria-hidden />
            <LifeBuoy className="h-4 w-4 shrink-0 text-accent-rose" />
            <span className="shrink-0 font-mono">{ticket.code}</span>
            <span className="text-fg-subtle">·</span>
            <span className="truncate">{ticket.title}</span>
            <StatusPill status={ticket.status} />
            <SeverityPill severity={ticket.priority} />
          </div>
        }
        subtitle={`${t.ticketFieldCreated}: ${relative(ticket.createdAt)} · ${t.ticketFieldUpdated}: ${relative(ticket.updatedAt)}`}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:overflow-hidden">
        <div className="flex min-h-0 flex-col gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'thread' | 'internal')}>
            <TabsList>
              <TabsTrigger value="thread">{t.ticketConversation}</TabsTrigger>
              {canInternal ? (
                <TabsTrigger value="internal">
                  <ShieldAlert className="h-3 w-3" /> {t.ticketInternalTab}
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="thread" className="m-0">
              <GlassPanel className="min-h-[60vh] p-0">
                <ScrollArea className="h-[60vh] p-4">
                  <EventList events={threadEvents} initialBody={ticket.body} t={t} />
                </ScrollArea>
              </GlassPanel>
            </TabsContent>

            {canInternal ? (
              <TabsContent value="internal" className="m-0">
                <GlassPanel tone="violet" className="min-h-[60vh] p-0">
                  <ScrollArea className="h-[60vh] p-4">
                    {internalEvents.length === 0 ? (
                      <div className="rounded-md border border-dashed border-white/10 p-4 text-center text-xs text-muted-fg">
                        {t.ticketNoInternalNotes}
                      </div>
                    ) : (
                      <EventList events={internalEvents} t={t} />
                    )}
                  </ScrollArea>
                </GlassPanel>
              </TabsContent>
            ) : null}
          </Tabs>

          <div className="space-y-2 rounded-xl border border-white/10 bg-bg-elev/60 p-2">
            <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(6, Math.max(2, draft.split('\n').length))}
              placeholder={
                tab === 'internal'
                  ? t.ticketPlaceholderInternal
                  : canReopen
                    ? t.ticketPlaceholderReopen
                    : t.ticketPlaceholderReply
              }
              className="border-0 bg-transparent focus-visible:ring-0"
            />
            {canReopen && tab === 'thread' && !viewer?.canViewAll ? (
              <Button
                variant="primary"
                onClick={() => draft.trim() && reopenMutation.mutate(draft.trim())}
                disabled={draft.trim().length < 10 || reopenMutation.isPending}
                className="self-end"
              >
                {reopenMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {t.ticketReopenAction}
              </Button>
            ) : (
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
                {tab === 'internal' ? t.ticketInternalNote : t.ticketReply}
              </Button>
            )}
            </div>
            <TicketAttachmentPicker
              files={files}
              onChange={setFiles}
              disabled={commentMutation.isPending}
            />
          </div>
        </div>

        <aside className="space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pb-2 lg:pr-1">
          <GlassPanel className="p-3 space-y-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
              {t.ticketFieldReporter}
            </div>
            <div className="flex items-center gap-2">
              <Avatar name={ticket.openedBy.displayName} src={ticket.openedBy.avatarUrl} size="md" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{ticket.openedBy.displayName}</div>
                <div className="flex items-center gap-1 truncate text-[11px] text-fg-subtle">
                  <RoleBadge role={ticket.openedBy.role} iconOnly />
                  {ticket.team ? (
                    <span style={{ color: ticket.team.color }}>{ticket.team.name}</span>
                  ) : (
                    <span>{t.ticketNoTeam}</span>
                  )}
                </div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="p-3 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
              {t.ticketFieldAssignee}
            </div>
            {ticket.assignedTo ? (
              <div className="flex items-center gap-2">
                <Avatar
                  name={ticket.assignedTo.displayName}
                  src={ticket.assignedTo.avatarUrl}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {ticket.assignedTo.displayName}
                  </div>
                  <div className="text-[11px] text-fg-subtle">
                    {t.ticketAssignedAt} {relative(ticket.updatedAt)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-fg">{t.ticketUnassignedNote}</div>
            )}

            {canClaim && !ticket.assignedTo ? (
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() => claimMutation.mutate()}
                disabled={claimMutation.isPending}
              >
                <UserCheck className="h-3.5 w-3.5" /> {t.ticketClaimAction}
              </Button>
            ) : null}
            {canAssign && ticket.assignedTo && ticket.assignedTo.id !== user?.id ? (
              <Button
                size="sm"
                variant="subtle"
                className="w-full"
                onClick={() => patchMutation.mutate({ assignedToId: user?.id ?? null })}
                disabled={patchMutation.isPending}
              >
                <UserCheck className="h-3.5 w-3.5" /> {t.ticketAssignSelf}
              </Button>
            ) : null}
          </GlassPanel>

          {canManage ? (
            <GlassPanel className="p-3 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
                {t.ticketStatusControls}
              </div>
              <div className="flex flex-col gap-1.5">
                <Button
                  size="sm"
                  variant="subtle"
                  className={cn(
                    ticket.status === 'IN_PROGRESS' && 'border-accent-amber/40 text-accent-amber',
                  )}
                  onClick={() => statusMutation.mutate('IN_PROGRESS')}
                >
                  <AlertTriangle className="h-3.5 w-3.5" /> {t.ticketMarkInProgress}
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  className={cn(
                    ticket.status === 'WAITING_FOR_COMPETITOR' &&
                      'border-accent-violet/40 text-accent-violet',
                  )}
                  onClick={() => statusMutation.mutate('WAITING_FOR_COMPETITOR')}
                >
                  <Clock className="h-3.5 w-3.5" /> {t.ticketWaitForCompetitor}
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  className={cn(
                    ticket.status === 'RESOLVED' && 'border-accent-emerald/40 text-accent-emerald',
                  )}
                  onClick={() => statusMutation.mutate('RESOLVED')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t.ticketResolveAction}
                </Button>
                <Button size="sm" variant="subtle" onClick={() => statusMutation.mutate('CLOSED')}>
                  <CircleSlash className="h-3.5 w-3.5" /> {t.ticketCloseAction}
                </Button>
              </div>

              <div className="space-y-1.5 border-t border-white/8 pt-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-fg">
                  {t.ticketFieldPriority}
                </label>
                <select
                  value={ticket.priority}
                  onChange={(e) => patchMutation.mutate({ priority: e.target.value as never })}
                  className="w-full rounded-md border border-white/10 bg-bg-elev px-2 py-1 text-xs"
                >
                  {TICKET_PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {ticketPriorityLabel(t, value)}
                    </option>
                  ))}
                </select>

                <label className="text-[10px] uppercase tracking-wider text-muted-fg">
                  {t.ticketFieldCategory}
                </label>
                <select
                  value={ticket.category?.id ?? ''}
                  onChange={(e) =>
                    patchMutation.mutate({ categoryId: e.target.value || null })
                  }
                  className="w-full rounded-md border border-white/10 bg-bg-elev px-2 py-1 text-xs"
                >
                  <option value="">{t.ticketNoCategory}</option>
                  {(meta?.categories ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {ticketCategoryLabel(t, category)}
                    </option>
                  ))}
                </select>

                {(meta?.tags ?? []).length > 0 ? (
                  <>
                    <label className="text-[10px] uppercase tracking-wider text-muted-fg">
                      {t.ticketFieldTags}
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {(meta?.tags ?? []).map((tag) => {
                        const active = ticket.tags.some((tt) => tt.id === tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() =>
                              patchMutation.mutate({
                                tagIds: active
                                  ? ticket.tags.filter((tt) => tt.id !== tag.id).map((tt) => tt.id)
                                  : [...ticket.tags.map((tt) => tt.id), tag.id],
                              })
                            }
                            className={cn(
                              'rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase transition-colors',
                              active ? 'bg-white/10' : 'opacity-60 hover:opacity-100',
                            )}
                            style={{ borderColor: `${tag.color}66`, color: tag.color }}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            </GlassPanel>
          ) : null}

          {canAnnounce ? (
            <TicketAnnounceDialog ticketId={ticket.id} defaultTitle={ticket.title} />
          ) : null}

          <TicketRelationsPanel
            ticketId={ticket.id}
            relations={data.relations}
            canManage={canManage}
          />

          <GlassPanel className="p-3 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
              {t.ticketMetaTitle}
            </div>
            <Row k={t.ticketFieldPriority} v={<SeverityPill severity={ticket.priority} />} />
            <Row k={t.ticketFieldStatus} v={<StatusPill status={ticket.status} />} />
            <Row
              k={t.ticketFieldCategory}
              v={ticket.category ? ticketCategoryLabel(t, ticket.category) : '—'}
            />
            <Row k={t.ticketFieldChallenge} v={ticket.challenge?.title ?? '—'} />
            <Row k={t.ticketFieldCreated} v={smartDate(ticket.createdAt)} />
            <Row k={t.ticketFieldUpdated} v={smartDate(ticket.updatedAt)} />
            {ticket.reopenCount > 0 ? (
              <Row k={t.ticketFieldReopened} v={`${ticket.reopenCount}×`} />
            ) : null}
          </GlassPanel>

          {ticket.tags.length > 0 ? (
            <GlassPanel className="p-3 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
                {t.ticketFieldTags}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ticket.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                    style={{ borderColor: `${tag.color}66`, color: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </GlassPanel>
          ) : null}
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

function EventList({
  events,
  initialBody,
  t,
}: {
  events: TicketEvent[];
  initialBody?: string;
  t: Dict;
}) {
  return (
    <div className="space-y-3">
      {initialBody ? (
        <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-fg">
            {t.ticketOriginalReport}
          </div>
          <MessageMarkdown content={initialBody} />
        </div>
      ) : null}
      {events.length === 0 && !initialBody ? <Skeleton className="h-24 w-full" /> : null}
      {events.map((e) => (
        <div key={e.id} className="flex gap-3">
          <Avatar
            name={e.author?.displayName ?? t.ticketSystemAuthor}
            src={e.author?.avatarUrl}
            size="md"
            className="mt-0.5"
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
              <span className="font-semibold text-fg">
                {e.author?.displayName ?? t.ticketSystemAuthor}
              </span>
              {e.author ? <RoleBadge role={e.author.role} iconOnly /> : null}
              <span>·</span>
              <span>{smartDate(e.createdAt)}</span>
              <span className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[9px] uppercase">
                {ticketEventLabel(t, e.type)}
              </span>
            </div>
            {e.body ? <MessageMarkdown content={e.body} /> : null}
            <TicketAttachmentList attachments={e.attachments} />
          </div>
        </div>
      ))}
    </div>
  );
}
