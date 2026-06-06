'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { categoriesApi, channelsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { useI18n } from '@/components/providers/LocaleProvider';
import { categoryHeaderBadgeDataUrl } from '@/lib/branding/logo-badges';
import { swapCategoryPositions } from '@/lib/admin/reorder';

export function ServerSettingsCategoriesPanel({ serverId }: { serverId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.channels(serverId),
    queryFn: () => channelsApi.list(serverId),
  });

  const [catName, setCatName] = React.useState('');
  const [catStaff, setCatStaff] = React.useState(false);
  const [catEditingId, setCatEditingId] = React.useState<string | null>(null);
  const [catEditName, setCatEditName] = React.useState('');
  const [catEditStaff, setCatEditStaff] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.channelsAll });

  const sortedCategories = [...(data?.categories ?? [])].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name),
  );

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setBusy(true);
    try {
      await categoriesApi.create({ name: catName.trim(), staffOnly: catStaff, serverId });
      setCatName('');
      setCatStaff(false);
      toast.success(t.catCreated);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const saveCategoryEdit = async (id: string) => {
    if (!catEditName.trim()) return;
    setBusy(true);
    try {
      await categoriesApi.update(id, { name: catEditName.trim(), staffOnly: catEditStaff });
      toast.success(t.catUpdated);
      setCatEditingId(null);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message);
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
      toast.error(unwrapApiError(err).message);
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
      toast.error(unwrapApiError(err).message);
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
      toast.error(unwrapApiError(err).message);
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
      toast.error(unwrapApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-sm text-fg-subtle">{t.adminReorderHint}</p>
      <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3 rounded-lg border border-white/8 bg-white/[0.02] p-4">
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
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex shrink-0 flex-col gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={busy || idx === 0} onClick={() => void moveCategory(c.id, -1)}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={busy || idx >= sortedCategories.length - 1} onClick={() => void moveCategory(c.id, 1)}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.logoUrl ?? categoryHeaderBadgeDataUrl(c.name, c.id)} alt="" className="h-full w-full object-cover" />
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
                  {c.staffOnly ? <div className="text-[11px] uppercase text-amber-300/90">{t.staffOnlyCategory}</div> : null}
                </>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" id={`srv-cat-${c.id}`} onChange={(e) => { void onLogo(c.id, e.target.files?.[0] ?? null); e.target.value = ''; }} />
            {catEditingId !== c.id ? (
              <>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setCatEditingId(c.id); setCatEditName(c.name); setCatEditStaff(!!c.staffOnly); }}>
                  {t.catEdit}
                </Button>
                <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void deleteCategory(c.id)}>
                  {t.catDelete}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" size="sm" disabled={busy} onClick={() => void saveCategoryEdit(c.id)}>{t.teamSave}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setCatEditingId(null)}>{t.teamCancelEdit}</Button>
              </>
            )}
            <Button type="button" variant="outline" size="sm" asChild disabled={busy}>
              <label htmlFor={`srv-cat-${c.id}`} className="cursor-pointer">{t.uploadLogo}</label>
            </Button>
            {c.logoUrl ? (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void onClear(c.id)}>{t.removeLogo}</Button>
            ) : null}
          </li>
        ))}
        {!isLoading && sortedCategories.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-fg-subtle">{t.serverCategoriesEmpty}</li>
        ) : null}
      </ul>
    </div>
  );
}
