'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/common/GlassPanel';
import { useAuthStore } from '@/store/auth';
import { invitesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useServerStore } from '@/store/server';
import { resolveServerIconSrc } from '@/lib/branding/logo-badges';
import { useI18n } from '@/components/providers/LocaleProvider';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';

export default function InvitePage() {
  const params = useParams();
  const code = typeof params.code === 'string' ? params.code : '';
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const setActiveServerId = useServerStore((s) => s.setActiveServerId);

  const loginHref = `/login?next=${encodeURIComponent(`/invite/${code}`)}`;

  const { data: invite, isLoading, error, refetch } = useQuery({
    queryKey: ['invites', code],
    queryFn: () => invitesApi.preview(code),
    enabled: ready && !!user && !!code,
    retry: false,
  });

  const acceptMut = useMutation({
    mutationFn: () => invitesApi.accept(code),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: queryKeys.servers });
      setActiveServerId(res.server.id);
      toast.success(res.joined ? t.inviteJoinSuccess : t.inviteAlreadyMember);
      if (res.channelId) router.replace(`/channels/${res.channelId}`);
      else router.replace('/');
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  if (!ready) {
    return (
      <div className="grid min-h-svh place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-cyan" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-6 p-8">
        <GlassPanel className="w-full space-y-4 p-6 text-center">
          <Users className="mx-auto h-10 w-10 text-accent-cyan" />
          <h1 className="text-lg font-semibold">{t.inviteLoginTitle}</h1>
          <p className="text-sm text-fg-subtle">{t.inviteLoginHint}</p>
          <Button asChild className="w-full">
            <Link href={loginHref}>{t.authLoginSubmit}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/register?next=${encodeURIComponent(`/invite/${code}`)}`}>{t.inviteRegisterBtn}</Link>
          </Button>
        </GlassPanel>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid min-h-svh place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-violet" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
        <p className="text-fg-subtle">{unwrapApiError(error).message || t.inviteNotFound}</p>
        <Button type="button" variant="outline" onClick={() => void refetch()}>
          {t.userCardRetry}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">{t.inviteGoHome}</Link>
        </Button>
      </div>
    );
  }

  const iconSrc = resolveServerIconSrc(invite.server);
  const disabled = invite.expired || invite.bannedFromServer;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-6 p-8">
      <GlassPanel className="w-full space-y-5 p-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-muted-fg">{t.inviteJoinTitle}</p>
          <div className="mx-auto mt-4 h-20 w-20 overflow-hidden rounded-2xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconSrc} alt="" className="h-full w-full object-cover" />
          </div>
          <h1 className="mt-4 text-xl font-bold">{invite.server.name}</h1>
          {invite.channelName ? (
            <p className="mt-1 text-sm text-fg-subtle">
              {t.inviteChannelHint.replace('{{channel}}', invite.channelName)}
            </p>
          ) : null}
          {invite.expiresAt && !invite.expired ? (
            <p className="mt-2 text-xs text-muted-fg">
              {t.inviteExpiresHint.replace('{{date}}', new Date(invite.expiresAt).toLocaleString())}
            </p>
          ) : null}
        </div>

        {invite.expired ? (
          <p className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-3 py-2 text-center text-sm text-accent-rose">
            {t.inviteExpired}
          </p>
        ) : null}
        {invite.bannedFromServer ? (
          <p className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-3 py-2 text-center text-sm text-accent-rose">
            {t.inviteBannedFromServer}
          </p>
        ) : null}
        {invite.alreadyMember ? (
          <p className="text-center text-sm text-fg-subtle">{t.inviteAlreadyMemberHint}</p>
        ) : null}

        <Button
          type="button"
          className="w-full"
          disabled={disabled || acceptMut.isPending}
          onClick={() => {
            if (invite.alreadyMember) {
              setActiveServerId(invite.server.id);
              if (invite.channelId) router.replace(`/channels/${invite.channelId}`);
              else router.replace('/');
              return;
            }
            acceptMut.mutate();
          }}
        >
          {acceptMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : invite.alreadyMember ? (
            t.inviteOpenServer
          ) : (
            t.inviteAcceptBtn
          )}
        </Button>

        <Button asChild variant="ghost" className="w-full">
          <Link href="/">{t.inviteGoHome}</Link>
        </Button>
      </GlassPanel>
    </div>
  );
}
