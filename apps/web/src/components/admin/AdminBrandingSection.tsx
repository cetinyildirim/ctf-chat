'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Palette } from 'lucide-react';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminApi } from '@/lib/api/endpoints';
import { unwrapApiError } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';
import { toast } from 'sonner';

export function AdminBrandingSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'branding'] as const,
    queryFn: adminApi.getBranding,
  });

  const [form, setForm] = React.useState({
    platformTitle: '',
    platformTagline: '',
    workspaceLabel: '',
    workspaceTitle: '',
  });

  React.useEffect(() => {
    if (!data) return;
    setForm({
      platformTitle: data.platformTitle,
      platformTagline: data.platformTagline,
      workspaceLabel: data.workspaceLabel,
      workspaceTitle: data.workspaceTitle,
    });
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => adminApi.setBranding(form),
    onSuccess: async () => {
      toast.success(t.brandingSaved);
      await qc.invalidateQueries({ queryKey: ['admin', 'branding'] });
      await qc.invalidateQueries({ queryKey: ['platform-branding'] });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  return (
    <div className="admin-page w-full space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
          <Palette className="h-5 w-5 text-accent-cyan" />
          {t.adminMenuBranding}
        </h1>
        <p className="mt-1 text-[15px] text-fg-subtle">{t.brandingLead}</p>
      </div>

      <GlassPanel className="grid gap-4 p-6 sm:grid-cols-2">
        {isLoading ? <p className="text-fg-subtle sm:col-span-2">{t.loading}</p> : null}
        <div className="space-y-2 sm:col-span-2">
          <Label>{t.brandingPlatformTitle}</Label>
          <Input
            value={form.platformTitle}
            onChange={(e) => setForm((f) => ({ ...f, platformTitle: e.target.value }))}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>{t.brandingPlatformTagline}</Label>
          <Input
            value={form.platformTagline}
            onChange={(e) => setForm((f) => ({ ...f, platformTagline: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>{t.brandingWorkspaceLabel}</Label>
          <Input
            value={form.workspaceLabel}
            onChange={(e) => setForm((f) => ({ ...f, workspaceLabel: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>{t.brandingWorkspaceTitle}</Label>
          <Input
            value={form.workspaceTitle}
            onChange={(e) => setForm((f) => ({ ...f, workspaceTitle: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            {t.brandingSave}
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
