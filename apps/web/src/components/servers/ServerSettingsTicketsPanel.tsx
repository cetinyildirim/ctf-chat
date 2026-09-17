'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CompetitionStatus, TicketPolicy } from '@sydt/shared';
import { ticketAdminApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/components/providers/LocaleProvider';
import { competitionStatusLabel, ticketCategoryLabel } from '@/i18n/ticket-labels';

/** Local datetime value for `<input type="datetime-local">`. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/**
 * Ticket configuration for one competition: categories (§8), tags (§24) and the
 * competition lifecycle / ticket policy (§27-28).
 */
export function ServerSettingsTicketsPanel({ serverId }: { serverId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.ticketAdminCategories(serverId),
    queryFn: () => ticketAdminApi.categories(serverId),
  });
  const { data: tags = [] } = useQuery({
    queryKey: queryKeys.ticketAdminTags(serverId),
    queryFn: () => ticketAdminApi.tags(serverId),
  });
  const { data: competition } = useQuery({
    queryKey: queryKeys.ticketCompetition(serverId),
    queryFn: () => ticketAdminApi.competition(serverId),
  });

  const [categoryName, setCategoryName] = React.useState('');
  const [requiresChallenge, setRequiresChallenge] = React.useState(false);
  const [tagName, setTagName] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');

  const refreshCategories = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.ticketAdminCategories(serverId) });
    void qc.invalidateQueries({ queryKey: queryKeys.ticketMeta(serverId) });
  };
  const refreshTags = () =>
    void qc.invalidateQueries({ queryKey: queryKeys.ticketAdminTags(serverId) });

  const onError = (err: unknown) => toast.error(unwrapApiError(err).message);

  const addCategory = useMutation({
    mutationFn: () =>
      ticketAdminApi.createCategory(serverId, { name: categoryName.trim(), requiresChallenge }),
    onSuccess: () => {
      setCategoryName('');
      setRequiresChallenge(false);
      refreshCategories();
    },
    onError,
  });

  const patchCategory = useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      isActive?: boolean;
      name?: string;
      requiresChallenge?: boolean;
    }) => ticketAdminApi.patchCategory(serverId, id, patch),
    onSuccess: () => {
      setEditingId(null);
      refreshCategories();
    },
    onError,
  });

  const removeCategory = useMutation({
    mutationFn: (id: string) => ticketAdminApi.deleteCategory(serverId, id),
    onSuccess: (result) => {
      if (result.deactivated) toast.info(t.ticketAdminDeactivated);
      refreshCategories();
    },
    onError,
  });

  const addTag = useMutation({
    mutationFn: () => ticketAdminApi.createTag(serverId, { name: tagName.trim() }),
    onSuccess: () => {
      setTagName('');
      refreshTags();
    },
    onError,
  });

  const removeTag = useMutation({
    mutationFn: (id: string) => ticketAdminApi.deleteTag(serverId, id),
    onSuccess: refreshTags,
    onError,
  });

  const patchCompetition = useMutation({
    mutationFn: (input: Parameters<typeof ticketAdminApi.patchCompetition>[1]) =>
      ticketAdminApi.patchCompetition(serverId, input),
    onSuccess: () => {
      toast.success(t.ticketAdminSaved);
      void qc.invalidateQueries({ queryKey: queryKeys.ticketCompetition(serverId) });
      void qc.invalidateQueries({ queryKey: queryKeys.ticketMeta(serverId) });
    },
    onError,
  });

  const policyLabel: Record<string, string> = {
    OPEN: t.ticketAdminPolicyOpen,
    ORGANIZER_ONLY: t.ticketAdminPolicyOrganizer,
    CLOSED: t.ticketAdminPolicyClosed,
  };

  const commitRename = (id: string, currentName: string) => {
    const next = editName.trim();
    if (next.length < 2 || next === currentName) {
      setEditingId(null);
      return;
    }
    patchCategory.mutate({ id, name: next });
  };

  return (
    <div className="space-y-6">
      <GlassPanel className="space-y-3 p-4">
        <h3 className="text-sm font-semibold text-fg">{t.ticketAdminCompetition}</h3>
        {competition ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="text-muted-fg">{t.ticketAdminStartsAt}</span>
              <Input
                type="datetime-local"
                defaultValue={toLocalInput(competition.startsAt)}
                onBlur={(e) =>
                  patchCompetition.mutate({ startsAt: fromLocalInput(e.target.value) })
                }
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-fg">{t.ticketAdminEndsAt}</span>
              <Input
                type="datetime-local"
                defaultValue={toLocalInput(competition.endsAt)}
                onBlur={(e) => patchCompetition.mutate({ endsAt: fromLocalInput(e.target.value) })}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-fg">{t.ticketAdminTimezone}</span>
              <Input
                defaultValue={competition.timezone}
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value !== competition.timezone &&
                  patchCompetition.mutate({ timezone: e.target.value.trim() })
                }
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-fg">{t.ticketAdminCompetitionStatus}</span>
              <select
                value={competition.status}
                onChange={(e) => patchCompetition.mutate({ status: e.target.value as never })}
                className="w-full rounded-md border border-white/10 bg-bg-elev px-2 py-2 text-sm"
              >
                {Object.values(CompetitionStatus).map((value) => (
                  <option key={value} value={value}>
                    {competitionStatusLabel(t, value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs sm:col-span-2">
              <span className="text-muted-fg">{t.ticketAdminTicketPolicy}</span>
              <select
                value={competition.ticketPolicy}
                onChange={(e) => patchCompetition.mutate({ ticketPolicy: e.target.value as never })}
                className="w-full rounded-md border border-white/10 bg-bg-elev px-2 py-2 text-sm"
              >
                {Object.values(TicketPolicy).map((value) => (
                  <option key={value} value={value}>
                    {policyLabel[value] ?? value}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <Switch
                checked={!!competition.archivedAt}
                onCheckedChange={(checked) => patchCompetition.mutate({ archived: checked })}
              />
              <span className="text-muted-fg">{t.ticketAdminArchived}</span>
            </label>
          </div>
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-fg" />
        )}
      </GlassPanel>

      <GlassPanel className="space-y-3 p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-fg">{t.ticketAdminCategories}</h3>
          <p className="text-[11px] text-muted-fg">{t.ticketAdminCategoryHint}</p>
        </div>
        <ul className="space-y-1.5">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-white/8 px-3 py-2 text-sm"
            >
              {editingId === category.id ? (
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(category.id, category.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(category.id, category.name);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="h-8 max-w-xs"
                />
              ) : (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-fg hover:text-accent-cyan"
                  title={t.ticketAdminCategoryRename}
                  onClick={() => {
                    setEditingId(category.id);
                    setEditName(category.name);
                  }}
                >
                  {ticketCategoryLabel(t, category)}
                </button>
              )}
              <span className="font-mono text-[10px] text-muted-fg">{category.key}</span>
              {category.requiresChallenge ? (
                <span className="rounded border border-accent-amber/30 px-1 text-[10px] text-accent-amber">
                  {t.ticketAdminRequiresChallenge}
                </span>
              ) : null}
              <span className="text-[10px] text-muted-fg">
                {category.ticketCount} {t.ticketAdminInUse}
              </span>
              <Switch
                checked={category.isActive}
                onCheckedChange={(checked) =>
                  patchCategory.mutate({ id: category.id, isActive: checked })
                }
              />
              <button
                type="button"
                aria-label={`delete ${category.name}`}
                className="text-muted-fg hover:text-accent-rose"
                onClick={() => removeCategory.mutate(category.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder={t.ticketAdminCategoryName}
            className="max-w-xs"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-fg">
            <Switch checked={requiresChallenge} onCheckedChange={setRequiresChallenge} />
            {t.ticketAdminRequiresChallenge}
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={categoryName.trim().length < 2 || addCategory.isPending}
            onClick={() => addCategory.mutate()}
          >
            <Plus className="h-3.5 w-3.5" /> {t.ticketAdminAdd}
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="space-y-3 p-4">
        <h3 className="text-sm font-semibold text-fg">{t.ticketAdminTags}</h3>
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase"
              style={{ borderColor: `${tag.color}66`, color: tag.color }}
            >
              {tag.name}
              <span className="text-[9px] text-muted-fg">{tag.ticketCount}</span>
              <button
                type="button"
                aria-label={`delete ${tag.name}`}
                className="text-muted-fg hover:text-accent-rose"
                onClick={() => removeTag.mutate(tag.id)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Input
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder={t.ticketAdminTagName}
            className="max-w-xs"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={tagName.trim().length < 2 || addTag.isPending}
            onClick={() => addTag.mutate()}
          >
            <Plus className="h-3.5 w-3.5" /> {t.ticketAdminAdd}
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
