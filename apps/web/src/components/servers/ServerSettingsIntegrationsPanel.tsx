'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Loader2, Megaphone, Palette, Trash2, Webhook, Trophy } from 'lucide-react';
import { Permission } from '@sydt/shared';
import { useI18n } from '@/components/providers/LocaleProvider';
import { useAuthStore } from '@/store/auth';
import { channelsApi, serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ColorPalettePicker } from '@/components/common/ColorPalettePicker';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { useServerStore } from '@/store/server';

export function ServerSettingsIntegrationsPanel({ serverId }: { serverId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const canManage = !!me?.permissions.includes(Permission.ADMIN_DASHBOARD);
  const { data: serverPerms } = useQuery({
    queryKey: queryKeys.serverMyPermissions(serverId),
    queryFn: () => serversApi.myPermissions(serverId),
    staleTime: 60_000,
  });
  const canAnnounce =
    !!me?.permissions.includes(Permission.ANNOUNCEMENT_CREATE) || !!serverPerms?.includes('manageAnnouncements');
  const activeServerId = useServerStore((s) => s.activeServerId);

  const { data: integrations, isLoading: intLoading } = useQuery({
    queryKey: queryKeys.serverIntegrations(serverId),
    queryFn: () => serversApi.getIntegrations(serverId),
  });

  const { data: webhooks = [] } = useQuery({
    queryKey: queryKeys.serverWebhooks(serverId),
    queryFn: () => serversApi.listWebhooks(serverId),
    enabled: canManage,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: queryKeys.serverAnnouncements(serverId),
    queryFn: () => serversApi.listAnnouncements(serverId),
    enabled: canAnnounce,
  });

  const { data: channelsData } = useQuery({
    queryKey: queryKeys.channels(serverId),
    queryFn: () => channelsApi.list(serverId),
    enabled: !!serverId,
  });

  const [themePrimary, setThemePrimary] = React.useState('#22d3ee');
  const [themeAccent, setThemeAccent] = React.useState('#a78bfa');
  const [emailEnabled, setEmailEnabled] = React.useState(false);
  const [emailReplyTo, setEmailReplyTo] = React.useState('');
  const [annTitle, setAnnTitle] = React.useState('');
  const [annBody, setAnnBody] = React.useState('');
  const [annSchedule, setAnnSchedule] = React.useState('');
  const [annRequireAck, setAnnRequireAck] = React.useState(false);
  const [whLabel, setWhLabel] = React.useState('');
  const [whUrl, setWhUrl] = React.useState('');
  const [ctfdBaseUrl, setCtfdBaseUrl] = React.useState('');
  const [ctfdAccessToken, setCtfdAccessToken] = React.useState('');
  const [tokenEditing, setTokenEditing] = React.useState(false);

  React.useEffect(() => {
    if (!integrations) return;
    setThemePrimary(integrations.themePrimary ?? '#22d3ee');
    setThemeAccent(integrations.themeAccent ?? '#a78bfa');
    setEmailEnabled(integrations.emailNotifyEnabled);
    setEmailReplyTo(integrations.emailReplyTo ?? '');
    setCtfdBaseUrl(integrations.ctfdBaseUrl ?? '');
    if (!tokenEditing) setCtfdAccessToken('');
  }, [integrations, tokenEditing]);

  React.useEffect(() => {
    if (!integrations?.ctfdAccessTokenConfigured) setTokenEditing(false);
  }, [integrations?.ctfdAccessTokenConfigured]);

  const tokenConfigured = integrations?.ctfdAccessTokenConfigured ?? false;
  const hasTokenForTest = ctfdAccessToken.trim().length > 0 || tokenConfigured;
  const storedCtfdUrl = integrations?.ctfdBaseUrl?.trim() ?? '';
  const ctfdUrlDirty = (ctfdBaseUrl.trim() || null) !== (storedCtfdUrl || null);
  const canSaveCtfd = ctfdUrlDirty || ctfdAccessToken.trim().length > 0 || tokenEditing;
  const clearingCtfd = storedCtfdUrl.length > 0 && !ctfdBaseUrl.trim();

  const patchBrandingMut = useMutation({
    mutationFn: () =>
      serversApi.patchIntegrations(serverId, {
        themePrimary,
        themeAccent,
        emailNotifyEnabled: emailEnabled,
        emailReplyTo: emailReplyTo.trim() || null,
      }),
    onSuccess: () => {
      toast.success(t.serverIntegrationsSaved);
      void qc.invalidateQueries({ queryKey: queryKeys.serverIntegrations(serverId) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const ctfdSaveMut = useMutation({
    mutationFn: () => {
      const nextUrl = ctfdBaseUrl.trim() || null;
      return serversApi.patchIntegrations(serverId, {
        ctfdBaseUrl: nextUrl,
        ...(nextUrl
          ? ctfdAccessToken.trim()
            ? { ctfdAccessToken: ctfdAccessToken.trim() }
            : {}
          : { ctfdAccessToken: null }),
      });
    },
    onSuccess: () => {
      toast.success(clearingCtfd ? t.serverIntegration_ctfdRemoved : t.serverIntegration_ctfdSaved);
      setTokenEditing(false);
      setCtfdAccessToken('');
      void qc.invalidateQueries({ queryKey: queryKeys.serverIntegrations(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverCtfdScoreboard(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverCtfdStats(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverScoreboard(serverId) });
      void qc.removeQueries({ queryKey: queryKeys.serverCtfdScoreboard(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverScoreboard(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverScoreboardTimeline(serverId) });
      void qc.removeQueries({ queryKey: queryKeys.serverCtfdScoreboard(serverId) });
      void qc.removeQueries({ queryKey: queryKeys.serverCtfdStats(serverId) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const ctfdDisconnectMut = useMutation({
    mutationFn: () =>
      serversApi.patchIntegrations(serverId, { ctfdBaseUrl: null, ctfdAccessToken: null }),
    onSuccess: () => {
      toast.success(t.serverIntegration_ctfdRemoved);
      setCtfdBaseUrl('');
      setCtfdAccessToken('');
      setTokenEditing(false);
      void qc.invalidateQueries({ queryKey: queryKeys.serverIntegrations(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverCtfdScoreboard(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverCtfdStats(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverScoreboard(serverId) });
      void qc.removeQueries({ queryKey: queryKeys.serverCtfdScoreboard(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverScoreboard(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverScoreboardTimeline(serverId) });
      void qc.removeQueries({ queryKey: queryKeys.serverCtfdScoreboard(serverId) });
      void qc.removeQueries({ queryKey: queryKeys.serverCtfdStats(serverId) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const ctfdClearTokenMut = useMutation({
    mutationFn: () => serversApi.patchIntegrations(serverId, { ctfdAccessToken: null }),
    onSuccess: () => {
      toast.success(t.serverIntegration_ctfdTokenRemoved);
      setTokenEditing(false);
      setCtfdAccessToken('');
      void qc.invalidateQueries({ queryKey: queryKeys.serverIntegrations(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverCtfdScoreboard(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverCtfdStats(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverScoreboard(serverId) });
      void qc.removeQueries({ queryKey: queryKeys.serverCtfdScoreboard(serverId) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const ctfdTestMut = useMutation({
    mutationFn: () => {
      const url = ctfdBaseUrl.trim() || integrations?.ctfdBaseUrl?.trim();
      if (!url) throw new Error(t.serverIntegration_ctfdTestNeedUrl);
      return serversApi.testCtfdConnection(serverId, {
        ctfdBaseUrl: ctfdBaseUrl.trim() || undefined,
        ...(ctfdAccessToken.trim() ? { ctfdAccessToken: ctfdAccessToken.trim() } : {}),
      });
    },
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(
          t.serverIntegration_ctfdTestOk.replace('{{count}}', String(result.teamCount ?? 0)),
        );
        void qc.invalidateQueries({ queryKey: queryKeys.serverCtfdScoreboard(serverId) });
        void qc.removeQueries({ queryKey: queryKeys.serverCtfdScoreboard(serverId) });
        return;
      }
      const msg =
        result.code === 'token_required'
          ? t.serverIntegration_ctfdTestNeedToken
          : result.code === 'auth_failed'
            ? t.serverIntegration_ctfdTestAuthFailed
            : result.code === 'unreachable'
              ? t.serverIntegration_ctfdTestUnreachable
              : result.code === 'invalid_url'
                ? t.serverIntegration_ctfdTestInvalidUrl
                : t.serverIntegration_ctfdTestError;
      toast.error(result.detail ? `${msg} (${result.detail})` : msg);
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const ctfdBusy =
    ctfdSaveMut.isPending || ctfdClearTokenMut.isPending || ctfdTestMut.isPending || ctfdDisconnectMut.isPending;

  React.useEffect(() => {
    if (!canManage || !integrations) return;
    const root = document.documentElement;
    if (activeServerId === serverId && integrations.themePrimary) {
      root.style.setProperty('--server-primary', integrations.themePrimary);
    }
    if (activeServerId === serverId && integrations.themeAccent) {
      root.style.setProperty('--server-accent', integrations.themeAccent);
    }
  }, [integrations, activeServerId, serverId, canManage]);

  const annMut = useMutation({
    mutationFn: () =>
      serversApi.createAnnouncement(serverId, {
        title: annTitle.trim(),
        body: annBody.trim(),
        severity: 'INFO',
        scheduledFor: annSchedule ? new Date(annSchedule).toISOString() : null,
        requireAck: annRequireAck,
      }),
    onSuccess: () => {
      toast.success(t.serverAnnouncementScheduled);
      setAnnTitle('');
      setAnnBody('');
      setAnnSchedule('');
      setAnnRequireAck(false);
      void qc.invalidateQueries({ queryKey: queryKeys.serverAnnouncements(serverId) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const whMut = useMutation({
    mutationFn: () =>
      serversApi.createWebhook(serverId, {
        label: whLabel.trim(),
        url: whUrl.trim(),
        events: ['announcement.publish'],
      }),
    onSuccess: () => {
      toast.success(t.serverWebhookAdded);
      setWhLabel('');
      setWhUrl('');
      void qc.invalidateQueries({ queryKey: queryKeys.serverWebhooks(serverId) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const delWhMut = useMutation({
    mutationFn: (id: string) => serversApi.deleteWebhook(serverId, id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.serverWebhooks(serverId) }),
  });

  if (intLoading) return <p className="text-sm text-fg-subtle">{t.loading}</p>;

  return (
    <div className="w-full space-y-8">
      <section className="space-y-3 rounded-lg border border-white/8 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-accent-cyan" />
          <h3 className="font-medium text-fg">{t.serverIntegration_announcements_title}</h3>
        </div>
        <p className="text-xs text-fg-subtle">{t.serverIntegration_announcements_desc}</p>
        {canAnnounce ? (
          <>
            <div className="space-y-2">
              <Label>{t.serverAnnouncementTitle}</Label>
              <Input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
              <Label>{t.serverAnnouncementBody}</Label>
              <Textarea value={annBody} onChange={(e) => setAnnBody(e.target.value)} rows={4} />
              <Label>{t.serverAnnouncementSchedule}</Label>
              <Input type="datetime-local" value={annSchedule} onChange={(e) => setAnnSchedule(e.target.value)} />
              <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-fg">
                <input
                  type="checkbox"
                  className="accent-accent-cyan"
                  checked={annRequireAck}
                  onChange={(e) => setAnnRequireAck(e.target.checked)}
                />
                {t.announcementRequireAck}
              </label>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!annTitle.trim() || !annBody.trim() || annMut.isPending}
              onClick={() => annMut.mutate()}
            >
              {t.serverAnnouncementPublish}
            </Button>
            {announcements.length > 0 ? (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-fg-subtle">
                {announcements.slice(0, 8).map((a) => (
                  <li key={a.id} className="rounded border border-white/5 px-2 py-1">
                    <span className="font-medium text-fg">{a.title}</span>
                    {a.publishedAt ? ` · ${t.serverAnnouncementPublished}` : ` · ${t.serverAnnouncementPending}`}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted-fg">{t.serverAnnouncementNoPerm}</p>
        )}
      </section>

      {canManage ? (
        <>
          <section className="space-y-3 rounded-lg border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-accent-violet" />
              <h3 className="font-medium text-fg">{t.serverIntegration_email_title}</h3>
            </div>
            <p className="text-xs text-fg-subtle">{t.serverIntegration_email_desc}</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
              {t.serverEmailEnabled}
            </label>
            <div className="space-y-1">
              <Label>{t.serverEmailReplyTo}</Label>
              <Input type="email" value={emailReplyTo} onChange={(e) => setEmailReplyTo(e.target.value)} />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-fg" />
              <h3 className="font-medium text-fg">{t.serverIntegration_webhooks_title}</h3>
            </div>
            <p className="text-xs text-fg-subtle">{t.serverIntegration_webhooks_desc}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder={t.serverWebhookLabel} value={whLabel} onChange={(e) => setWhLabel(e.target.value)} />
              <Input placeholder="https://…" value={whUrl} onChange={(e) => setWhUrl(e.target.value)} />
            </div>
            <Button type="button" size="sm" variant="outline" disabled={!whLabel.trim() || !whUrl.trim() || whMut.isPending} onClick={() => whMut.mutate()}>
              {t.serverWebhookAdd}
            </Button>
            <ul className="space-y-2">
              {webhooks.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2 rounded border border-white/8 px-2 py-1.5 text-xs">
                  <span className="truncate text-fg">{w.label}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => delWhMut.mutate(w.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 rounded-lg border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent-amber" />
              <h3 className="font-medium text-fg">{t.serverIntegration_ctfd_title}</h3>
            </div>
            <p className="text-xs text-fg-subtle">{t.serverIntegration_ctfd_desc}</p>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-fg">{t.serverIntegration_ctfdUrl}</Label>
              <Input
                value={ctfdBaseUrl}
                onChange={(e) => setCtfdBaseUrl(e.target.value)}
                placeholder="https://ctf.example.com"
                disabled={ctfdBusy}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase text-muted-fg">{t.serverIntegration_ctfdToken}</Label>
              {tokenConfigured && !tokenEditing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-emerald/30 bg-accent-emerald/10 px-2.5 py-1 text-xs font-medium text-accent-emerald">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    {t.serverIntegration_ctfdTokenSaved}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={ctfdBusy}
                    onClick={() => {
                      setTokenEditing(true);
                      setCtfdAccessToken('');
                    }}
                  >
                    {t.serverIntegration_ctfdTokenChange}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-accent-rose hover:text-accent-rose"
                    disabled={ctfdBusy}
                    onClick={() => ctfdClearTokenMut.mutate()}
                  >
                    {t.serverIntegration_ctfdTokenRemove}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    type="password"
                    value={ctfdAccessToken}
                    onChange={(e) => setCtfdAccessToken(e.target.value)}
                    placeholder={tokenEditing ? t.serverIntegration_ctfdTokenChange : ''}
                    autoComplete="off"
                    disabled={ctfdBusy}
                  />
                  {tokenEditing && tokenConfigured ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={ctfdBusy}
                      onClick={() => {
                        setTokenEditing(false);
                        setCtfdAccessToken('');
                      }}
                    >
                      {t.serverIntegration_ctfdCancelEdit}
                    </Button>
                  ) : null}
                </div>
              )}
              <p className="text-[11px] text-muted-fg">{t.serverIntegration_ctfdTokenHint}</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                disabled={ctfdBusy || !canSaveCtfd}
                onClick={() => ctfdSaveMut.mutate()}
              >
                {ctfdSaveMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {clearingCtfd ? t.serverIntegration_ctfdSaveClear : t.serverIntegration_ctfdSave}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  ctfdBusy ||
                  (!ctfdBaseUrl.trim() && !integrations?.ctfdBaseUrl) ||
                  !hasTokenForTest
                }
                onClick={() => ctfdTestMut.mutate()}
              >
                {ctfdTestMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t.serverIntegration_ctfdTest}
              </Button>
              {storedCtfdUrl || tokenConfigured ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-accent-rose hover:text-accent-rose"
                  disabled={ctfdBusy}
                  onClick={() => ctfdDisconnectMut.mutate()}
                >
                  {ctfdDisconnectMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {t.serverIntegration_ctfdDisconnect}
                </Button>
              ) : null}
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-accent-cyan" />
              <h3 className="font-medium text-fg">{t.serverIntegration_branding_title}</h3>
            </div>
            <p className="text-xs text-fg-subtle">{t.serverIntegration_branding_desc}</p>
            <ColorPalettePicker value={themePrimary} onChange={setThemePrimary} label={t.serverThemePrimary} />
            <ColorPalettePicker value={themeAccent} onChange={setThemeAccent} label={t.serverThemeAccent} />
            <Button type="button" size="sm" disabled={patchBrandingMut.isPending} onClick={() => patchBrandingMut.mutate()}>
              {t.serverIntegrationsSave}
            </Button>
          </section>
        </>
      ) : (
        <p className="text-sm text-fg-subtle">{t.serverIntegrationsAdminOnly}</p>
      )}
    </div>
  );
}
