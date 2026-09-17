'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, LogIn, Users } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { invitesApi } from '@/lib/api/endpoints';
import { unwrapApiError } from '@/lib/api/axios';
import { queryKeys } from '@/lib/query/client';
import { useServerStore } from '@/store/server';
import { useI18n } from '@/components/providers/LocaleProvider';

/** Accepts a raw invite code or a full `/invite/<code>` URL. */
function normalizeInviteCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/invite\/([^/?#]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch {
    // not a URL — fall through
  }
  const pathMatch = trimmed.match(/\/invite\/([^/?#]+)/i);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
  return trimmed.replace(/^#/, '');
}

/**
 * Shown when the signed-in user belongs to zero competitions. Open registration
 * normally places them on the default server; this covers invite-only setups
 * and accounts created before that fix.
 */
export function NoServerOnboarding() {
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const setActiveServerId = useServerStore((s) => s.setActiveServerId);
  const [code, setCode] = React.useState('');

  const joinMut = useMutation({
    mutationFn: () => invitesApi.accept(normalizeInviteCode(code)),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: queryKeys.servers });
      setActiveServerId(res.server.id);
      toast.success(res.joined ? t.inviteJoinSuccess : t.inviteAlreadyMember);
      if (res.channelId) router.replace(`/channels/${res.channelId}`);
      else router.replace('/');
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const canSubmit = normalizeInviteCode(code).length >= 4;

  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center p-6">
      <GlassPanel className="w-full max-w-md space-y-5 p-6">
        <EmptyState
          icon={Users}
          title={t.noServerTitle}
          description={t.noServerLead}
          className="py-4"
        />
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit || joinMut.isPending) return;
            joinMut.mutate();
          }}
        >
          <label className="block space-y-1.5 text-left text-xs">
            <span className="font-semibold uppercase tracking-wider text-muted-fg">
              {t.noServerInviteLabel}
            </span>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t.noServerInvitePlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <Button type="submit" variant="primary" className="w-full" disabled={!canSubmit || joinMut.isPending}>
            {joinMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {t.noServerJoinAction}
          </Button>
        </form>
        <p className="text-center text-[11px] text-muted-fg">{t.noServerHint}</p>
      </GlassPanel>
    </div>
  );
}
