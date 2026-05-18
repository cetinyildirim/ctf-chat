'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChannelType,
  Permission,
  type Channel,
} from '@sydt/shared';
import {
  LayoutDashboard,
  FolderTree,
  Hash,
  Upload,
  Settings2,
  ShieldAlert,
  ImageIcon,
  ChevronUp,
  ChevronDown,
  Trash2,
  Users,
  Copy,
  ScrollText,
  ClipboardList,
  Pencil,
  ShieldBan,
  Megaphone,
  Palette,
} from 'lucide-react';
import { ColorPalettePicker } from '@/components/common/ColorPalettePicker';
import { AdminModerationSection } from '@/components/admin/AdminModerationSection';
import { AdminBrandingSection } from '@/components/admin/AdminBrandingSection';
import { AdminCommsSection } from '@/components/admin/AdminCommsSection';
import { usePlatformBranding } from '@/components/providers/PlatformBrandingProvider';
import { ADMIN_CHANNEL_TYPE_OPTIONS, channelTypeLabel } from '@/lib/admin/channel-type-options';
import { AdminAuditSection } from '@/components/admin/AdminAuditSection';
import { AdminSurveysSection } from '@/components/admin/AdminSurveysSection';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuthStore } from '@/store/auth';
import { categoriesApi, channelsApi, adminApi, adminTeamsApi, type AdminRuntimeInfo } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { useI18n } from '@/components/providers/LocaleProvider';
import { channelCategoryBadgeDataUrl, categoryHeaderBadgeDataUrl } from '@/lib/branding/logo-badges';
import { cn } from '@/lib/utils';

const VALID_TABS = new Set([
  'overview',
  'categories',
  'channels',
  'import',
  'system',
  'teams',
  'audit',
  'surveys',
  'moderation',
  'branding',
  'comms',
]);

/** Temporary position used while swapping adjacent rows (avoid unique collisions). */
const REORDER_SAFE_TEMP = 9_887_766;

async function swapCategoryPositions(a: { id: string; position: number }, b: { id: string; position: number }) {
  await categoriesApi.update(a.id, { position: REORDER_SAFE_TEMP });
  await categoriesApi.update(b.id, { position: a.position });
  await categoriesApi.update(a.id, { position: b.position });
}

async function swapChannelPositions(a: { id: string; position: number }, b: { id: string; position: number }) {
  await channelsApi.update(a.id, { position: REORDER_SAFE_TEMP });
  await channelsApi.update(b.id, { position: a.position });
  await channelsApi.update(a.id, { position: b.position });
}

export function AdminDashboard() {
  const me = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const branding = usePlatformBranding();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab') ?? 'overview';
  const tab = VALID_TABS.has(rawTab) ? rawTab : 'overview';

  const allowed =
    !!me?.permissions.includes(Permission.ADMIN_DASHBOARD) ||
    !!me?.permissions.includes(Permission.CATEGORY_MANAGE) ||
    !!me?.permissions.includes(Permission.CHANNEL_CREATE) ||
    !!me?.permissions.includes(Permission.TEAM_MANAGE);

  const canDash = !!me?.permissions.includes(Permission.ADMIN_DASHBOARD);
  const canCat = !!me?.permissions.includes(Permission.CATEGORY_MANAGE);
  const canCh = !!me?.permissions.includes(Permission.CHANNEL_CREATE);
  const canImport = canDash;
  const canTeams = !!me?.permissions.includes(Permission.TEAM_MANAGE);
  const canAudit = !!me?.permissions.includes(Permission.AUDIT_LOG_VIEW);
  const canModerate =
    !!me?.permissions.includes(Permission.USER_BAN) ||
    !!me?.permissions.includes(Permission.USER_MUTE) ||
    !!me?.permissions.includes(Permission.USER_VIEW_ALL);

  const setTab = React.useCallback(
    (next: string) => {
      const u = new URLSearchParams(searchParams.toString());
      u.set('tab', next);
      router.replace(`/admin?${u.toString()}`);
    },
    [router, searchParams],
  );

  React.useEffect(() => {
    if (!allowed) return;
    if (tab === 'import' && !canImport) setTab('overview');
    else if (tab === 'system' && !canDash) setTab('overview');
    else if (tab === 'categories' && !canCat) setTab('overview');
    else if (tab === 'channels' && !canCh) setTab('overview');
    else if (tab === 'teams' && !canTeams) setTab('overview');
    else if (tab === 'audit' && !canAudit) setTab('overview');
    else if (tab === 'moderation' && !canModerate) setTab('overview');
    else if ((tab === 'branding' || tab === 'comms') && !canDash) setTab('overview');
  }, [allowed, tab, canImport, canCat, canCh, canDash, canTeams, canAudit, canModerate, setTab]);

  if (!allowed) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title={t.railAdmin} />
        <EmptyState icon={ShieldAlert} title={t.importNeedAdmin} description="" />
      </div>
    );
  }

  const nav = [
    { id: 'overview' as const, label: t.adminMenuOverview, icon: LayoutDashboard, show: true },
    { id: 'teams' as const, label: t.adminMenuTeams, icon: Users, show: canTeams },
    { id: 'categories' as const, label: t.adminMenuCategories, icon: FolderTree, show: canCat },
    { id: 'channels' as const, label: t.adminMenuChannels, icon: Hash, show: canCh },
    { id: 'import' as const, label: t.adminMenuImport, icon: Upload, show: canImport },
    { id: 'system' as const, label: t.adminMenuSystem, icon: Settings2, show: canDash },
    { id: 'branding' as const, label: t.adminMenuBranding, icon: Palette, show: canDash },
    { id: 'comms' as const, label: t.adminMenuComms, icon: Megaphone, show: canDash },
    { id: 'surveys' as const, label: t.adminMenuSurveys, icon: ClipboardList, show: canDash },
    { id: 'moderation' as const, label: t.adminMenuModeration, icon: ShieldBan, show: canModerate },
    { id: 'audit' as const, label: t.adminMenuAudit, icon: ScrollText, show: canAudit },
  ].filter((x) => x.show);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <TopBar title={branding.adminPanelTitle} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav className="shrink-0 border-b border-white/5 bg-bg-deep/30 px-2 py-3 lg:w-56 lg:border-b-0 lg:border-r lg:px-0 lg:py-4">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {nav.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    tab === id
                      ? 'bg-accent-cyan/12 text-fg shadow-glow-cyan/20 border border-accent-cyan/25'
                      : 'border border-transparent text-fg-subtle hover:bg-white/5 hover:text-fg',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === 'overview' ? (
            <OverviewSection canCat={canCat} canCh={canCh} canImport={canImport} onGoto={setTab} />
          ) : null}
          {tab === 'teams' && canTeams ? <TeamsSection /> : null}
          {tab === 'categories' && canCat ? <CategoriesSection /> : null}
          {tab === 'channels' && canCh ? <ChannelsSection /> : null}
          {tab === 'import' && canImport ? <ImportSection /> : null}
          {tab === 'system' && canDash ? <SystemSection /> : null}
          {tab === 'branding' && canDash ? <AdminBrandingSection /> : null}
          {tab === 'comms' && canDash ? <AdminCommsSection /> : null}
          {tab === 'surveys' && canDash ? <AdminSurveysSection /> : null}
          {tab === 'moderation' && canModerate ? <AdminModerationSection /> : null}
          {tab === 'audit' && canAudit ? <AdminAuditSection /> : null}
        </div>
      </div>
    </div>
  );
}

function OverviewSection({
  canCat,
  canCh,
  canImport,
  onGoto,
}: {
  canCat: boolean;
  canCh: boolean;
  canImport: boolean;
  onGoto: (t: string) => void;
}) {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.channels,
    queryFn: channelsApi.list,
  });
  const catCount = data?.categories.length ?? 0;
  const chCount = data?.channels.length ?? 0;

  return (
    <div className="admin-page w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-fg">{t.adminOverviewHeading}</h1>
        <p className="mt-1 text-sm text-fg-subtle">{t.adminOverviewLead}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => canCat && onGoto('categories')}
          className={cn(
            'rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.07]',
            !canCat && 'cursor-not-allowed opacity-50',
          )}
        >
          <div className="font-mono text-2xl font-bold text-accent-cyan">{isLoading ? '…' : catCount}</div>
          <div className="text-xs text-fg-subtle">{t.structureCategories}</div>
        </button>
        <button
          type="button"
          onClick={() => canCh && onGoto('channels')}
          className={cn(
            'rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.07]',
            !canCh && 'cursor-not-allowed opacity-50',
          )}
        >
          <div className="font-mono text-2xl font-bold text-accent-violet">{isLoading ? '…' : chCount}</div>
          <div className="text-xs text-fg-subtle">{t.structureChannels}</div>
        </button>
        <button
          type="button"
          onClick={() => canImport && onGoto('import')}
          className={cn(
            'rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.07]',
            !canImport && 'cursor-not-allowed opacity-50',
          )}
        >
          <div className="text-sm font-medium text-fg">{t.importTitle}</div>
          <div className="text-xs text-fg-subtle">{t.adminOverviewImportHint}</div>
        </button>
      </div>
      <GlassPanel className="p-5 text-sm text-fg-subtle">
        <p className="font-medium text-fg">{t.adminOverviewHintTitle}</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>{t.adminOverviewHintChannelsLogo}</li>
          <li>{t.adminOverviewHintCsv}</li>
        </ul>
      </GlassPanel>
    </div>
  );
}

function CategoriesSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: queryKeys.channels, queryFn: channelsApi.list });
  const [catName, setCatName] = React.useState('');
  const [catStaff, setCatStaff] = React.useState(false);
  const [catEditingId, setCatEditingId] = React.useState<string | null>(null);
  const [catEditName, setCatEditName] = React.useState('');
  const [catEditStaff, setCatEditStaff] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.channels });

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setBusy(true);
    try {
      await categoriesApi.create({ name: catName.trim(), staffOnly: catStaff });
      setCatName('');
      setCatStaff(false);
      toast.success(t.catCreated);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Error');
    } finally {
      setBusy(false);
    }
  };

  const onLogo = async (id: string, file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      await categoriesApi.uploadLogo(id, file);
      toast.success(t.logoUpdated);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Error');
    } finally {
      setBusy(false);
    }
  };

  const onClear = async (id: string) => {
    setBusy(true);
    try {
      await categoriesApi.clearLogo(id);
      toast.success(t.logoRemoved);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Error');
    } finally {
      setBusy(false);
    }
  };

  const categoriesRaw = data?.categories ?? [];

  const sortedCategories = [...categoriesRaw].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name),
  );

  const saveCategoryEdit = async (id: string) => {
    if (!catEditName.trim()) return;
    setBusy(true);
    try {
      await categoriesApi.update(id, { name: catEditName.trim(), staffOnly: catEditStaff });
      toast.success(t.catUpdated);
      setCatEditingId(null);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Error');
    } finally {
      setBusy(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm(t.catDeleteConfirm)) return;
    setBusy(true);
    try {
      await categoriesApi.remove(id);
      toast.success(t.catDeleted);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Error');
    } finally {
      setBusy(false);
    }
  };

  const moveCategory = async (catId: string, dir: -1 | 1) => {
    const i = sortedCategories.findIndex((c) => c.id === catId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sortedCategories.length) return;
    setBusy(true);
    try {
      await swapCategoryPositions(sortedCategories[i]!, sortedCategories[j]!);
      toast.success(t.reorderSaved);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? t.reorderError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page w-full space-y-6">
      <h1 className="text-xl font-semibold text-fg">{t.structureCategories}</h1>
      <p className="text-sm text-fg-subtle">{t.adminReorderHint}</p>
      <GlassPanel className="space-y-4 p-6">
        <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label>{t.categoryNameLabel}</Label>
            <Input value={catName} onChange={(e) => setCatName(e.target.value)} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-subtle">
            <input type="checkbox" checked={catStaff} onChange={(e) => setCatStaff(e.target.checked)} />
            {t.staffOnlyCategory}
          </label>
          <Button type="submit" disabled={busy || isLoading}>
            {t.addCategory}
          </Button>
        </form>
        <ul className="divide-y divide-white/5 rounded-lg border border-white/8">
          {sortedCategories.map((c, idx) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex shrink-0 flex-col gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={busy || idx === 0}
                  aria-label={t.reorderUp}
                  onClick={() => void moveCategory(c.id, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={busy || idx >= sortedCategories.length - 1}
                  aria-label={t.reorderDown}
                  onClick={() => void moveCategory(c.id, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={categoryHeaderBadgeDataUrl(c.name, c.id)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {catEditingId === c.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input value={catEditName} onChange={(e) => setCatEditName(e.target.value)} className="max-w-xs" />
                    <label className="flex items-center gap-1 text-xs text-fg-subtle">
                      <input type="checkbox" checked={catEditStaff} onChange={(e) => setCatEditStaff(e.target.checked)} />
                      {t.staffOnlyCategory}
                    </label>
                  </div>
                ) : (
                  <>
                    <div className="font-medium text-fg">{c.name}</div>
                    {c.staffOnly ? (
                      <div className="text-[11px] uppercase text-amber-300/90">{t.staffOnlyCategory}</div>
                    ) : null}
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id={`adm-cat-${c.id}`}
                onChange={(e) => {
                  void onLogo(c.id, e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
              {catEditingId !== c.id ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setCatEditingId(c.id);
                      setCatEditName(c.name);
                      setCatEditStaff(!!c.staffOnly);
                    }}
                  >
                    {t.catEdit}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => void deleteCategory(c.id)}
                  >
                    {t.catDelete}
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" size="sm" disabled={busy} onClick={() => void saveCategoryEdit(c.id)}>
                    {t.teamSave}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setCatEditingId(null)}>
                    {t.teamCancelEdit}
                  </Button>
                </>
              )}
              <Button type="button" variant="outline" size="sm" asChild disabled={busy}>
                <label htmlFor={`adm-cat-${c.id}`} className="cursor-pointer">
                  {t.uploadLogo}
                </label>
              </Button>
              {c.logoUrl ? (
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void onClear(c.id)}>
                  {t.removeLogo}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}

function ChannelsSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: queryKeys.channels, queryFn: channelsApi.list });
  const categoryMeta = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const c of data?.categories ?? []) m.set(c.id, c.name);
    return m;
  }, [data?.categories]);

  const [chName, setChName] = React.useState('');
  const [chTopic, setChTopic] = React.useState('');
  const [chType, setChType] = React.useState<ChannelType>(ChannelType.GLOBAL_CHAT);
  const [chCategoryId, setChCategoryId] = React.useState('');
  const [chEditingId, setChEditingId] = React.useState<string | null>(null);
  const [chEditName, setChEditName] = React.useState('');
  const [chEditTopic, setChEditTopic] = React.useState('');
  const [chEditType, setChEditType] = React.useState<ChannelType>(ChannelType.GLOBAL_CHAT);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!data?.categories.length) return;
    if (!chCategoryId || !data.categories.some((c) => c.id === chCategoryId)) {
      setChCategoryId(data.categories[0]!.id);
    }
  }, [data?.categories, chCategoryId]);

  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.channels });

  const saveChannelEdit = async (id: string) => {
    if (!chEditName.trim()) return;
    setBusy(true);
    try {
      await channelsApi.update(id, {
        name: chEditName.trim(),
        topic: chEditTopic.trim() || null,
        type: chEditType,
      });
      toast.success(t.chUpdated);
      setChEditingId(null);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Error');
    } finally {
      setBusy(false);
    }
  };

  const deleteChannel = async (id: string) => {
    if (!window.confirm(t.chDeleteConfirm)) return;
    setBusy(true);
    try {
      await channelsApi.remove(id);
      toast.success(t.chDeleted);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Error');
    } finally {
      setBusy(false);
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chName.trim()) return;
    setBusy(true);
    try {
      await channelsApi.create({
        name: chName.trim(),
        topic: chTopic.trim() || null,
        type: chType,
        categoryId: chCategoryId || null,
        isPrivate: false,
        iconKey: null,
      });
      setChName('');
      setChTopic('');
      toast.success(t.channelCreated);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Error');
    } finally {
      setBusy(false);
    }
  };

  const onLogo = async (id: string, file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      await channelsApi.uploadLogo(id, file);
      toast.success(t.logoUpdated);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Error');
    } finally {
      setBusy(false);
    }
  };

  const onClear = async (id: string) => {
    setBusy(true);
    try {
      await channelsApi.clearLogo(id);
      toast.success(t.logoRemoved);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Error');
    } finally {
      setBusy(false);
    }
  };

  const categories = data?.categories ?? [];
  const channels = data?.channels ?? [];

  const channelGroups = React.useMemo(() => {
    const buckets = new Map<string, Channel[]>();
    for (const ch of channels) {
      const key = ch.categoryId ?? '__uncat__';
      const cur = buckets.get(key);
      if (cur) cur.push(ch);
      else buckets.set(key, [ch]);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    }
    const sortedCats = [...categories].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    const sections: Array<{ key: string; title: string; list: Channel[] }> = [];
    for (const c of sortedCats) {
      const list = buckets.get(c.id);
      if (list?.length) sections.push({ key: c.id, title: c.name, list });
    }
    const unc = buckets.get('__uncat__');
    if (unc?.length) sections.push({ key: '__uncat__', title: t.uncategorized, list: unc });
    return sections;
  }, [categories, channels, t]);

  const moveChannel = async (ordered: Channel[], chId: string, dir: -1 | 1) => {
    const i = ordered.findIndex((c) => c.id === chId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    setBusy(true);
    try {
      await swapChannelPositions(ordered[i]!, ordered[j]!);
      toast.success(t.reorderSaved);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? t.reorderError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page w-full space-y-6">
      <h1 className="text-xl font-semibold text-fg">{t.structureChannels}</h1>
      <p className="text-sm text-fg-subtle">{t.adminReorderHint}</p>
      <GlassPanel className="space-y-4 p-6">
        <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t.channelNameLabel}</Label>
            <Input value={chName} onChange={(e) => setChName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.channelTypeLabel}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-white/10 bg-bg-deep px-3 text-sm text-fg"
              value={chType}
              onChange={(e) => setChType(e.target.value as ChannelType)}
            >
              {ADMIN_CHANNEL_TYPE_OPTIONS.map((ty) => (
                <option key={ty} value={ty}>
                  {channelTypeLabel(ty, t)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.channelCategoryLabel}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-white/10 bg-bg-deep px-3 text-sm text-fg"
              value={chCategoryId}
              onChange={(e) => setChCategoryId(e.target.value)}
            >
              <option value="">{t.noCategory}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t.channelTopicLabel}</Label>
            <Input value={chTopic} onChange={(e) => setChTopic(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy || isLoading}>
              {t.addChannel}
            </Button>
          </div>
        </form>
        <div className="space-y-8">
          {channelGroups.map((section) => (
            <div key={section.key}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                {section.title}
              </h3>
              <ul className="divide-y divide-white/5 rounded-lg border border-white/8">
                {section.list.map((ch, idx) => {
                  const catLabel = ch.categoryId ? categoryMeta.get(ch.categoryId) ?? t.noCategory : t.uncategorized;
                  const fallback = channelCategoryBadgeDataUrl(catLabel, ch.categoryId ?? null);
                  return (
                    <li key={ch.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="flex shrink-0 flex-col gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={busy || idx === 0}
                          aria-label={t.reorderUp}
                          onClick={() => void moveChannel(section.list, ch.id, -1)}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={busy || idx >= section.list.length - 1}
                          aria-label={t.reorderDown}
                          onClick={() => void moveChannel(section.list, ch.id, 1)}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                        {ch.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ch.logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fallback} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {chEditingId === ch.id ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input value={chEditName} onChange={(e) => setChEditName(e.target.value)} />
                            <Input value={chEditTopic} onChange={(e) => setChEditTopic(e.target.value)} placeholder={t.channelTopicLabel} />
                            <select
                              className="flex h-10 rounded-md border border-white/10 bg-bg-deep px-2 text-sm text-fg sm:col-span-2"
                              value={chEditType}
                              onChange={(e) => setChEditType(e.target.value as ChannelType)}
                            >
                              {ADMIN_CHANNEL_TYPE_OPTIONS.map((ty) => (
                                <option key={ty} value={ty}>
                                  {channelTypeLabel(ty, t)}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <>
                            <div className="font-medium text-fg">{ch.name}</div>
                            <div className="truncate text-[11px] text-muted-fg">{channelTypeLabel(ch.type as ChannelType, t)}</div>
                          </>
                        )}
                      </div>
                      {chEditingId !== ch.id ? (
                        <>
                          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setChEditingId(ch.id); setChEditName(ch.name); setChEditTopic(ch.topic ?? ''); setChEditType(ch.type as ChannelType); }}>{t.chEdit}</Button>
                          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void deleteChannel(ch.id)}>{t.chDelete}</Button>
                        </>
                      ) : (
                        <>
                          <Button type="button" size="sm" disabled={busy} onClick={() => void saveChannelEdit(ch.id)}>{t.teamSave}</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setChEditingId(null)}>{t.teamCancelEdit}</Button>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`adm-ch-${ch.id}`}
                        onChange={(e) => {
                          void onLogo(ch.id, e.target.files?.[0] ?? null);
                          e.target.value = '';
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" asChild disabled={busy}>
                        <label htmlFor={`adm-ch-${ch.id}`} className="cursor-pointer">
                          {t.uploadLogo}
                        </label>
                      </Button>
                      {ch.logoUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void onClear(ch.id)}
                        >
                          {t.removeLogo}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

function ImportSection() {
  const { t } = useI18n();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const onPick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const res = await adminApi.importCtfd(file);
      toast.success(t.importSuccess, { description: JSON.stringify(res.stats) });
    } catch (err) {
      toast.error(unwrapApiError(err).message ?? 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page w-full space-y-6">
      <h1 className="text-xl font-semibold text-fg">{t.importTitle}</h1>
      <GlassPanel className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-cyan/15 text-accent-cyan">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-sm text-fg-subtle">{t.importDescription}</p>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        <Button type="button" disabled={busy} onClick={onPick}>
          {busy ? '…' : t.importButton}
        </Button>
      </GlassPanel>
    </div>
  );
}

function TeamsSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = React.useState('');
  const [tagline, setTagline] = React.useState('');
  const [color, setColor] = React.useState('#22d3ee');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState({ name: '', tagline: '', color: '' });
  const [addMemberIdByTeam, setAddMemberIdByTeam] = React.useState<Record<string, string>>({});

  const { data: teams = [], isLoading } = useQuery({
    queryKey: queryKeys.adminTeams,
    queryFn: adminTeamsApi.list,
  });

  const invalidate = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: queryKeys.adminTeams });
  }, [qc]);

  const { data: members = [], isFetching: membersFetching } = useQuery({
    queryKey: ['admin', 'team-members', expandedId] as const,
    queryFn: () => adminTeamsApi.members(expandedId!),
    enabled: !!expandedId,
    staleTime: 15_000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      adminTeamsApi.create({
        name: name.trim(),
        ...(tagline.trim() ? { tagline: tagline.trim() } : {}),
        ...(/^#[0-9a-fA-F]{6}$/.test(color.trim()) ? { color: color.trim() } : {}),
      }),
    onSuccess: () => {
      setName('');
      setTagline('');
      toast.success(t.teamCreatedOk);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminTeamsApi.remove(id),
    onSuccess: (_, id) => {
      toast.success(t.teamDeletedOk);
      if (expandedId === id) setExpandedId(null);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const regenInviteMut = useMutation({
    mutationFn: (id: string) => adminTeamsApi.regenerateInvite(id),
    onSuccess: () => {
      toast.success(t.teamInviteUpdated);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const assignMut = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      adminTeamsApi.assignMember(teamId, userId),
    onSuccess: (_, { teamId }) => {
      setAddMemberIdByTeam((m) => ({ ...m, [teamId]: '' }));
      void qc.invalidateQueries({ queryKey: ['admin', 'team-members', teamId] });
      toast.success(t.teamMemberAddedOk);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const removeMut = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      adminTeamsApi.removeMember(teamId, userId),
    onSuccess: (_, { teamId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'team-members', teamId] });
      toast.success(t.teamMemberRemovedOk);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; tagline?: string | null; color?: string } }) =>
      adminTeamsApi.update(id, body),
    onSuccess: () => {
      toast.success(t.teamUpdatedOk);
      setEditingId(null);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const captainMut = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string | null }) =>
      adminTeamsApi.setCaptain(teamId, userId),
    onSuccess: (_, { teamId }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'team-members', teamId] });
      toast.success(t.teamCaptainSaved);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const copyInvite = async (inviteCode: string) => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      toast.success(t.teamInviteCopied);
    } catch {
      toast.error(t.teamInviteCopyFail);
    }
  };

  if (isLoading) return <div className="text-fg-subtle">{t.loading}</div>;

  return (
    <div className="admin-page w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-fg">{t.adminMenuTeams}</h1>
        <p className="mt-1 text-sm text-fg-subtle">{t.teamsAdminHint}</p>
      </div>

      <GlassPanel className="space-y-3 p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{t.teamFieldName}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.teamFieldTagline}</Label>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <ColorPalettePicker value={color} onChange={setColor} label={t.teamFieldColor} />
          </div>
        </div>
        <Button
          type="button"
          disabled={!name.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {createMut.isPending ? '…' : t.teamCreateSubmit}
        </Button>
      </GlassPanel>

      <GlassPanel className="divide-y divide-white/10 p-0">
        {!teams.length ? (
          <div className="p-6 text-sm text-fg-subtle">{t.teamsAdminEmpty}</div>
        ) : null}
        {teams.map((team) => {
          const expanded = expandedId === team.id;
          const editing = editingId === team.id;
          const addMid = addMemberIdByTeam[team.id] ?? '';
          const onCaptainChange = async (teamId: string, value: string) => {
            if (value === '__none') await captainMut.mutateAsync({ teamId, userId: null });
            else await captainMut.mutateAsync({ teamId, userId: value });
          };
          const busyCaptain = captainMut.isPending;

          return (
            <div key={team.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="mt-0.5 h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                <div className="min-w-0 flex-1 space-y-1">
                  {editing ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Input
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        placeholder={t.teamFieldName}
                      />
                      <Input
                        value={editDraft.tagline}
                        onChange={(e) => setEditDraft((d) => ({ ...d, tagline: e.target.value }))}
                        placeholder={t.teamFieldTagline}
                      />
                      <ColorPalettePicker value={editDraft.color} onChange={(c) => setEditDraft((d) => ({ ...d, color: c }))} label={t.teamFieldColor} />
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-fg">{team.name}</span>
                        <span className="text-xs text-muted-fg">
                          {team.memberCount} · {team.slug}
                        </span>
                      </div>
                      {team.tagline ? <p className="text-sm text-fg-subtle">{team.tagline}</p> : null}
                    </>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <code className="rounded border border-white/10 bg-black/25 px-2 py-1 font-mono text-[11px] text-fg">
                      {team.inviteCode}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 px-2"
                      onClick={() => void copyInvite(team.inviteCode)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t.teamInviteCopyBtn}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editing ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!editDraft.name.trim() || updateMut.isPending}
                        onClick={() =>
                          updateMut.mutate({
                            id: team.id,
                            body: {
                              name: editDraft.name.trim(),
                              tagline: editDraft.tagline.trim() || null,
                              ...( /^#[0-9a-fA-F]{6}$/.test(editDraft.color.trim())
                                ? { color: editDraft.color.trim() }
                                : {}),
                            },
                          })
                        }
                      >
                        {t.teamSave}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        {t.teamCancelEdit}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setEditingId(team.id);
                        setEditDraft({
                          name: team.name,
                          tagline: team.tagline ?? '',
                          color: team.color,
                        });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t.teamEdit}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedId((prev) => (prev === team.id ? null : team.id))}
                  >
                    {expanded ? '∧ ' : '> '}
                    {t.teamMembersTitle}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={regenInviteMut.isPending || busyCaptain || removeMut.isPending}
                    onClick={() => regenInviteMut.mutate(team.id)}
                  >
                    {t.teamInviteRegen}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    disabled={deleteMut.isPending || busyCaptain || removeMut.isPending}
                    onClick={() => {
                      if (window.confirm(t.teamConfirmDelete)) deleteMut.mutate(team.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> {t.teamDelete}
                  </Button>
                </div>
              </div>
              {expanded ? (
                <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
                  {membersFetching ? <div className="text-xs text-muted-fg">{t.loading}</div> : null}

                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder={t.teamAddMemberHint}
                      className="max-w-md"
                      value={addMid}
                      onChange={(e) =>
                        setAddMemberIdByTeam((m) => ({
                          ...m,
                          [team.id]: e.target.value,
                        }))
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!addMid.trim() || assignMut.isPending}
                      onClick={() => assignMut.mutate({ teamId: team.id, userId: addMid.trim() })}
                    >
                      {t.teamAddMemberSubmit}
                    </Button>
                  </div>

                  {!membersFetching ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-fg">{t.teamCaptainLabel}</span>
                      <select
                        className="flex h-9 max-w-[18rem] rounded-md border border-white/10 bg-bg-deep px-2 text-xs text-fg"
                        value={team.captainId ?? '__none'}
                        disabled={busyCaptain || members.length === 0}
                        onChange={(e) => void onCaptainChange(team.id, e.target.value)}
                      >
                        <option value="__none">{t.teamCaptainNone}</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {!membersFetching && members.length === 0 ? (
                      <p className="text-sm text-fg-subtle">{t.teamMembersEmpty}</p>
                    ) : null}
                    {members.map((u) => (
                          <div
                            key={u.id}
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-fg">{u.displayName}</div>
                              <div className="truncate font-mono text-[11px] text-muted-fg">{u.id}</div>
                              {team.captainId === u.id ? (
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-accent-cyan">
                                  {t.teamCaptainBadge}
                                </div>
                              ) : null}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={
                                removeMut.isPending ||
                                busyCaptain ||
                                (team.captainId !== null && u.id === team.captainId)
                              }
                              onClick={() =>
                                removeMut.mutate({ teamId: team.id, userId: u.id })
                              }
                            >
                              {t.teamRemoveMember}
                            </Button>
                          </div>
                        ))}
                  </div>
                  <p className="text-[11px] text-fg-muted">{t.teamCaptainHint}</p>
                </div>
              ) : null}
            </div>
          );
        })}
      </GlassPanel>
    </div>
  );
}

function SystemSection() {
  const { t } = useI18n();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'runtime'],
    queryFn: adminApi.runtime,
  });
  const { data: sys } = useQuery({
    queryKey: queryKeys.adminSystem,
    queryFn: adminApi.system,
  });

  if (isLoading) return <div className="text-fg-subtle">{t.loading}</div>;
  if (error || !data) return <div className="text-accent-rose">{t.adminSystemLoadError}</div>;

  return (
    <div className="admin-page w-full space-y-6">
      <h1 className="text-xl font-semibold text-fg">{t.adminSystemTitle}</h1>
      <p className="text-[15px] text-fg-subtle">{t.adminSystemLead}</p>

      {sys ? (
        <GlassPanel className="space-y-4 p-6">
          <h2 className="text-sm font-semibold text-fg">{t.adminSystemStats}</h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RuntimeRow label={t.adminStatUsers} value={String(sys.userCount)} />
            <RuntimeRow label={t.adminStatOnline} value={String(sys.onlineUsers)} />
            <RuntimeRow label={t.adminStatBanned} value={String(sys.bannedCount)} />
            <RuntimeRow label={t.adminStatTeams} value={String(sys.teamCount)} />
            <RuntimeRow label={t.adminStatChannels} value={String(sys.channelCount)} />
            <RuntimeRow label={t.adminStatMessages} value={String(sys.messageCount)} />
            <RuntimeRow label={t.adminStatAudit} value={String(sys.auditCount)} />
            <RuntimeRow label={t.adminStatSurveys} value={String(sys.activeSurveys)} />
          </dl>
        </GlassPanel>
      ) : null}

      <UploadMaxPanel initialMb={data.uploadMaxMb} />

      <GlassPanel className="space-y-3 p-6">
        <h2 className="text-sm font-semibold text-fg">{t.adminSystemSecurity}</h2>
        <ul className="list-inside list-disc space-y-2 text-[15px] text-fg-subtle">
          <li>{t.adminSecuritySession}</li>
          <li>{t.adminSecurityRbac}</li>
          <li>{t.adminSecurityAudit}</li>
          <li>{t.adminSecurityUpload}</li>
        </ul>
      </GlassPanel>

      <GlassPanel className="space-y-4 p-6">
        <h2 className="text-sm font-semibold text-fg">{t.adminSystemRuntime}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <RuntimeRow label="NODE_ENV" value={data.nodeEnv} />
          <RuntimeRow label={t.adminUploadDir} value={data.uploadDir} />
          <RuntimeRow label={t.adminUploadMax} value={`${data.uploadMaxMb} MB`} />
          <RuntimeRow label={t.adminAccessTtl} value={`${data.accessTokenTtlSec}s`} />
          <RuntimeRow label={t.adminRefreshTtl} value={`${data.refreshTokenTtlSec}s`} />
          <RuntimeRow label={t.adminCookieSecure} value={data.cookieSecure ? 'true' : 'false'} />
          <RuntimeRow label="CORS" value={data.corsOrigin} className="sm:col-span-2" />
        </dl>
      </GlassPanel>

      <GlassPanel className="space-y-3 p-6">
        <h2 className="text-sm font-semibold text-fg">{t.adminSystemOps}</h2>
        <ul className="list-inside list-disc space-y-2 text-sm text-fg-subtle">
          <li>{t.adminSystemOpsRealtime}</li>
          <li>{t.adminSystemOpsRbac}</li>
          <li>{t.adminSystemOpsFiles}</li>
        </ul>
      </GlassPanel>

      <GlassPanel className="space-y-3 border-dashed border-amber-400/30 p-6">
        <div className="flex items-center gap-2 text-amber-200/90">
          <ImageIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{t.adminSystemFuture}</span>
        </div>
        <p className="text-sm text-fg-subtle">{t.adminSystemFutureBody}</p>
      </GlassPanel>
    </div>
  );
}

function UploadMaxPanel({ initialMb }: { initialMb: number }) {
  const { t } = useI18n();
  const [mb, setMb] = React.useState(String(initialMb));
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setMb(String(initialMb));
  }, [initialMb]);

  return (
    <GlassPanel className="space-y-3 p-6">
      <h2 className="text-sm font-semibold text-fg">{t.adminUploadMaxLabel}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          type="number"
          min={1}
          max={500}
          className="h-10 w-28"
          value={mb}
          onChange={(e) => setMb(e.target.value)}
        />
        <Button
          type="button"
          disabled={busy}
          onClick={async () => {
            const n = parseInt(mb, 10);
            if (!Number.isFinite(n) || n < 1) return;
            setBusy(true);
            try {
              const next = await adminApi.setUploadMaxMb(n);
              setMb(String(next));
              toast.success(t.adminUploadMaxSaved);
            } catch (err) {
              toast.error(unwrapApiError(err).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.adminUploadMaxSave}
        </Button>
      </div>
    </GlassPanel>
  );
}

function RuntimeRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-md border border-white/8 bg-white/[0.03] px-3 py-2', className)}>
      <div className="text-[10px] uppercase tracking-wider text-muted-fg">{label}</div>
      <div className="mt-0.5 break-all font-mono text-xs text-fg">{value}</div>
    </div>
  );
}
