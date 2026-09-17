'use client';

import * as React from 'react';
import { Download, FileText, Upload } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServerRole } from '@sydt/shared';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/providers/LocaleProvider';
import {
  adminApi,
  serversApi,
  type CtfdChallengesPreview,
  type CtfdChallengesPreviewChannel,
  type CtfdImportStats,
  type CtfdTeamsImportCredential,
  type CtfdTeamsImportStats,
  type CtfdTeamsPreview,
  type CtfdTeamsPreviewMember,
  type CtfdTeamsPreviewTeam,
} from '@/lib/api/endpoints';
import { useImportSelection } from '@/lib/admin/use-import-selection';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function downloadCredentialsCsv(rows: CtfdTeamsImportCredential[], filename: string) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = ['team', 'username', 'email', 'password', 'role'];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [r.teamName, r.username, r.email, r.password, r.role].map(escape).join(','),
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function GroupCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
      className="h-3.5 w-3.5 shrink-0 rounded border-white/20 accent-accent-cyan"
    />
  );
}

function ImportSelectionToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-fg-subtle">
        {t.importSelectedCount
          .replace('{{selected}}', String(selectedCount))
          .replace('{{total}}', String(totalCount))}
      </span>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onSelectAll}>
        {t.importSelectAll}
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onDeselectAll}>
        {t.importDeselectAll}
      </Button>
    </div>
  );
}

function ImportPreviewActions({
  busy,
  applyBusy,
  selectedCount,
  hint,
  onApply,
  onCancel,
}: {
  busy: boolean;
  applyBusy: boolean;
  selectedCount: number;
  hint: string;
  onApply: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || selectedCount === 0} onClick={onApply}>
          {applyBusy ? '…' : t.importConfirmButton}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          {t.importCancelPreview}
        </Button>
      </div>
      {selectedCount === 0 ? (
        <p className="text-[11px] text-accent-amber">{t.importNoSelection}</p>
      ) : (
        <p className="text-[11px] text-fg-subtle">{hint}</p>
      )}
    </div>
  );
}

function FilePickerRow({
  file,
  busy,
  onSelect,
  onAction,
  actionLabel,
  actionDisabled,
}: {
  file: File | null;
  busy: boolean;
  onSelect: (file: File) => void;
  onAction: () => void;
  actionLabel: string;
  actionDisabled?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = '';
          if (picked) onSelect(picked);
        }}
      />
      <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
        {t.importSelectFile}
      </Button>
      {file ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
          <FileText className="h-3.5 w-3.5" />
          {file.name}
        </span>
      ) : (
        <span className="text-xs text-muted-fg">{t.importNoFileSelected}</span>
      )}
      <Button type="button" disabled={busy || !file || actionDisabled} onClick={onAction}>
        {busy ? '…' : actionLabel}
      </Button>
    </div>
  );
}

function buildImportRoleOptions(roles: ServerRole[], t: { importServerRoleMember: string; importServerRoleAdmin: string }) {
  const defaultRole = roles.find((r) => r.name === 'Default');
  const adminRole = roles.find((r) => r.name.toLowerCase() === 'admin');
  const options: Array<{ id: string; label: string }> = [];

  if (defaultRole) options.push({ id: defaultRole.id, label: t.importServerRoleMember });
  if (adminRole) options.push({ id: adminRole.id, label: t.importServerRoleAdmin });

  for (const role of roles) {
    if (role.id === defaultRole?.id || role.id === adminRole?.id) continue;
    options.push({ id: role.id, label: role.name });
  }

  return { options, defaultRoleId: defaultRole?.id ?? options[0]?.id ?? '' };
}

type ImportStatusDict = {
  importStatusTeamCreate: string;
  importStatusTeamReuse: string;
  importStatusCreate: string;
  importStatusCreateUsername: string;
  importStatusUpdateExisting: string;
  importStatusUpdateMember: string;
};

function teamStatusLabel(team: CtfdTeamsPreviewTeam, t: ImportStatusDict) {
  return team.teamStatus === 'create' ? t.importStatusTeamCreate : t.importStatusTeamReuse;
}

function memberStatusLabel(member: CtfdTeamsPreviewMember, t: ImportStatusDict) {
  const username = member.plannedUsername;
  switch (member.status) {
    case 'create':
      return t.importStatusCreate.replace('{{username}}', username);
    case 'create_username_suffix':
      return t.importStatusCreateUsername.replace('{{username}}', username);
    case 'update_existing':
      return t.importStatusUpdateExisting.replace('{{username}}', username);
    case 'update_server_member':
      return t.importStatusUpdateMember.replace('{{username}}', username);
    default:
      return '';
  }
}

function memberStatusClass(status: CtfdTeamsPreviewMember['status']) {
  switch (status) {
    case 'create':
      return 'text-accent-emerald';
    case 'create_username_suffix':
      return 'text-accent-amber';
    case 'update_existing':
      return 'text-accent-cyan';
    case 'update_server_member':
      return 'text-accent-violet';
    default:
      return 'text-fg-subtle';
  }
}

function ImportRoleSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (roleId: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-8 w-full max-w-[12rem] rounded-md border border-white/10 bg-bg-deep px-2 text-xs text-fg',
        'focus:border-accent-cyan/40 focus:outline-none focus:ring-1 focus:ring-accent-cyan/30',
        disabled && 'opacity-50',
      )}
    >
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function ChallengesPreviewTable({
  preview,
  selection,
}: {
  preview: CtfdChallengesPreview;
  selection: ReturnType<typeof useImportSelection>;
}) {
  const { t } = useI18n();
  const allChannelKeys = React.useMemo(
    () => preview.categories.flatMap((c) => c.channels.map((ch) => ch.key)),
    [preview],
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-fg-subtle">
        {t.importChallengesPreviewSummary
          .replace('{{categories}}', String(preview.totalCategories))
          .replace('{{channels}}', String(preview.totalChannels))}
      </p>
      <ImportSelectionToolbar
        selectedCount={selection.count}
        totalCount={allChannelKeys.length}
        onSelectAll={selection.selectAll}
        onDeselectAll={selection.deselectAll}
      />
      <div className="overflow-x-auto rounded-md border border-white/8">
        <table className="w-full min-w-[40rem] table-fixed text-left text-xs">
          <colgroup>
            <col className="w-10" />
            <col className="w-[42%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="border-b border-white/8 text-muted-fg">
            <tr>
              <th className="px-3 py-2" aria-label={t.importColSelect} />
              <th className="px-3 py-2">{t.importColChannel}</th>
              <th className="px-3 py-2">{t.importColValue}</th>
              <th className="px-3 py-2">{t.importColState}</th>
            </tr>
          </thead>
          <tbody>
            {preview.categories.map((category) => {
              const channelKeys = category.channels.map((ch) => ch.key);
              return (
                <React.Fragment key={category.key}>
                  <tr className="bg-white/[0.03]">
                    <td className="px-3 py-2">
                      <GroupCheckbox
                        checked={selection.isGroupChecked(channelKeys)}
                        indeterminate={selection.isGroupIndeterminate(channelKeys)}
                        onChange={(on) => selection.setGroup(channelKeys, on)}
                        ariaLabel={category.name}
                      />
                    </td>
                    <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-accent-cyan">
                      {category.name}
                    </td>
                  </tr>
                  {category.channels.map((channel) => (
                    <tr key={channel.key} className="border-t border-white/5">
                      <td className="px-3 py-2">
                        <GroupCheckbox
                          checked={selection.selected.has(channel.key)}
                          onChange={(on) => selection.setGroup([channel.key], on)}
                          ariaLabel={channel.name}
                        />
                      </td>
                      <td className="truncate px-3 py-2">{channel.name}</td>
                      <td className="px-3 py-2">{channel.value || '—'}</td>
                      <td className="px-3 py-2 capitalize">{channel.state || '—'}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamsPreviewTable({
  preview,
  selection,
  roleOptions,
  memberRoles,
  onMemberRoleChange,
}: {
  preview: CtfdTeamsPreview;
  selection: ReturnType<typeof useImportSelection>;
  roleOptions: Array<{ id: string; label: string }>;
  memberRoles: Record<string, string>;
  onMemberRoleChange: (memberKey: string, roleId: string) => void;
}) {
  const { t } = useI18n();
  const allMemberKeys = React.useMemo(
    () => preview.teams.flatMap((team) => team.members.map((m) => m.key)),
    [preview],
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-fg-subtle">
        {t.importPreviewSummary
          .replace('{{teams}}', String(preview.totalTeams))
          .replace('{{users}}', String(preview.totalMembers))}
      </p>
      <ImportSelectionToolbar
        selectedCount={selection.count}
        totalCount={allMemberKeys.length}
        onSelectAll={selection.selectAll}
        onDeselectAll={selection.deselectAll}
      />
      <div className="overflow-x-auto rounded-md border border-white/8">
        <table className="w-full min-w-[52rem] table-fixed text-left text-xs">
          <colgroup>
            <col className="w-10" />
            <col className="w-[18%]" />
            <col className="w-[24%]" />
            <col className="w-[16%]" />
            <col className="w-[28%]" />
          </colgroup>
          <thead className="border-b border-white/8 text-muted-fg">
            <tr>
              <th className="px-3 py-2" aria-label={t.importColSelect} />
              <th className="px-3 py-2">{t.importCredColUser}</th>
              <th className="px-3 py-2">{t.importCredColEmail}</th>
              <th className="px-3 py-2">{t.importCredColRole}</th>
              <th className="px-3 py-2">{t.importColExplain}</th>
            </tr>
          </thead>
          <tbody>
            {preview.teams.map((team) => {
              const memberKeys = team.members.map((m) => m.key);
              return (
                <React.Fragment key={team.key}>
                  <tr className="bg-white/[0.03]">
                    <td className="px-3 py-2">
                      <GroupCheckbox
                        checked={selection.isGroupChecked(memberKeys)}
                        indeterminate={selection.isGroupIndeterminate(memberKeys)}
                        onChange={(on) => selection.setGroup(memberKeys, on)}
                        ariaLabel={team.name}
                      />
                    </td>
                    <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-accent-cyan">
                      {team.name}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-fg-subtle">{teamStatusLabel(team, t)}</td>
                  </tr>
                  {team.members.map((member) => (
                    <tr key={member.key} className="border-t border-white/5">
                      <td className="px-3 py-2">
                        <GroupCheckbox
                          checked={selection.selected.has(member.key)}
                          onChange={(on) => selection.setGroup([member.key], on)}
                          ariaLabel={member.displayName}
                        />
                      </td>
                      <td className="truncate px-3 py-2">
                        {member.displayName}
                        {member.isCaptain ? (
                          <span className="ml-1.5 text-[10px] uppercase text-accent-amber">
                            ({t.importRoleCaptain})
                          </span>
                        ) : null}
                      </td>
                      <td className="truncate px-3 py-2">{member.email}</td>
                      <td className="px-3 py-2">
                        <ImportRoleSelect
                          value={memberRoles[member.key] ?? roleOptions[0]?.id ?? ''}
                          options={roleOptions}
                          onChange={(roleId) => onMemberRoleChange(member.key, roleId)}
                          disabled={!selection.selected.has(member.key) || roleOptions.length === 0}
                        />
                      </td>
                      <td className={cn('px-3 py-2 text-[11px] leading-snug', memberStatusClass(member.status))}>
                        {memberStatusLabel(member, t)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CredentialsResult({
  credentials,
  stats,
  serverId,
  busy,
}: {
  credentials: CtfdTeamsImportCredential[];
  stats: CtfdTeamsImportStats;
  serverId: string;
  busy: boolean;
}) {
  const { t } = useI18n();

  if (credentials.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-accent-emerald/30 bg-accent-emerald/5 p-4">
      <h4 className="text-sm font-semibold text-accent-emerald">{t.importCredentialsTitle}</h4>
      <p className="text-xs text-fg-subtle">
        {t.importTeamsStats
          .replace('{{teams}}', String(stats.teamsCreated + stats.teamsReused))
          .replace('{{users}}', String(stats.usersCreated + stats.usersUpdated))
          .replace('{{skipped}}', String(stats.skipped))}
      </p>
      <div className="overflow-x-auto rounded-md border border-white/8">
        <table className="w-full min-w-[36rem] text-left text-xs">
          <thead className="bg-white/[0.03] text-muted-fg">
            <tr>
              <th className="px-3 py-2">{t.importCredColTeam}</th>
              <th className="px-3 py-2">{t.importCredColUser}</th>
              <th className="px-3 py-2">{t.importCredColEmail}</th>
              <th className="px-3 py-2">{t.importCredColPassword}</th>
              <th className="px-3 py-2">{t.importCredColRole}</th>
            </tr>
          </thead>
          <tbody>
            {credentials.map((row) => (
              <tr key={`${row.email}-${row.teamName}`} className="border-t border-white/5">
                <td className="px-3 py-2">{row.teamName}</td>
                <td className="px-3 py-2 font-mono">{row.username}</td>
                <td className="px-3 py-2">{row.email}</td>
                <td className="px-3 py-2 font-mono text-accent-amber">{row.password}</td>
                <td className="px-3 py-2 capitalize">
                  {row.role === 'captain' ? t.importRoleCaptain : t.importRoleMember}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() =>
          downloadCredentialsCsv(credentials, `sydt-teams-credentials-${serverId.slice(-6)}.csv`)
        }
      >
        <Download className="mr-2 h-4 w-4" />
        {t.importDownloadCredentials}
      </Button>
      <p className="text-[11px] text-accent-amber">{t.importCredentialsWarning}</p>
    </div>
  );
}

export function ServerSettingsImportPanel({ serverId }: { serverId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const [challengesFile, setChallengesFile] = React.useState<File | null>(null);
  const [challengesPreviewBusy, setChallengesPreviewBusy] = React.useState(false);
  const [challengesApplyBusy, setChallengesApplyBusy] = React.useState(false);
  const [challengesPreview, setChallengesPreview] = React.useState<CtfdChallengesPreview | null>(null);
  const [lastChallengesStats, setLastChallengesStats] = React.useState<CtfdImportStats | null>(null);

  const [teamsFile, setTeamsFile] = React.useState<File | null>(null);
  const [teamsPreviewBusy, setTeamsPreviewBusy] = React.useState(false);
  const [teamsApplyBusy, setTeamsApplyBusy] = React.useState(false);
  const [teamsPreview, setTeamsPreview] = React.useState<CtfdTeamsPreview | null>(null);
  const [memberRoles, setMemberRoles] = React.useState<Record<string, string>>({});
  const [credentials, setCredentials] = React.useState<CtfdTeamsImportCredential[]>([]);
  const [lastTeamsStats, setLastTeamsStats] = React.useState<CtfdTeamsImportStats | null>(null);

  const challengeChannelKeys = React.useMemo(
    () => challengesPreview?.categories.flatMap((c) => c.channels.map((ch) => ch.key)) ?? [],
    [challengesPreview],
  );
  const challengesSelection = useImportSelection(challengeChannelKeys);

  const teamMemberKeys = React.useMemo(
    () => teamsPreview?.teams.flatMap((team) => team.members.map((m) => m.key)) ?? [],
    [teamsPreview],
  );
  const teamsSelection = useImportSelection(teamMemberKeys);

  const { data: serverRoles = [] } = useQuery({
    queryKey: queryKeys.serverRoles(serverId),
    queryFn: () => serversApi.listRoles(serverId),
    enabled: !!teamsPreview,
  });

  const { options: roleOptions, defaultRoleId } = React.useMemo(
    () => buildImportRoleOptions(serverRoles, t),
    [serverRoles, t],
  );

  React.useEffect(() => {
    if (!teamsPreview || !defaultRoleId) return;
    const next: Record<string, string> = {};
    for (const team of teamsPreview.teams) {
      for (const member of team.members) {
        next[member.key] = defaultRoleId;
      }
    }
    setMemberRoles(next);
  }, [teamsPreview, defaultRoleId]);

  const onMemberRoleChange = React.useCallback((memberKey: string, roleId: string) => {
    setMemberRoles((prev) => ({ ...prev, [memberKey]: roleId }));
  }, []);

  const onChallengesPreview = async () => {
    if (!challengesFile) return;
    setChallengesPreviewBusy(true);
    setChallengesPreview(null);
    setLastChallengesStats(null);
    try {
      const data = await adminApi.previewCtfdChallenges(challengesFile);
      setChallengesPreview(data);
      toast.success(t.importPreviewReady);
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    } finally {
      setChallengesPreviewBusy(false);
    }
  };

  const onChallengesApply = async () => {
    if (!challengesPreview || challengesSelection.count === 0) return;

    const channels: CtfdChallengesPreviewChannel[] = [];
    for (const category of challengesPreview.categories) {
      for (const channel of category.channels) {
        if (challengesSelection.selected.has(channel.key)) channels.push(channel);
      }
    }
    if (channels.length === 0) return;

    setChallengesApplyBusy(true);
    try {
      const res = await adminApi.applyCtfdChallenges(serverId, channels);
      setLastChallengesStats(res.stats);
      setChallengesPreview(null);
      toast.success(t.importSuccess);
      void qc.invalidateQueries({ queryKey: queryKeys.channelsAll });
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    } finally {
      setChallengesApplyBusy(false);
    }
  };

  const onTeamsPreview = async () => {
    if (!teamsFile) return;
    setTeamsPreviewBusy(true);
    setTeamsPreview(null);
    setMemberRoles({});
    setCredentials([]);
    setLastTeamsStats(null);
    try {
      const data = await adminApi.previewCtfdTeams(teamsFile, serverId);
      setTeamsPreview(data);
      toast.success(t.importPreviewReady);
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    } finally {
      setTeamsPreviewBusy(false);
    }
  };

  const onTeamsApply = async () => {
    if (!teamsPreview || teamsSelection.count === 0) return;

    const members = teamsPreview.teams.flatMap((team) =>
      team.members
        .filter((m) => teamsSelection.selected.has(m.key))
        .map((m) => ({
          key: m.key,
          teamName: team.name,
          displayName: m.displayName,
          email: m.email,
          isCaptain: m.isCaptain,
          serverRoleId: memberRoles[m.key] || defaultRoleId || undefined,
        })),
    );
    if (members.length === 0) return;

    setTeamsApplyBusy(true);
    try {
      const res = await adminApi.applyCtfdTeams(serverId, members);
      setLastTeamsStats(res.stats);
      setCredentials(res.stats.credentials);
      setTeamsPreview(null);
      toast.success(t.importTeamsSuccess);
      void qc.invalidateQueries({ queryKey: queryKeys.servers });
      void qc.invalidateQueries({ queryKey: queryKeys.channelsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.adminTeams(serverId) });
      void qc.invalidateQueries({ queryKey: ['servers', serverId, 'members'] });
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    } finally {
      setTeamsApplyBusy(false);
    }
  };

  const challengesBusy = challengesPreviewBusy || challengesApplyBusy;
  const teamsBusy = teamsPreviewBusy || teamsApplyBusy;

  return (
    <div className="w-full space-y-8">
      <p className="text-sm text-fg-subtle">{t.importPageLead}</p>

      <section className="rounded-lg border border-white/8 bg-white/[0.02] p-6">
        <h3 className="text-sm font-semibold text-fg">{t.importSectionChallengesTitle}</h3>
        <p className="mt-1 text-sm text-fg-subtle">{t.importSectionChallengesDesc}</p>
        <div className="mt-4 flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-cyan/15 text-accent-cyan">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-sm text-fg-subtle">{t.importSectionChallengesHint}</p>
        </div>
        <FilePickerRow
          file={challengesFile}
          busy={challengesBusy}
          onSelect={(f) => {
            setChallengesFile(f);
            setChallengesPreview(null);
            setLastChallengesStats(null);
          }}
          onAction={() => void onChallengesPreview()}
          actionLabel={t.importPreviewButton}
        />

        {challengesPreview ? (
          <div className="mt-4 space-y-3 rounded-lg border border-accent-cyan/25 bg-accent-cyan/5 p-4">
            <ChallengesPreviewTable preview={challengesPreview} selection={challengesSelection} />
            <ImportPreviewActions
              busy={challengesBusy}
              applyBusy={challengesApplyBusy}
              selectedCount={challengesSelection.count}
              hint={t.importConfirmHintGeneric}
              onApply={() => void onChallengesApply()}
              onCancel={() => setChallengesPreview(null)}
            />
          </div>
        ) : null}

        {lastChallengesStats ? (
          <p className="mt-3 text-xs text-muted-fg">
            {t.importChallengesStats
              .replace('{{categories}}', String(lastChallengesStats.categoriesCreated))
              .replace('{{channels}}', String(lastChallengesStats.channelsCreated))}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-white/8 bg-white/[0.02] p-6">
        <h3 className="text-sm font-semibold text-fg">{t.importSectionTeamsTitle}</h3>
        <p className="mt-1 text-sm text-fg-subtle">{t.importSectionTeamsDesc}</p>
        <div className="mt-4 flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-violet/15 text-accent-violet">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-sm text-fg-subtle">{t.importSectionTeamsHint}</p>
        </div>
        <FilePickerRow
          file={teamsFile}
          busy={teamsBusy}
          onSelect={(f) => {
            setTeamsFile(f);
            setTeamsPreview(null);
            setMemberRoles({});
            setCredentials([]);
            setLastTeamsStats(null);
          }}
          onAction={() => void onTeamsPreview()}
          actionLabel={t.importPreviewButton}
        />

        {teamsPreview ? (
          <div className="mt-4 space-y-3 rounded-lg border border-accent-cyan/25 bg-accent-cyan/5 p-4">
            <TeamsPreviewTable
              preview={teamsPreview}
              selection={teamsSelection}
              roleOptions={roleOptions}
              memberRoles={memberRoles}
              onMemberRoleChange={onMemberRoleChange}
            />
            <ImportPreviewActions
              busy={teamsBusy}
              applyBusy={teamsApplyBusy}
              selectedCount={teamsSelection.count}
              hint={t.importConfirmHint}
              onApply={() => void onTeamsApply()}
              onCancel={() => setTeamsPreview(null)}
            />
          </div>
        ) : null}

        {credentials.length > 0 && lastTeamsStats ? (
          <div className="mt-4">
            <CredentialsResult
              credentials={credentials}
              stats={lastTeamsStats}
              serverId={serverId}
              busy={teamsBusy}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
