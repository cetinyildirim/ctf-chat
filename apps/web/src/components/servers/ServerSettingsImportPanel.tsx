'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/providers/LocaleProvider';
import { adminApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function ServerSettingsImportPanel({ serverId }: { serverId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const res = await adminApi.importCtfd(file, serverId);
      toast.success(t.importSuccess, { description: JSON.stringify(res.stats) });
      void qc.invalidateQueries({ queryKey: queryKeys.channelsAll });
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="text-sm text-fg-subtle">{t.importDescription}</p>
      <div className="rounded-lg border border-white/8 bg-white/[0.02] p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-cyan/15 text-accent-cyan">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-sm text-fg-subtle">{t.adminOverviewImportHint}</p>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        <Button type="button" className="mt-4" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? '…' : t.importButton}
        </Button>
      </div>
    </div>
  );
}
