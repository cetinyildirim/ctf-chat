'use client';

import * as React from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/providers/LocaleProvider';
import { serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { useServerStore } from '@/store/server';

function slugFromName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return base || `server-${Date.now().toString(36).slice(2, 8)}`;
}

export function CreateServerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const policyHref =
    locale === 'en' ? '/legal/acceptable-use' : '/legal/kabul-edilebilir-kullanim';
  const qc = useQueryClient();
  const setActiveServerId = useServerStore((s) => s.setActiveServerId);
  const [name, setName] = React.useState('');

  React.useEffect(() => {
    if (!open) setName('');
  }, [open]);

  const createMut = useMutation({
    mutationFn: () => {
      const trimmed = name.trim();
      const slug = `${slugFromName(trimmed)}-${Date.now().toString(36).slice(2, 6)}`;
      return serversApi.create({ name: trimmed, slug });
    },
    onSuccess: (server) => {
      void qc.invalidateQueries({ queryKey: queryKeys.servers });
      setActiveServerId(server.id);
      toast.success(t.serverCreated);
      onOpenChange(false);
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    createMut.mutate();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] w-[min(96vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-[#1e1f22] p-6 shadow-2xl outline-none">
          <Dialog.Title className="text-xl font-bold text-fg">{t.serverCreateTitle}</Dialog.Title>
          <p className="mt-2 text-sm leading-relaxed text-fg-subtle">
            {t.serverCreateLead}{' '}
            <Link
              href={policyHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-cyan underline decoration-accent-cyan/40 underline-offset-2 hover:text-accent-cyan/90"
              onClick={(e) => e.stopPropagation()}
            >
              {t.serverCreatePolicy}
            </Link>
            {t.serverCreateLeadSuffix}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
                {t.serverCreateNameLabel}
              </Label>
              <Input
                className="mt-1.5 bg-[#111214]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoFocus
                placeholder={t.serverCreateNamePlaceholder}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" disabled={createMut.isPending}>
                  {t.teamCancelEdit}
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={createMut.isPending || name.trim().length < 2}>
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t.serverCreateSubmit}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
