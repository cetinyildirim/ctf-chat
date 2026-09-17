'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { PublicUser } from '@sydt/shared';
import { serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useI18n } from '@/components/providers/LocaleProvider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserIdentity } from '@/components/common/UserIdentity';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

type MemberRow = PublicUser & { nickname: string | null; serverAvatarUrl: string | null };

export function ServerSettingsMembersPanel({ serverId }: { serverId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [memberQ, setMemberQ] = React.useState('');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [roleDraft, setRoleDraft] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: queryKeys.serverMembers(serverId, memberQ),
    queryFn: () => serversApi.listMembers(serverId, { q: memberQ || undefined }),
  });

  const { data: roles = [] } = useQuery({
    queryKey: queryKeys.serverRoles(serverId),
    queryFn: () => serversApi.listRoles(serverId),
  });

  const { data: assignedIds, isFetching: rolesLoading, isFetched } = useQuery({
    queryKey: queryKeys.memberRoles(serverId, expandedId ?? ''),
    queryFn: () => serversApi.getMemberRoles(serverId, expandedId!),
    enabled: !!expandedId,
  });

  React.useEffect(() => {
    if (!expandedId) {
      setRoleDraft(null);
      setDirty(false);
      return;
    }
    if (isFetched && !dirty) {
      setRoleDraft(assignedIds?.[0] ?? null);
    }
  }, [expandedId, isFetched, assignedIds, dirty]);

  const saveRolesMut = useMutation({
    mutationFn: () => serversApi.setMemberRoles(serverId, expandedId!, roleDraft ? [roleDraft] : []),
    onSuccess: () => {
      setDirty(false);
      toast.success(t.serverMemberRolesSaved);
      void qc.invalidateQueries({ queryKey: queryKeys.memberRoles(serverId, expandedId!) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverRoles(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.serverMemberRoleGroups(serverId) });
    },
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  const banMut = useMutation({
    mutationFn: (userId: string) => serversApi.banMember(serverId, userId),
    onSuccess: () => {
      toast.success(t.serverMemberBanOk);
      setExpandedId(null);
      void qc.invalidateQueries({ queryKey: ['servers', serverId, 'members'] });
    },
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  const selectRole = (roleId: string) => {
    setDirty(true);
    setRoleDraft((current) => (current === roleId ? null : roleId));
  };

  const openMember = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setDirty(false);
  };

  return (
    <div className="w-full space-y-4">
      <Input placeholder={t.serverMemberSearch} value={memberQ} onChange={(e) => setMemberQ(e.target.value)} />
      <p className="text-xs uppercase text-muted-fg">{t.serverMemberCount.replace('{{count}}', String(members.length))}</p>
      {isLoading ? <Loader2 className="mx-auto h-8 w-8 animate-spin" /> : null}
      <ul className="divide-y divide-white/5 rounded-lg border border-white/8">
        {members.map((m: MemberRow) => {
          const open = expandedId === m.id;
          return (
            <li key={m.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
                onClick={() => openMember(m.id)}
              >
                <UserIdentity user={{ ...m, displayName: m.nickname ?? m.displayName }} className="min-w-0 flex-1" />
                {open ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-fg" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-fg" />
                )}
              </button>
              {open ? (
                <div
                  className="border-t border-white/5 bg-black/20 px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-fg">{t.serverMemberRolesTitle}</p>
                  <p className="mb-2 text-[11px] text-fg-subtle">{t.serverMemberRolesSingleHint}</p>
                  {rolesLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  <ul className="space-y-2" role="radiogroup" aria-label={t.serverMemberRolesTitle}>
                    {roles.map((r) => {
                      const checked = roleDraft === r.id;
                      return (
                        <li key={r.id}>
                          <label
                            className={cn(
                              'flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/5',
                              checked && 'bg-accent-rose/5',
                            )}
                          >
                            <input
                              type="radio"
                              name={`member-role-${expandedId}`}
                              checked={checked}
                              onChange={() => {
                                if (roleDraft !== r.id) selectRole(r.id);
                              }}
                              onClick={(e) => {
                                if (roleDraft === r.id) {
                                  e.preventDefault();
                                  selectRole(r.id);
                                }
                              }}
                              className="accent-accent-cyan"
                            />
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: r.color }} />
                            <span className="text-sm font-medium" style={{ color: r.color }}>
                              {r.name}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3"
                    disabled={saveRolesMut.isPending || rolesLoading}
                    onClick={() => saveRolesMut.mutate()}
                  >
                    {t.save}
                  </Button>
                  {expandedId && expandedId !== me?.id ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 ml-2 text-accent-rose hover:text-accent-rose"
                      disabled={banMut.isPending}
                      onClick={() => banMut.mutate(expandedId)}
                    >
                      {t.serverMemberBan}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
