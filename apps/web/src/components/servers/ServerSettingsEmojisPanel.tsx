'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/providers/LocaleProvider';
import { toast } from 'sonner';

type LocalEmoji = { id: string; name: string; url: string };

function storageKey(serverId: string) {
  return `sydt-server-emojis-${serverId}`;
}

export function ServerSettingsEmojisPanel({ serverId }: { serverId: string }) {
  const { t } = useI18n();
  const [name, setName] = React.useState('');
  const [preview, setPreview] = React.useState<string | null>(null);
  const [list, setList] = React.useState<LocalEmoji[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(serverId));
      if (raw) setList(JSON.parse(raw) as LocalEmoji[]);
    } catch {
      /* ignore */
    }
  }, [serverId]);

  const persist = (next: LocalEmoji[]) => {
    setList(next);
    localStorage.setItem(storageKey(serverId), JSON.stringify(next));
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error(t.serverEmojiSizeError);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = () => {
    const trimmed = name.trim().toLowerCase();
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      toast.error(t.serverEmojiNameError);
      return;
    }
    if (!preview) {
      toast.error(t.serverEmojiFileRequired);
      return;
    }
    persist([...list, { id: `${trimmed}-${Date.now()}`, name: trimmed, url: preview }]);
    setName('');
    setPreview(null);
    toast.success(t.serverEmojiSaved);
  };

  const remove = (id: string) => {
    persist(list.filter((e) => e.id !== id));
    toast.success(t.serverEmojiRemoved);
  };

  return (
    <div className="w-full space-y-6">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
        {t.serverEmojiBanner}
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-white/10 bg-[#111214]">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-contain" />
            ) : null}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          <button type="button" className="mt-2 text-xs text-accent-cyan hover:underline" onClick={() => fileRef.current?.click()}>
            {t.profileAvatarUpload}
          </button>
          <p className="text-[10px] text-muted-fg">{t.serverEmojiMax}</p>
        </div>
        <div className="min-w-[12rem] flex-1 space-y-3">
          <div>
            <Label className="text-[10px] uppercase text-muted-fg">{t.serverEmojiNameLabel}</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="emoji_name" />
          </div>
          <Button type="button" onClick={save}>
            {t.save}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase text-muted-fg">
          {t.serverEmojiListTitle.replace('{{count}}', String(list.length))}
        </h3>
        {list.length === 0 ? (
          <p className="text-sm text-fg-subtle">{t.serverEmojiEmpty}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {list.map((e) => (
              <li key={e.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-3 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.url} alt="" className="mx-auto h-10 w-10 object-contain" />
                <p className="mt-1 font-mono text-xs text-fg">:{e.name}:</p>
                <button type="button" className="mt-1 text-[11px] text-accent-rose hover:underline" onClick={() => remove(e.id)}>
                  {t.catDelete}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
