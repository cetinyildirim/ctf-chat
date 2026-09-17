'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { schemas } from '@sydt/shared';
import type { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ticketsApi } from '@/lib/api/endpoints';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/client';
import { toast } from 'sonner';
import { unwrapApiError } from '@/lib/api/axios';
import { Plus, Loader2 } from 'lucide-react';
import { useServerStore } from '@/store/server';
import { useI18n } from '@/components/providers/LocaleProvider';
import { ticketPriorityLabel, ticketCategoryLabel } from '@/i18n/ticket-labels';
import { TicketAttachmentPicker } from '@/components/tickets/TicketAttachmentPicker';

type FormValues = z.infer<typeof schemas.createTicketSchema>;

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-white/10 bg-bg-deep px-3 text-sm text-fg outline-none focus:border-accent-cyan/50';

interface Props {
  challengeId?: string | null;
  trigger?: React.ReactNode;
}

export function TicketComposer({ challengeId, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const activeServerId = useServerStore((s) => s.activeServerId);

  const { data: meta } = useQuery({
    queryKey: queryKeys.ticketMeta(activeServerId ?? undefined),
    queryFn: () => ticketsApi.meta(activeServerId!),
    enabled: open && !!activeServerId,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schemas.createTicketSchema),
    defaultValues: {
      title: '',
      body: '',
      priority: 'MEDIUM',
      categoryId: null,
      challengeId: challengeId ?? null,
    },
  });

  const priority = watch('priority');
  const categoryId = watch('categoryId');
  const selectedCategory = meta?.categories.find((c) => c.id === categoryId);
  const needsChallenge = !!selectedCategory?.requiresChallenge;

  const onSubmit = async (values: FormValues) => {
    if (!activeServerId) {
      toast.error(t.ticketSelectCompetitionFirst);
      return;
    }
    try {
      await ticketsApi.create(activeServerId, values, files);
      toast.success(t.ticketToastCreated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticketsAll });
      reset();
      setFiles([]);
      setOpen(false);
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    }
  };

  const blocked = meta && !meta.canCreate;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="primary" size="sm">
            <Plus className="h-4 w-4" />
            {t.ticketsNew}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t.ticketComposerTitle}</DialogTitle>
            <DialogDescription>{t.ticketComposerLead}</DialogDescription>
          </DialogHeader>

          {blocked ? (
            <p className="rounded-md border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber">
              {t.ticketComposerBlocked}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="title">{t.ticketFieldTitle}</Label>
            <Input id="title" placeholder={t.ticketTitlePlaceholder} {...register('title')} />
            {errors.title ? <p className="text-xs text-accent-rose">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categoryId">{t.ticketFieldCategory}</Label>
            <select
              id="categoryId"
              className={SELECT_CLASS}
              value={categoryId ?? ''}
              onChange={(e) =>
                setValue('categoryId', e.target.value || null, { shouldDirty: true })
              }
            >
              <option value="">{t.ticketUncategorized}</option>
              {(meta?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {ticketCategoryLabel(t, c)}
                </option>
              ))}
            </select>
          </div>

          {needsChallenge ? (
            <div className="space-y-1.5">
              <Label htmlFor="challengeId">{t.ticketFieldChallenge}</Label>
              <select
                id="challengeId"
                className={SELECT_CLASS}
                value={watch('challengeId') ?? ''}
                onChange={(e) =>
                  setValue('challengeId', e.target.value || null, { shouldDirty: true })
                }
              >
                <option value="">{t.ticketSelectChallenge}</option>
                {(meta?.challenges ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category} · {c.title}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-fg">{t.ticketCategoryNeedsChallenge}</p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="body">{t.ticketDescription}</Label>
            <Textarea
              id="body"
              rows={6}
              placeholder={t.ticketDescriptionPlaceholder}
              {...register('body')}
            />
            {errors.body ? <p className="text-xs text-accent-rose">{errors.body.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>{t.ticketFieldPriority}</Label>
            <div className="flex gap-1.5">
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setValue('priority', level, { shouldDirty: true })}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                    priority === level
                      ? level === 'CRITICAL'
                        ? 'border-accent-rose/50 bg-accent-rose/15 text-accent-rose'
                        : level === 'HIGH'
                          ? 'border-accent-rose/40 bg-accent-rose/10 text-accent-rose'
                          : level === 'MEDIUM'
                            ? 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber'
                            : 'border-accent-emerald/40 bg-accent-emerald/10 text-accent-emerald'
                      : 'border-white/8 bg-white/5 text-fg-subtle hover:bg-white/8'
                  }`}
                >
                  {ticketPriorityLabel(t, level)}
                </button>
              ))}
            </div>
          </div>

          <TicketAttachmentPicker files={files} onChange={setFiles} disabled={isSubmitting} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t.ticketCancel}
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting || blocked}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {t.ticketOpenAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
