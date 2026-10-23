'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { TicketRelationKind, type TicketRelationDto } from '@sydt/shared';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusPill } from '@/components/tickets/StatusPill';
import { ticketsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';

/**
 * Groups duplicate/parent/child tickets around one incident (spec §22).
 * Only organizers with field-management rights get the editing controls; the
 * server rejects the rest regardless of what the UI shows.
 */
export function TicketRelationsPanel({
  ticketId,
  relations,
  canManage,
}: {
  ticketId: string;
  relations: TicketRelationDto[];
  canManage: boolean;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [target, setTarget] = React.useState('');
  const [kind, setKind] = React.useState<TicketRelationKind>(TicketRelationKind.RELATED);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) });

  const addMutation = useMutation({
    mutationFn: (relatedTicketId: string) =>
      ticketsApi.addRelation(ticketId, { relatedTicketId, kind }),
    onSuccess: () => {
      setTarget('');
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const removeMutation = useMutation({
    mutationFn: (relationId: string) => ticketsApi.removeRelation(ticketId, relationId),
    onSuccess: invalidate,
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const kindLabel: Record<TicketRelationKind, string> = {
    RELATED: t.ticketRelationRelated,
    DUPLICATE: t.ticketRelationDuplicate,
    PARENT: t.ticketRelationParent,
    CHILD: t.ticketRelationChild,
  };

  if (!canManage && relations.length === 0) return null;

  return (
    <GlassPanel className="space-y-2 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
        <Link2 className="h-3 w-3" /> {t.ticketRelations}
      </div>

      <ul className="space-y-1">
        {relations.map((relation) => (
          <li key={relation.id} className="flex items-center gap-1.5 text-xs">
            <span className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[9px] uppercase text-muted-fg">
              {kindLabel[relation.kind]}
            </span>
            <Link
              href={`/tickets/${relation.ticket.id}`}
              className="min-w-0 flex-1 truncate hover:text-accent-cyan"
            >
              <span className="font-mono text-[11px]">{relation.ticket.code}</span>{' '}
              {relation.ticket.title}
            </Link>
            <StatusPill status={relation.ticket.status} />
            {canManage ? (
              <button
                type="button"
                aria-label={t.ticketRelationRemove}
                className="text-muted-fg hover:text-accent-rose"
                onClick={() => removeMutation.mutate(relation.id)}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <div className="space-y-1.5 border-t border-white/8 pt-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as TicketRelationKind)}
            className="w-full rounded-md border border-white/10 bg-bg-elev px-2 py-1 text-xs"
          >
            {Object.values(TicketRelationKind).map((value) => (
              <option key={value} value={value}>
                {kindLabel[value]}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={t.ticketRelationCode}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!target.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate(target.trim())}
            >
              {addMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                t.ticketRelationAdd
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </GlassPanel>
  );
}
