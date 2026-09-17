'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SERVER_PERM_CATEGORIES,
  SERVER_PERM_KEYS,
  SERVER_ROLE_DEFAULT_PERMISSIONS,
  type ServerPermKey,
  type ServerPermissionsMap,
  type ServerRole,
} from '@sydt/shared';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/providers/LocaleProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColorPalettePicker } from '@/components/common/ColorPalettePicker';
import { serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

export function ServerSettingsRolesPanel({ serverId }: { serverId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState('');
  const [draftColor, setDraftColor] = React.useState('#a78bfa');
  const [draftHoist, setDraftHoist] = React.useState(false);
  const [draftPos, setDraftPos] = React.useState(0);
  const [draftPerms, setDraftPerms] = React.useState<ServerPermissionsMap>({});

  const { data: roles = [], isLoading } = useQuery({
    queryKey: queryKeys.serverRoles(serverId),
    queryFn: () => serversApi.listRoles(serverId),
  });

  const selected = React.useMemo(
    () => roles.find((r) => r.id === selectedId) ?? null,
    [roles, selectedId],
  );

  React.useEffect(() => {
    if (roles.length === 0) return;
    if (!selectedId || !roles.some((r) => r.id === selectedId)) {
      setSelectedId(roles[0]!.id);
    }
  }, [roles, selectedId]);

  React.useEffect(() => {
    if (!selected) return;
    setDraftName(selected.name);
    setDraftColor(selected.color);
    setDraftHoist(selected.hoist);
    setDraftPos(selected.position);
    setDraftPerms({ ...SERVER_ROLE_DEFAULT_PERMISSIONS, ...selected.permissions });
  }, [selected]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.serverRoles(serverId) });
    void qc.invalidateQueries({ queryKey: queryKeys.serverMemberRoleGroups(serverId) });
  };

  const createMut = useMutation({
    mutationFn: () =>
      serversApi.createRole(serverId, {
        name: t.serverRoleNewName,
        color: '#a78bfa',
        permissions: { ...SERVER_ROLE_DEFAULT_PERMISSIONS },
      }),
    onSuccess: (role) => {
      setSelectedId(role.id);
      invalidate();
      toast.success(t.serverRoleCreated);
    },
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      serversApi.updateRole(serverId, selected!.id, {
        name: draftName.trim(),
        color: draftColor,
        hoist: draftHoist,
        position: draftPos,
        permissions: draftPerms,
      }),
    onSuccess: () => {
      toast.success(t.profileSavedToast);
      invalidate();
    },
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  const deleteMut = useMutation({
    mutationFn: (roleId: string) => serversApi.deleteRole(serverId, roleId),
    onSuccess: (_, roleId) => {
      if (selectedId === roleId) setSelectedId(null);
      invalidate();
      toast.success(t.serverRoleDeleted);
    },
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  const togglePerm = (key: ServerPermKey) => {
    setDraftPerms((p) => ({ ...p, [key]: !p[key] }));
  };

  const setAllPerms = (on: boolean) => {
    const next: ServerPermissionsMap = {};
    for (const key of SERVER_PERM_KEYS) next[key] = on;
    setDraftPerms(next);
  };

  const confirmDelete = (role: ServerRole) => {
    if (role.name === 'Default') return;
    if (!window.confirm(t.serverRoleDeleteConfirm.replace('{{name}}', role.name))) return;
    deleteMut.mutate(role.id);
  };

  const permLabel = (key: ServerPermKey) => t[`serverPerm_${key}` as keyof typeof t] as string;
  const permDesc = (key: ServerPermKey) =>
    t[`serverPermDesc_${key}` as keyof typeof t] as string | undefined;
  const catLabel = (id: (typeof SERVER_PERM_CATEGORIES)[number]['id']) =>
    t[`serverPermCat_${id}` as keyof typeof t] as string;

  if (isLoading) return <p className="text-sm text-fg-subtle">{t.loading}</p>;

  return (
    <div className="mx-auto flex min-h-[24rem] w-full gap-4">
      <aside className="flex w-52 shrink-0 flex-col gap-2">
        <Button
          type="button"
          size="sm"
          className="w-full gap-1"
          disabled={createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          <Plus className="h-4 w-4" />
          {t.serverRolesCreate}
        </Button>
        <p className="px-1 text-xs font-semibold uppercase text-muted-fg">
          {t.serverRolesCount.replace('{{count}}', String(roles.length))}
        </p>
        <div className="min-h-0 max-h-[28rem] flex-1 space-y-1 overflow-y-auto pr-1">
          {roles.map((r) => {
            const active = selectedId === r.id;
            return (
              <div
                key={r.id}
                className={cn(
                  'flex items-center gap-1 rounded-md border border-transparent p-0.5',
                  active && 'border-white/15 bg-white/10',
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm',
                    active ? 'text-fg' : 'text-fg-subtle hover:bg-white/5',
                  )}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="truncate">{r.name}</span>
                </button>
                {r.name !== 'Default' ? (
                  <button
                    type="button"
                    title={t.serverRoleDeleteBtn}
                    className="shrink-0 rounded p-1.5 text-muted-fg hover:bg-accent-rose/15 hover:text-accent-rose"
                    disabled={deleteMut.isPending}
                    onClick={() => confirmDelete(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>

      {selected ? (
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
            <h3 className="truncate text-lg font-semibold text-fg">{draftName}</h3>
            <Button type="button" size="sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              {t.save}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-fg">{t.serverRoleNameLabel}</Label>
              <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-fg">{t.serverRoleIdLabel}</Label>
              <Input value={selected.id} readOnly className="font-mono text-xs opacity-70" />
            </div>
          </div>

          <ColorPalettePicker value={draftColor} onChange={setDraftColor} label={t.serverRoleColorLabel} />

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={draftHoist} onChange={(e) => setDraftHoist(e.target.checked)} />
              {t.serverRoleHoist}
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-muted-fg">{t.serverRoleOrder}</Label>
              <Input
                type="number"
                className="w-20"
                value={draftPos}
                onChange={(e) => setDraftPos(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-muted-fg">{t.serverRolesPermHeading}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setAllPerms(true)}>
                {t.serverPermsSelectAll}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setAllPerms(false)}>
                {t.serverPermsDeselectAll}
              </Button>
            </div>
          </div>

          <div className="max-h-[22rem] space-y-4 overflow-y-auto pr-1">
            {SERVER_PERM_CATEGORIES.map((cat) => (
              <div key={cat.id}>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-cyan/90">
                  {catLabel(cat.id)}
                </h4>
                <ul className="space-y-0.5">
                  {cat.keys.map((key) => {
                    const on = !!draftPerms[key];
                    const label = permLabel(key);
                    const desc = permDesc(key);
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => togglePerm(key)}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left',
                            on ? 'bg-accent-rose/10' : 'hover:bg-white/5',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs',
                              on ? 'border-accent-rose bg-accent-rose text-white' : 'border-white/20',
                            )}
                          >
                            {on ? '✓' : ''}
                          </span>
                          <span>
                            <span className="block text-sm font-medium text-fg">{label}</span>
                            {desc ? <span className="block text-xs text-muted-fg">{desc}</span> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-fg-subtle">{t.serverRolesEmpty}</p>
      )}
    </div>
  );
}
