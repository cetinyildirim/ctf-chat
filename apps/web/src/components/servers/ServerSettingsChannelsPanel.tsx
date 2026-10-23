'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ChannelType, type Channel } from '@sydt/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { channelsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { toast } from 'sonner';
import { useI18n } from '@/components/providers/LocaleProvider';
import { ADMIN_CHANNEL_TYPE_OPTIONS, channelTypeLabel } from '@/lib/admin/channel-type-options';
import { channelCategoryBadgeDataUrl } from '@/lib/branding/logo-badges';
import { swapChannelPositions } from '@/lib/admin/reorder';

export function ServerSettingsChannelsPanel({ serverId }: { serverId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.channelsSettings(serverId),
    queryFn: () => channelsApi.list(serverId, { includeEmpty: true }),
  });

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

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.channels(serverId) });
    void qc.invalidateQueries({ queryKey: queryKeys.channelsSettings(serverId) });
  };

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
      toast.error(unwrapApiError(err).message);
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
      toast.error(unwrapApiError(err).message);
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
        serverId,
        isPrivate: false,
        iconKey: null,
      });
      setChName('');
      setChTopic('');
      toast.success(t.channelCreated);
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
      await channelsApi.uploadLogo(id, file);
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
      await channelsApi.clearLogo(id);
      toast.success(t.logoRemoved);
      invalidate();
    } catch (err) {
      toast.error(unwrapApiError(err).message);
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
      toast.error(unwrapApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <p className="text-sm text-fg-subtle">{t.adminReorderHint}</p>
      <form onSubmit={onCreate} className="grid gap-3 rounded-lg border border-white/8 bg-white/[0.02] p-4 sm:grid-cols-2">
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

      <div className="space-y-6">
        {channelGroups.map((section) => (
          <div key={section.key}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-fg">{section.title}</h3>
            <ul className="divide-y divide-white/5 rounded-lg border border-white/8">
              {section.list.map((ch, idx) => {
                const catLabel = ch.categoryId ? categoryMeta.get(ch.categoryId) ?? t.noCategory : t.uncategorized;
                const fallback = channelCategoryBadgeDataUrl(catLabel, ch.categoryId ?? null);
                return (
                  <li key={ch.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={busy || idx === 0} onClick={() => void moveChannel(section.list, ch.id, -1)}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={busy || idx >= section.list.length - 1} onClick={() => void moveChannel(section.list, ch.id, 1)}>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ch.logoUrl ?? fallback} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {chEditingId === ch.id ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input value={chEditName} onChange={(e) => setChEditName(e.target.value)} />
                          <Input value={chEditTopic} onChange={(e) => setChEditTopic(e.target.value)} placeholder={t.channelTopicLabel} />
                          <select className="flex h-10 rounded-md border border-white/10 bg-bg-deep px-2 text-sm text-fg sm:col-span-2" value={chEditType} onChange={(e) => setChEditType(e.target.value as ChannelType)}>
                            {ADMIN_CHANNEL_TYPE_OPTIONS.map((ty) => (
                              <option key={ty} value={ty}>{channelTypeLabel(ty, t)}</option>
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
                    <input type="file" accept="image/*" className="hidden" id={`srv-ch-${ch.id}`} onChange={(e) => { void onLogo(ch.id, e.target.files?.[0] ?? null); e.target.value = ''; }} />
                    <Button type="button" variant="outline" size="sm" asChild disabled={busy}>
                      <label htmlFor={`srv-ch-${ch.id}`} className="cursor-pointer">{t.uploadLogo}</label>
                    </Button>
                    {ch.logoUrl ? <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void onClear(ch.id)}>{t.removeLogo}</Button> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {!isLoading && channelGroups.length === 0 ? (
          <p className="text-center text-sm text-fg-subtle">{t.serverChannelsEmpty}</p>
        ) : null}
      </div>
    </div>
  );
}
