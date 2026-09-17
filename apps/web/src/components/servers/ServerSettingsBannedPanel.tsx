'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/providers/LocaleProvider';
import { serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { UserIdentity } from '@/components/common/UserIdentity';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';

export function ServerSettingsBannedPanel({ serverId }: { serverId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = React.useState('');

  const { data: banned = [], isLoading } = useQuery({
    queryKey: queryKeys.serverMembers(serverId, `banned-${q}`),
    queryFn: () => serversApi.listMembers(serverId, { q: q || undefined, bannedOnly: true }),
  });

  const unbanMut = useMutation({
    mutationFn: (userId: string) => serversApi.unbanMember(serverId, userId),
    onSuccess: () => {
      toast.success(t.serverMemberUnbanOk);
      void qc.invalidateQueries({ queryKey: ['servers', serverId, 'members'] });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  return (
    <div className="w-full space-y-4">
      <Input placeholder={t.serverMemberSearch} value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent-violet" /> : null}
      {!isLoading && banned.length === 0 ? (
        <p className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-10 text-center text-sm text-fg-subtle">
          {t.serverBannedEmpty}
        </p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-lg border border-white/8">
          {banned.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <UserIdentity user={{ ...m, displayName: m.nickname ?? m.displayName }} className="min-w-0 flex-1" />
              <span className="text-xs uppercase text-accent-rose/90">{t.serverBannedBadge}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={unbanMut.isPending}
                onClick={() => unbanMut.mutate(m.id)}
              >
                {t.serverMemberUnban}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
