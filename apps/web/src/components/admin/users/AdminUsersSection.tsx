'use client';

import * as React from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ALL_ROLES, type Role } from '@sydt/shared';
import { Download, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { GlassPanel } from '@/components/common/GlassPanel';
import { RoleBadge, roleLabel } from '@/components/common/RoleBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/components/providers/LocaleProvider';
import {
  adminUserManageApi,
  type BulkMembershipBody,
  type ManagedServer,
  type ManagedUser,
  type ManagedUserFilters,
  type ManagedUserStatusFilter,
} from '@/lib/api/endpoints';
import { unwrapApiError } from '@/lib/api/axios';
import { relative } from '@/lib/format/time';
import { cn } from '@/lib/utils';
import { CreateUserDialog } from './CreateUserDialog';
import { UserDetailDialog } from './UserDetailDialog';
import { ServerRoleSelect, StatusBadge, fill, managedServersKey, selectClass, usersManageKey } from './shared';

type Tab = 'users' | 'membership' | 'autojoin';
const PAGE_SIZE = 50;

export function AdminUsersSection() {
  const { t } = useI18n();
  const [tab, setTab] = React.useState<Tab>('users');
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());

  const { data: servers = [] } = useQuery({
    queryKey: managedServersKey,
    queryFn: adminUserManageApi.servers,
  });

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'users', label: t.umTabUsers },
    { id: 'membership', label: t.umTabMembership },
    { id: 'autojoin', label: t.umTabAutoJoin },
  ];

  return (
    <div className="admin-page w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-fg">{t.umTitle}</h1>
        <p className="mt-1 text-sm text-fg-subtle">{t.umLead}</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-1">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm transition-colors',
              tab === x.id ? 'bg-accent-cyan/15 font-medium text-fg' : 'text-fg-subtle hover:bg-white/5 hover:text-fg',
            )}
          >
            {x.label}
            {x.id === 'membership' && selected.size > 0 ? (
              <span className="ml-1.5 rounded-full bg-accent-cyan/20 px-1.5 text-[11px] text-accent-cyan">
                {selected.size}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'users' ? (
        <UsersList
          servers={servers}
          selected={selected}
          setSelected={setSelected}
          onBulk={() => setTab('membership')}
        />
      ) : null}
      {tab === 'membership' ? <BulkMembershipPanel servers={servers} selectedIds={[...selected]} /> : null}
      {tab === 'autojoin' ? <AutoJoinPanel servers={servers} /> : null}
    </div>
  );
}

function UsersList({
  servers,
  selected,
  setSelected,
  onBulk,
}: {
  servers: ManagedServer[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  onBulk: () => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = React.useState('');
  const [debouncedQ, setDebouncedQ] = React.useState('');
  const [role, setRole] = React.useState<Role | ''>('');
  const [serverId, setServerId] = React.useState('');
  const [status, setStatus] = React.useState<ManagedUserStatusFilter | ''>('');
  const [page, setPage] = React.useState(1);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const filters: ManagedUserFilters = { q: debouncedQ, role, serverId, status };
  React.useEffect(() => setPage(1), [debouncedQ, role, serverId, status]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...usersManageKey, 'list', filters, page],
    queryFn: () => adminUserManageApi.list({ ...filters, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allOnPage = users.length > 0 && users.every((u) => selected.has(u.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const u of users) {
        if (allOnPage) next.delete(u.id);
        else next.add(u.id);
      }
      return next;
    });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await adminUserManageApi.exportCsv(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sydt-kullanicilar-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <GlassPanel className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
            <Input className="pl-9" placeholder={t.umSearch} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button type="button" variant="outline" className="gap-1.5" disabled={exporting} onClick={() => void exportCsv()}>
            <Download className="h-4 w-4" />
            {t.umExportCsv}
          </Button>
          <Button type="button" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" />
            {t.umNewUser}
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
            <option value="">{t.umFilterRoleAll}</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r, t)}
              </option>
            ))}
          </select>
          <select className={selectClass} value={serverId} onChange={(e) => setServerId(e.target.value)}>
            <option value="">{t.umFilterServerAll}</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as ManagedUserStatusFilter | '')}
          >
            <option value="">{t.umFilterStatusAll}</option>
            <option value="active">{t.umStatusActive}</option>
            <option value="disabled">{t.umStatusDisabled}</option>
            <option value="banned">{t.umStatusBanned}</option>
            <option value="muted">{t.umStatusMuted}</option>
            <option value="mustChange">{t.umStatusMustChange}</option>
          </select>
        </div>
      </GlassPanel>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 px-4 py-2.5 text-sm">
          <span className="font-medium text-fg">{fill(t.umSelected, { count: selected.size })}</span>
          <div className="ml-auto flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setSelected(new Set())}>
              {t.umClearSelection}
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={onBulk}>
              <Users className="h-3.5 w-3.5" />
              {t.umBulkWithSelected}
            </Button>
          </div>
        </div>
      ) : null}

      <GlassPanel className="overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2 text-xs text-muted-fg">
          <span>
            {fill(t.umTotal, { count: total })}
            {isFetching && !isLoading ? ' …' : ''}
          </span>
        </div>
        <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-semibold uppercase tracking-wide text-muted-fg">
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label={t.umSelectAllPage} />
              </th>
              <th className="px-3 py-2.5">{t.umColUser}</th>
              <th className="px-3 py-2.5">{t.umColEmail}</th>
              <th className="px-3 py-2.5">{t.umColRole}</th>
              <th className="px-3 py-2.5">{t.umColServers}</th>
              <th className="px-3 py-2.5">{t.umColLastSeen}</th>
              <th className="px-3 py-2.5">{t.umColStatus}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-fg-subtle">
                  {t.loading}
                </td>
              </tr>
            ) : null}
            {!isLoading && users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-fg-subtle">
                  {t.umEmpty}
                </td>
              </tr>
            ) : null}
            {users.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                checked={selected.has(u.id)}
                onToggle={() => toggle(u.id)}
                onOpen={() => setDetailId(u.id)}
              />
            ))}
          </tbody>
        </table>
        {pages > 1 ? (
          <div className="flex items-center justify-end gap-2 border-t border-white/8 px-4 py-2">
            <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t.umPrev}
            </Button>
            <span className="text-xs text-muted-fg">{fill(t.umPage, { page, pages })}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t.umNext}
            </Button>
          </div>
        ) : null}
      </GlassPanel>

      <UserDetailDialog userId={detailId} servers={servers} onOpenChange={(open) => !open && setDetailId(null)} />
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} servers={servers} />
    </>
  );
}

function UserRow({
  u,
  checked,
  onToggle,
  onOpen,
}: {
  u: ManagedUser;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  return (
    <tr
      className={cn(
        'cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.03]',
        checked && 'bg-accent-cyan/[0.06]',
        u.disabledAt && 'opacity-60',
      )}
      onClick={onOpen}
    >
      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={onToggle} aria-label={u.username} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn('h-2 w-2 shrink-0 rounded-full', u.status === 'ONLINE' ? 'bg-accent-emerald' : 'bg-white/20')}
          />
          <div className="min-w-0">
            <div className="truncate font-medium text-fg">{u.displayName}</div>
            <div className="truncate font-mono text-[11px] text-muted-fg">
              @{u.username}
              {u.team ? (
                <span className="ml-1.5 font-sans" style={{ color: u.team.color }}>
                  · {u.team.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </td>
      <td className="max-w-[14rem] truncate px-3 py-2.5 text-fg-subtle">{u.email}</td>
      <td className="px-3 py-2.5">
        <RoleBadge role={u.role} />
      </td>
      <td className="px-3 py-2.5 font-mono text-fg-subtle">{u.serverCount}</td>
      <td className="px-3 py-2.5 text-fg-subtle">{u.lastSeenAt ? relative(u.lastSeenAt) : t.umNever}</td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {u.disabledAt ? <StatusBadge tone="rose">{t.umStatusDisabled}</StatusBadge> : null}
          {u.isBanned ? <StatusBadge tone="rose">{t.umStatusBanned}</StatusBadge> : null}
          {u.mutedUntil ? <StatusBadge tone="violet">{t.umStatusMuted}</StatusBadge> : null}
          {u.mustChangePassword ? <StatusBadge tone="amber">{t.umStatusMustChange}</StatusBadge> : null}
          {!u.disabledAt && !u.isBanned && !u.mutedUntil && !u.mustChangePassword ? (
            <StatusBadge tone="muted">{t.umStatusActive}</StatusBadge>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

type SourceMode = 'all' | 'users' | 'platformRole' | 'server';

function BulkMembershipPanel({ servers, selectedIds }: { servers: ManagedServer[]; selectedIds: string[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [action, setAction] = React.useState<BulkMembershipBody['action']>('add');
  const [mode, setMode] = React.useState<SourceMode>(selectedIds.length ? 'users' : 'all');
  const [sourceRole, setSourceRole] = React.useState<Role>(ALL_ROLES[1]!);
  const [sourceServerId, setSourceServerId] = React.useState('');
  const [sourceRoleId, setSourceRoleId] = React.useState('');
  const [fromServerId, setFromServerId] = React.useState('');
  const [targetServerId, setTargetServerId] = React.useState('');
  const [targetRoleId, setTargetRoleId] = React.useState('');
  const [includeDisabled, setIncludeDisabled] = React.useState(false);
  const [preview, setPreview] = React.useState<{ matched: number; alreadyInTarget: number } | null>(null);

  const body = React.useMemo<BulkMembershipBody | null>(() => {
    let source: BulkMembershipBody['source'];
    if (mode === 'all') source = { type: 'all' };
    else if (mode === 'users') {
      if (!selectedIds.length) return null;
      source = { type: 'users', userIds: selectedIds };
    } else if (mode === 'platformRole') source = { type: 'platformRole', role: sourceRole };
    else {
      if (!sourceServerId) return null;
      source = { type: 'server', serverId: sourceServerId, roleId: sourceRoleId || null };
    }
    if (action !== 'remove' && !targetServerId) return null;
    if (action !== 'add' && !fromServerId) return null;
    return {
      action,
      source,
      ...(action !== 'remove' ? { targetServerId, targetRoleId: targetRoleId || null } : {}),
      ...(action !== 'add' ? { fromServerId } : {}),
      includeDisabled,
    };
  }, [
    action,
    mode,
    selectedIds,
    sourceRole,
    sourceServerId,
    sourceRoleId,
    targetServerId,
    targetRoleId,
    fromServerId,
    includeDisabled,
  ]);

  React.useEffect(() => setPreview(null), [body]);

  const previewMut = useMutation({
    mutationFn: () => adminUserManageApi.bulkPreview(body!),
    onSuccess: setPreview,
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const applyMut = useMutation({
    mutationFn: () => adminUserManageApi.bulkApply(body!),
    onSuccess: (r) => {
      toast.success(fill(t.umBulkDone, r));
      setPreview(null);
      void qc.invalidateQueries({ queryKey: usersManageKey });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const sourceServer = servers.find((s) => s.id === sourceServerId);
  const targetServer = servers.find((s) => s.id === targetServerId);
  const radio = (value: SourceMode, label: string, disabled?: boolean) => (
    <label className={cn('flex items-center gap-2 text-sm text-fg', disabled && 'opacity-50')}>
      <input type="radio" name="um-source" checked={mode === value} disabled={disabled} onChange={() => setMode(value)} />
      {label}
    </label>
  );

  return (
    <GlassPanel className="space-y-5 p-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-fg">{t.umBulkTitle}</h2>
        <p className="text-[13px] text-fg-subtle">{t.umBulkLead}</p>
      </div>

      <div className="space-y-1.5">
        <Label>{t.umBulkAction}</Label>
        <select
          className={`${selectClass} max-w-md`}
          value={action}
          onChange={(e) => setAction(e.target.value as BulkMembershipBody['action'])}
        >
          <option value="add">{t.umBulkActionAdd}</option>
          <option value="move">{t.umBulkActionMove}</option>
          <option value="remove">{t.umBulkActionRemove}</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label>{t.umBulkSource}</Label>
        <div className="space-y-2 rounded-lg border border-white/8 bg-white/[0.02] p-3">
          {radio('all', t.umBulkSourceAll)}
          {radio('users', fill(t.umBulkSourceUsers, { count: selectedIds.length }), selectedIds.length === 0)}
          {selectedIds.length === 0 ? (
            <p className="pl-6 text-[11px] text-fg-muted">{t.umBulkSourceUsersEmpty}</p>
          ) : null}
          {radio('platformRole', t.umBulkSourceRole)}
          {mode === 'platformRole' ? (
            <select
              className={`${selectClass} ml-6 max-w-xs`}
              value={sourceRole}
              onChange={(e) => setSourceRole(e.target.value as Role)}
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r, t)}
                </option>
              ))}
            </select>
          ) : null}
          {radio('server', t.umBulkSourceServer)}
          {mode === 'server' ? (
            <div className="grid gap-2 pl-6 sm:grid-cols-2">
              <select
                className={selectClass}
                value={sourceServerId}
                onChange={(e) => {
                  setSourceServerId(e.target.value);
                  setSourceRoleId('');
                }}
              >
                <option value="">{t.umPickServer}</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ServerRoleSelect
                server={sourceServer}
                value={sourceRoleId}
                onChange={setSourceRoleId}
                emptyLabel={t.umBulkSourceServerRoleAny}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {action !== 'add' ? (
          <div className="space-y-1.5">
            <Label>{t.umBulkFrom}</Label>
            <select className={selectClass} value={fromServerId} onChange={(e) => setFromServerId(e.target.value)}>
              <option value="">{t.umPickServer}</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {action !== 'remove' ? (
          <>
            <div className="space-y-1.5">
              <Label>{t.umBulkTarget}</Label>
              <select
                className={selectClass}
                value={targetServerId}
                onChange={(e) => {
                  setTargetServerId(e.target.value);
                  setTargetRoleId('');
                }}
              >
                <option value="">{t.umPickServer}</option>
                {servers
                  .filter((s) => action !== 'move' || s.id !== fromServerId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.umBulkTargetRole}</Label>
              <ServerRoleSelect
                server={targetServer}
                value={targetRoleId}
                onChange={setTargetRoleId}
                emptyLabel={t.umBulkTargetRoleKeep}
              />
            </div>
          </>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-xs text-fg-subtle">
        <input type="checkbox" checked={includeDisabled} onChange={(e) => setIncludeDisabled(e.target.checked)} />
        {t.umBulkIncludeDisabled}
      </label>

      {preview ? (
        <p className="rounded-md border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-2 text-sm text-fg">
          {action === 'remove'
            ? fill(t.umBulkPreviewResultRemove, { matched: preview.matched })
            : fill(t.umBulkPreviewResult, { matched: preview.matched, already: preview.alreadyInTarget })}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!body || previewMut.isPending}
          onClick={() => previewMut.mutate()}
        >
          {t.umBulkPreview}
        </Button>
        <Button
          type="button"
          disabled={!body || !preview || preview.matched === 0 || applyMut.isPending}
          onClick={() => {
            if (preview && window.confirm(fill(t.umBulkConfirm, { matched: preview.matched }))) applyMut.mutate();
          }}
        >
          {applyMut.isPending ? '…' : t.umBulkApply}
        </Button>
      </div>
      {action !== 'add' ? <p className="text-[11px] text-fg-muted">{t.umBulkHomeNote}</p> : null}
    </GlassPanel>
  );
}

function AutoJoinPanel({ servers }: { servers: ManagedServer[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => adminUserManageApi.setAutoJoin(id, enabled),
    onSuccess: (_, { enabled }) => {
      toast.success(enabled ? t.umAutoJoinOn : t.umAutoJoinOff);
      void qc.invalidateQueries({ queryKey: managedServersKey });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  return (
    <GlassPanel className="space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-fg">{t.umAutoJoinTitle}</h2>
        <p className="text-[13px] text-fg-subtle">{t.umAutoJoinLead}</p>
      </div>
      <ul className="divide-y divide-white/8 rounded-lg border border-white/8">
        {servers.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-fg">{s.name}</div>
              <div className="text-xs text-muted-fg">{fill(t.umAutoJoinMembers, { count: s.memberCount })}</div>
            </div>
            <Switch
              checked={s.autoJoinNewUsers}
              disabled={mut.isPending}
              onCheckedChange={(enabled) => mut.mutate({ id: s.id, enabled })}
            />
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
