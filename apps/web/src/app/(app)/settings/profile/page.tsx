'use client';

import * as React from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useI18n } from '@/components/providers/LocaleProvider';
import { applyDomTheme } from '@/components/providers/ThemeProvider';
import { useAuthStore } from '@/store/auth';
import { usersApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import type { SessionUser } from '@sydt/shared';
import { useQueryClient } from '@tanstack/react-query';
import { DmConversationsList } from '@/components/direct/DmConversationsList';

export default function ProfileSettingsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [displayName, setDisplayName] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');
  const [defaultNotifyMode, setDefaultNotifyMode] = React.useState<'ALL' | 'MENTIONS_ONLY' | 'NONE'>('ALL');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setBio(user.bio ?? '');
    setTheme(user.theme);
    setDefaultNotifyMode(user.defaultNotifyMode);
  }, [user]);

  if (!user) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title={t.profilePageTitle} />
      </div>
    );
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const next = await usersApi.patchMe({
        displayName: displayName.trim(),
        bio,
        theme,
        defaultNotifyMode,
      });
      setUser(next as SessionUser);
      applyDomTheme(next.theme);
      void queryClient.invalidateQueries({ queryKey: queryKeys.channels });
      toast.success(t.profileSavedToast);
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? t.profileError);
    } finally {
      setBusy(false);
    }
  };

  const uploadRef = React.useRef<HTMLInputElement>(null);

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const next = await usersApi.uploadAvatar(file);
      setUser(next as SessionUser);
      toast.success(t.profileSavedToast);
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? t.profileError);
    } finally {
      setBusy(false);
    }
  };

  const clearAvatar = async () => {
    setBusy(true);
    try {
      const next = await usersApi.clearAvatar();
      setUser(next as SessionUser);
      toast.success(t.profileSavedToast);
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? t.profileError);
    } finally {
      setBusy(false);
    }
  };

  const prefsDirty = theme !== user.theme || defaultNotifyMode !== user.defaultNotifyMode;
  const nameBioDirty =
    displayName.trim() !== user.displayName.trim() || bio.trim() !== (user.bio ?? '').trim();
  const nameOk = displayName.trim().length >= 2;
  const canSave = prefsDirty || (nameBioDirty && nameOk);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar title={t.profilePageTitle} subtitle={t.profilePageSubtitle} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto grid max-w-3xl gap-6 lg:grid-cols-[minmax(0,17rem)_1fr]">
          <GlassPanel className="h-fit p-4 lg:sticky lg:top-4">
            <DmConversationsList />
          </GlassPanel>

          <div className="space-y-6">
            <GlassPanel className="space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name={user.displayName} src={user.avatarUrl} size="lg" />
                <div className="space-y-2">
                  <input
                    ref={uploadRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => void onAvatar(e)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => uploadRef.current?.click()}
                  >
                    {t.profileAvatarUpload}
                  </Button>
                  {user.avatarUrl ? (
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void clearAvatar()}>
                      {t.profileAvatarRemove}
                    </Button>
                  ) : null}
                  <p className="text-[11px] text-fg-subtle">{t.profileAvatarHint}</p>
                </div>
              </div>
            </GlassPanel>

            <GlassPanel className="space-y-4 p-6">
              <div className="space-y-1.5">
                <Label>{t.profileThemeLabel}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-white/10 bg-bg-deep px-3 text-sm text-fg"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                >
                  <option value="dark">{t.profileThemeDark}</option>
                  <option value="light">{t.profileThemeLight}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t.profileDefaultNotifyLabel}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-white/10 bg-bg-deep px-3 text-sm text-fg"
                  value={defaultNotifyMode}
                  onChange={(e) =>
                    setDefaultNotifyMode(e.target.value as typeof defaultNotifyMode)
                  }
                >
                  <option value="ALL">{t.profileDefaultNotifyAll}</option>
                  <option value="MENTIONS_ONLY">{t.profileDefaultNotifyMentions}</option>
                  <option value="NONE">{t.profileDefaultNotifyNone}</option>
                </select>
              </div>
            </GlassPanel>

            <GlassPanel className="p-6">
              <form className="space-y-4" onSubmit={(e) => void onSave(e)}>
                <div className="space-y-1.5">
                  <Label>{t.profileEmailLabel}</Label>
                  <Input readOnly disabled value={user.email} />
                  <p className="text-[11px] text-fg-muted">{t.profileReadonlyNote}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profileUsernameLabel}</Label>
                  <Input readOnly disabled value={user.username} />
                  <p className="text-[11px] text-fg-muted">{t.profileReadonlyNote}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profileDisplayNameLabel}</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profileBioLabel}</Label>
                  <Textarea
                    placeholder={t.profileBioPlaceholder}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={5}
                    className="resize-y"
                    maxLength={500}
                  />
                </div>
                <Button type="submit" disabled={!canSave || busy}>
                  {t.save}
                </Button>
              </form>
            </GlassPanel>

            <Link
              href="/settings/notifications"
              className="block text-center text-sm text-accent-cyan hover:underline md:text-left"
            >
              {t.settingsNotificationsMenu}
            </Link>
            <Link href="/" className="block text-center text-sm text-accent-cyan hover:underline md:text-left">
              {t.settingsBackToWorkspace}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
