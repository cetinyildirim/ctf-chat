'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ticketsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';
import { ticketPriorityLabel } from '@/i18n/ticket-labels';

const SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/**
 * Turns a ticket into a competition-wide announcement (spec §26). The organizer
 * writes the text: the ticket body may contain another team's findings, so it is
 * never pre-filled.
 */
export function TicketAnnounceDialog({
  ticketId,
  defaultTitle,
}: {
  ticketId: string;
  defaultTitle: string;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(defaultTitle);
  const [body, setBody] = React.useState('');
  const [severity, setSeverity] = React.useState<(typeof SEVERITIES)[number]>('HIGH');
  const [replyOnTicket, setReplyOnTicket] = React.useState(true);

  const mutation = useMutation({
    mutationFn: () =>
      ticketsApi.announce(ticketId, { title: title.trim(), body: body.trim(), severity, replyOnTicket }),
    onSuccess: () => {
      toast.success(t.ticketToastAnnounced);
      setOpen(false);
      setBody('');
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.announcements });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationsFeed });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="subtle" className="w-full">
          <Megaphone className="h-3.5 w-3.5" /> {t.ticketAnnounceAction}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.ticketAnnounceTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-fg-subtle">{t.ticketAnnounceLead}</p>
        <div className="space-y-2.5">
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider text-muted-fg">
              {t.ticketAnnounceSubject}
            </label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wider text-muted-fg">
              {t.ticketAnnounceBody}
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={4000}
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as (typeof SEVERITIES)[number])}
              className="rounded-md border border-white/10 bg-bg-elev px-2 py-1 text-xs"
            >
              {SEVERITIES.map((value) => (
                <option key={value} value={value}>
                  {ticketPriorityLabel(t, value)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
              <input
                type="checkbox"
                checked={replyOnTicket}
                onChange={(e) => setReplyOnTicket(e.target.checked)}
              />
              {t.ticketAnnounceReply}
            </label>
          </div>
          <Button
            variant="primary"
            className="w-full"
            disabled={title.trim().length < 4 || body.trim().length < 10 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t.ticketAnnouncePublish}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
