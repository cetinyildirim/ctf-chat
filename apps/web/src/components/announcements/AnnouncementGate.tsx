'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { Megaphone } from 'lucide-react';
import { announcementsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';
import { useNotificationStore } from '@/store/notifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SEVERITY_STYLE: Record<string, string> = {
  INFO: 'bg-accent-cyan/15 text-accent-cyan',
  LOW: 'bg-accent-cyan/15 text-accent-cyan',
  MEDIUM: 'bg-accent-amber/15 text-accent-amber',
  HIGH: 'bg-accent-rose/15 text-accent-rose',
  CRITICAL: 'bg-accent-rose/15 text-accent-rose',
};

export function AnnouncementGate() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const markReadByRef = useNotificationStore((s) => s.markReadByRef);
  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.announcementsPendingAck,
    queryFn: announcementsApi.pendingAck,
    refetchInterval: 60_000,
  });

  const current = pending[0] ?? null;

  const ackMut = useMutation({
    mutationFn: (id: string) => announcementsApi.ack(id),
    onSuccess: async (_data, id) => {
      markReadByRef(id);
      await qc.invalidateQueries({ queryKey: queryKeys.announcementsPendingAck });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  if (!current) return null;

  const published = current.publishedAt ?? current.createdAt;

  return (
    <Dialog.Root open onOpenChange={() => undefined}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[82] cursor-not-allowed bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[83] flex max-h-[min(90vh,42rem)] w-[min(96vw,32rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border/80 bg-bg-elev shadow-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
            <div
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                SEVERITY_STYLE[current.severity] ?? SEVERITY_STYLE.INFO,
              )}
            >
              <Megaphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-fg">{current.title}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-fg-subtle">
                {current.author?.displayName ?? ''}
                {published ? ` · ${new Date(published).toLocaleString(locale)}` : ''}
              </Dialog.Description>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg">{current.body}</p>
            <p className="mt-4 text-xs text-fg-subtle">{t.announcementAckHint}</p>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/60 px-5 py-4">
            <span className="text-xs text-fg-subtle">
              {pending.length > 1 ? `1 / ${pending.length}` : ''}
            </span>
            <Button
              type="button"
              autoFocus
              disabled={ackMut.isPending}
              onClick={() => ackMut.mutate(current.id)}
            >
              {ackMut.isPending ? '…' : t.announcementAckButton}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
