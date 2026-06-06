'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { PlatformPage } from '@sydt/shared';
import { GlassPanel } from '@/components/common/GlassPanel';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminPagesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';
import { toast } from 'sonner';

function slugFromTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return base || 'sayfa';
}

type PageDraft = {
  title: string;
  slug: string;
  content: string;
  published: boolean;
  slugTouched: boolean;
};

const emptyDraft = (): PageDraft => ({
  title: '',
  slug: '',
  content: '',
  published: true,
  slugTouched: false,
});

function draftFromPage(page: PlatformPage): PageDraft {
  return {
    title: page.title,
    slug: page.slug,
    content: page.content,
    published: page.published,
    slugTouched: true,
  };
};

function PageFields({
  draft,
  onChange,
  slugHintPrefix,
  t,
}: {
  draft: PageDraft;
  onChange: (patch: Partial<PageDraft>) => void;
  slugHintPrefix: string;
  t: ReturnType<typeof useI18n>['t'];
}) {
  React.useEffect(() => {
    if (!draft.slugTouched && draft.title.trim()) {
      onChange({ slug: slugFromTitle(draft.title) });
    }
  }, [draft.title, draft.slugTouched, onChange]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-fg">{t.adminPageTitleLabel}</Label>
          <Input
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder={t.adminPageTitlePlaceholder}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase text-muted-fg">{t.adminPageSlugLabel}</Label>
          <Input
            value={draft.slug}
            onChange={(e) => {
              onChange({
                slugTouched: true,
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
              });
            }}
            placeholder={slugFromTitle(draft.title) || 'sayfa-basligi'}
            className="font-mono text-sm"
          />
          <p className="text-[11px] text-muted-fg">
            {t.adminPageSlugHint} · {slugHintPrefix}/{draft.slug || slugFromTitle(draft.title) || '…'}
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase text-muted-fg">{t.adminPageContentLabel}</Label>
        <MarkdownEditor
          value={draft.content}
          onChange={(content) => onChange({ content })}
          rows={12}
          minHeight="280px"
          placeholder={t.adminPageContentPlaceholder}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-fg-subtle">
        <input
          type="checkbox"
          checked={draft.published}
          onChange={(e) => onChange({ published: e.target.checked })}
        />
        {t.adminPagePublished}
      </label>
    </>
  );
}

export function AdminPagesSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [createDraft, setCreateDraft] = React.useState<PageDraft>(emptyDraft);
  const [editPage, setEditPage] = React.useState<PlatformPage | null>(null);
  const [editDraft, setEditDraft] = React.useState<PageDraft>(emptyDraft);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: queryKeys.platformPages,
    queryFn: adminPagesApi.list,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.platformPages });

  const openEdit = (page: PlatformPage) => {
    setEditPage(page);
    setEditDraft(draftFromPage(page));
  };

  const closeEdit = () => {
    setEditPage(null);
    setEditDraft(emptyDraft());
  };

  const patchCreate = React.useCallback((patch: Partial<PageDraft>) => {
    setCreateDraft((d) => ({ ...d, ...patch }));
  }, []);

  const patchEdit = React.useCallback((patch: Partial<PageDraft>) => {
    setEditDraft((d) => ({ ...d, ...patch }));
  }, []);

  const createMut = useMutation({
    mutationFn: () =>
      adminPagesApi.create({
        title: createDraft.title.trim(),
        slug: createDraft.slug.trim() || undefined,
        content: createDraft.content,
        published: createDraft.published,
      }),
    onSuccess: () => {
      toast.success(t.adminPageCreated);
      setCreateDraft(emptyDraft());
      invalidate();
    },
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editPage) throw new Error('No page');
      return adminPagesApi.update(editPage.id, {
        title: editDraft.title.trim(),
        slug: editDraft.slug.trim() || undefined,
        content: editDraft.content,
        published: editDraft.published,
      });
    },
    onSuccess: (page) => {
      toast.success(t.adminPageUpdated);
      if (editPage && editPage.slug !== page.slug) {
        void qc.invalidateQueries({ queryKey: queryKeys.platformPage(editPage.slug) });
        void qc.invalidateQueries({ queryKey: queryKeys.platformPage(page.slug) });
      }
      closeEdit();
      invalidate();
    },
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminPagesApi.remove(id),
    onSuccess: () => {
      toast.success(t.adminPageDeleted);
      invalidate();
    },
    onError: (e) => toast.error(unwrapApiError(e).message),
  });

  return (
    <div className="admin-page w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-fg">{t.adminPagesHeading}</h1>
        <p className="mt-1 text-sm text-fg-subtle">{t.adminPagesLead}</p>
      </div>

      <GlassPanel className="space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Plus className="h-4 w-4 text-accent-cyan" />
          {t.adminPageCreateTitle}
        </h2>
        <PageFields draft={createDraft} onChange={patchCreate} slugHintPrefix="/p" t={t} />
        <Button
          type="button"
          disabled={!createDraft.title.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {createMut.isPending ? '…' : t.adminPageCreateSubmit}
        </Button>
      </GlassPanel>

      <GlassPanel className="divide-y divide-white/8 p-0">
        <div className="border-b border-white/8 px-4 py-3 text-sm font-medium text-fg">
          {t.adminPageListTitle} ({pages.length})
        </div>
        {isLoading ? <p className="p-4 text-sm text-muted-fg">{t.loading}</p> : null}
        {!isLoading && pages.length === 0 ? (
          <p className="p-6 text-sm text-fg-subtle">{t.adminPageListEmpty}</p>
        ) : null}
        {pages.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <FileText className="h-5 w-5 shrink-0 text-accent-cyan/80" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">{p.title}</p>
              <p className="font-mono text-xs text-muted-fg">/p/{p.slug}</p>
            </div>
            {!p.published ? (
              <span className="rounded border border-white/15 px-2 py-0.5 text-[10px] uppercase text-muted-fg">
                {t.adminPageDraft}
              </span>
            ) : null}
            <Link
              href={`/p/${p.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs text-accent-cyan hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t.adminPageOpen}
            </Link>
            <Button type="button" variant="outline" size="sm" onClick={() => openEdit(p)}>
              <Pencil className="h-3.5 w-3.5" />
              <span className="ml-1.5">{t.adminPageEdit}</span>
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteMut.isPending}
              onClick={() => {
                if (window.confirm(t.adminPageDeleteConfirm.replace('{{title}}', p.title))) {
                  deleteMut.mutate(p.id);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </GlassPanel>

      <Dialog open={!!editPage} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.adminPageEditTitle}</DialogTitle>
            <DialogDescription>{t.adminPageEditLead}</DialogDescription>
          </DialogHeader>
          {editPage ? (
            <div className="space-y-4">
              <PageFields draft={editDraft} onChange={patchEdit} slugHintPrefix="/p" t={t} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEdit}>
              {t.userCardCancel}
            </Button>
            <Button
              type="button"
              disabled={!editDraft.title.trim() || updateMut.isPending}
              onClick={() => updateMut.mutate()}
            >
              {updateMut.isPending ? '…' : t.adminPageSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
