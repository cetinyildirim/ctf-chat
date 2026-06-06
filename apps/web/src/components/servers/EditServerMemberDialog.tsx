'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/providers/LocaleProvider';
import { serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import type { ChatServer } from '@sydt/shared';
import { useAuthStore } from '@/store/auth';

export function EditServerMemberDialog({
  server,
  open,
  onOpenChange,
}: {
  server: ChatServer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const { data: member, isLoading } = useQuery({
    queryKey: queryKeys.serverMe(server.id),
    queryFn: () => serversApi.getMe(server.id),
    enabled: open,
  });

  const [nickname, setNickname] = React.useState('');

  React.useEffect(() => {
    if (member) setNickname(member.nickname ?? member.displayName);
  }, [member]);

  const saveMut = useMutation({
    mutationFn: () => serversApi.patchMe(server.id, { nickname: nickname.trim() || null }),
    onSuccess: () => {
      toast.success(t.profileSavedToast);
      void qc.invalidateQueries({ queryKey: queryKeys.serverMe(server.id) });
      onOpenChange(false);
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const uploadRef = React.useRef<HTMLInputElement>(null);
  const avatarMut = useMutation({
    mutationFn: (file: File) => serversApi.uploadMeAvatar(server.id, file),
    onSuccess: () => {
      toast.success(t.profileSavedToast);
      void qc.invalidateQueries({ queryKey: queryKeys.serverMe(server.id) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const clearAvatarMut = useMutation({
    mutationFn: () => serversApi.clearMeAvatar(server.id),
    onSuccess: () => {
      toast.success(t.profileSavedToast);
      void qc.invalidateQueries({ queryKey: queryKeys.serverMe(server.id) });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const displayName = member?.nickname ?? member?.displayName ?? me?.displayName ?? '?';
  const avatarSrc = member?.avatarUrl ?? me?.avatarUrl ?? null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] w-[min(96vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-[#1e1f22] shadow-2xl outline-none">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <Dialog.Title className="text-sm font-semibold text-fg">
              {t.serverEditIdentityTitle.replace('{{server}}', server.name)}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="rounded-md p-1 text-muted-fg hover:bg-white/10" aria-label={t.userCardClose}>
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-accent-violet" />
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-fg">{t.serverNicknameLabel}</Label>
                <div className="mt-1 flex gap-2">
                  <Input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={32} />
                  <Button type="button" size="sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                    {t.save}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-fg">{t.serverAvatarLabel}</Label>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <Avatar name={displayName} src={avatarSrc} size="lg" />
                  <div className="space-y-2">
                    <input
                      ref={uploadRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) avatarMut.mutate(f);
                      }}
                    />
                    <Button type="button" size="sm" variant="outline" disabled={avatarMut.isPending} onClick={() => uploadRef.current?.click()}>
                      {t.profileAvatarUpload}
                    </Button>
                    {avatarSrc ? (
                      <Button type="button" size="sm" variant="ghost" disabled={clearAvatarMut.isPending} onClick={() => clearAvatarMut.mutate()}>
                        {t.profileAvatarRemove}
                      </Button>
                    ) : null}
                    <p className="text-[11px] text-muted-fg">{t.serverAvatarMax}</p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-fg">{t.serverPreviewLabel}</Label>
                <div className="mt-2 rounded-lg bg-[#2b2d31] px-3 py-2">
                  <div className="flex gap-3">
                    <Avatar name={displayName} src={avatarSrc} size="md" />
                    <div>
                      <div className="font-semibold text-fg">{displayName}</div>
                      <div className="text-[11px] text-muted-fg">{t.serverPreviewTime}</div>
                      <p className="mt-1 text-sm text-fg-subtle">{t.serverPreviewMessage}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
