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
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/client';
import { toast } from 'sonner';
import { unwrapApiError } from '@/lib/api/axios';
import { Plus, Loader2 } from 'lucide-react';

type FormValues = z.infer<typeof schemas.createTicketSchema>;

interface Props {
  challengeId?: string | null;
  trigger?: React.ReactNode;
}

export function TicketComposer({ challengeId, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();
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
      severity: 'MEDIUM',
      challengeId: challengeId ?? null,
    },
  });

  const severity = watch('severity');

  const onSubmit = async (values: FormValues) => {
    try {
      await ticketsApi.create(values);
      toast.success('Ticket opened.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.tickets });
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="primary" size="sm">
            <Plus className="h-4 w-4" />
            New ticket
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Open support ticket</DialogTitle>
            <DialogDescription>
              Staff will be notified instantly. Include URLs, hashes, and exact reproduction steps where possible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Short summary of the problem" {...register('title')} />
            {errors.title ? <p className="text-xs text-accent-rose">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Description</Label>
            <Textarea
              id="body"
              rows={6}
              placeholder="What did you do, what did you expect, what happened instead?"
              {...register('body')}
            />
            {errors.body ? <p className="text-xs text-accent-rose">{errors.body.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label>Severity</Label>
            <div className="flex gap-1.5">
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setValue('severity', sev, { shouldDirty: true })}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                    severity === sev
                      ? sev === 'CRITICAL'
                        ? 'border-accent-rose/50 bg-accent-rose/15 text-accent-rose'
                        : sev === 'HIGH'
                        ? 'border-accent-rose/40 bg-accent-rose/10 text-accent-rose'
                        : sev === 'MEDIUM'
                        ? 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber'
                        : 'border-accent-emerald/40 bg-accent-emerald/10 text-accent-emerald'
                      : 'border-white/8 bg-white/5 text-fg-subtle hover:bg-white/8'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Open ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
