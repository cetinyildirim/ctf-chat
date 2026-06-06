'use client';

import * as React from 'react';
import { Send, Reply, X, Smile, Paperclip } from 'lucide-react';
import type { Message, PublicUser } from '@sydt/shared';
import { MAX_MESSAGE_LENGTH } from '@sydt/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { messagesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { getSocket } from '@/lib/socket/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MessageComposerHelp } from '@/components/chat/MessageComposerHelp';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';
import {
  MentionAutocomplete,
  getMentionRange,
  type MentionRange,
} from '@/components/chat/MentionAutocomplete';

interface Props {
  channelId: string;
  replyTo: Message | null;
  onClearReply: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

const EMOJIS = ['👍', '🔥', '🩸', '💀', '🛡️', '🎯', '✅', '❌', '🚀', '🧠', '⚡', '🕵️‍♂️'];

export function MessageComposer({ channelId, replyTo, onClearReply, disabled, disabledReason }: Props) {
  const { t } = useI18n();
  const [value, setValue] = React.useState('');
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [sending, setSending] = React.useState(false);
  const [mentionRange, setMentionRange] = React.useState<MentionRange | null>(null);
  const [mentionIndex, setMentionIndex] = React.useState(0);
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    ref.current?.focus();
  }, [channelId, replyTo?.id]);

  React.useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      getSocket().emit('typing:stop', { channelId });
    };
  }, [channelId]);

  const { data: mentionUsers = [] } = useQuery({
    queryKey: queryKeys.channelMentionSuggest(channelId, mentionRange?.query ?? ''),
    queryFn: () => messagesApi.mentionSuggest(channelId, mentionRange!.query),
    enabled: !!mentionRange && !!channelId,
    staleTime: 10_000,
  });

  const { data: platformConfig } = useQuery({
    queryKey: ['config'] as const,
    queryFn: async () => {
      const { data } = await api.get<{ uploadMaxMb: number }>('/config');
      return data;
    },
    staleTime: 60_000,
  });

  const remaining = MAX_MESSAGE_LENGTH - value.length;
  const tooLong = remaining < 0;
  const canSend = (value.trim().length > 0 || pendingFiles.length > 0) && !tooLong;

  const syncMention = (text: string, caret: number) => {
    const range = getMentionRange(text, caret);
    setMentionRange(range);
    if (range) setMentionIndex(0);
  };

  const insertMention = (user: PublicUser) => {
    const el = ref.current;
    if (!el || !mentionRange) return;
    const end = el.selectionStart ?? value.length;
    const next = `${value.slice(0, mentionRange.start)}@${user.username} ${value.slice(end)}`;
    setValue(next);
    setMentionRange(null);
    const pos = mentionRange.start + user.username.length + 2;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const addFiles = (list: FileList | File[]) => {
    const next = [...pendingFiles];
    const arr = Array.from(list);
    for (const f of arr) {
      if (next.length >= 10) break;
      next.push(f);
    }
    setPendingFiles(next);
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const send = async () => {
    const content = value.trim();
    const hasFiles = pendingFiles.length > 0;
    if ((!content && !hasFiles) || sending || disabled) return;
    if (tooLong) return;
    setSending(true);
    setMentionRange(null);
    try {
      if (hasFiles) {
        await messagesApi.sendWithFiles(channelId, {
          content: value,
          replyToId: replyTo?.id ?? null,
          files: pendingFiles,
        });
      } else {
        await messagesApi.send(channelId, content, replyTo?.id ?? null);
      }
      setValue('');
      setPendingFiles([]);
      onClearReply();
      getSocket().emit('typing:stop', { channelId });
    } catch (err) {
      toast.error(unwrapApiError(err).message);
    } finally {
      setSending(false);
      requestAnimationFrame(() => ref.current?.focus());
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionRange && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionUsers.length) % mentionUsers.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        const pick = mentionUsers[mentionIndex % mentionUsers.length];
        if (pick) insertMention(pick);
        return;
      }
      if (e.key === 'Escape') {
        setMentionRange(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    } else if (e.key === 'Escape' && replyTo) {
      onClearReply();
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    syncMention(next, e.target.selectionStart ?? next.length);
    const socket = getSocket();
    if (next.length > 0) {
      socket.emit('typing:start', { channelId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { channelId });
      }, 3500);
    } else {
      socket.emit('typing:stop', { channelId });
    }
  };

  const onSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    syncMention(el.value, el.selectionStart ?? el.value.length);
  };

  return (
    <div className="border-t border-white/5 bg-bg-deep/40 px-4 py-3 backdrop-blur-md">
      <MessageComposerHelp draft={value} />
      {replyTo ? (
        <div className="mb-2 flex items-center gap-2 rounded-md border-l-2 border-accent-violet/60 bg-accent-violet/5 px-2 py-1 text-xs text-fg-subtle">
          <Reply className="h-3 w-3 text-accent-violet" />
          <span className="truncate">
            {t.composerReplyingTo}{' '}
            <span className="font-medium text-fg">{replyTo.author.displayName}</span> ·{' '}
            <span className="truncate">{replyTo.content || t.composerEmptyReply}</span>
          </span>
          <button type="button" onClick={onClearReply} className="ml-auto text-muted-fg hover:text-fg">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}
      {pendingFiles.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {pendingFiles.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1 rounded-md border border-accent-cyan/30 bg-accent-cyan/10 px-2 py-0.5 text-[11px] text-fg"
            >
              <Paperclip className="h-3 w-3 shrink-0 text-accent-cyan" />
              <span className="max-w-[12rem] truncate font-mono">{f.name}</span>
              <button
                type="button"
                className="text-muted-fg hover:text-fg"
                onClick={() => removeFile(i)}
                aria-label="Remove file"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div
        className={cn(
          'relative flex items-end gap-2 rounded-xl border border-white/10 bg-bg-elev/60 p-2 transition-colors focus-within:border-accent-cyan/40 focus-within:shadow-glow-cyan/30',
          disabled && 'opacity-60',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (disabled) return;
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
      >
        {mentionRange ? (
          <MentionAutocomplete
            channelId={channelId}
            range={mentionRange}
            activeIndex={mentionIndex}
            onPick={insertMention}
          />
        ) : null}
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-md text-fg-subtle hover:bg-white/8 hover:text-fg disabled:pointer-events-none disabled:opacity-40"
          title="Attach files"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <Textarea
          ref={ref}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onClick={onSelect}
          onKeyUp={onSelect}
          placeholder={
            disabled
              ? disabledReason ?? t.composerReadOnly
              : t.composerPlaceholder
          }
          className="max-h-40 min-h-[40px] resize-none border-0 bg-transparent p-1 focus-visible:ring-0"
          rows={Math.min(6, Math.max(1, value.split('\n').length))}
          disabled={disabled}
          aria-busy={sending}
        />
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-md text-fg-subtle hover:bg-white/8 hover:text-fg"
              disabled={disabled}
            >
              <Smile className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-2">
            <div className="grid grid-cols-6 gap-1 text-xl">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="rounded-md p-1.5 hover:bg-white/10"
                  onClick={() => setValue((v) => v + e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          size="icon"
          variant="primary"
          onClick={send}
          disabled={!canSend || sending || disabled}
          title="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-fg">
        <span>{t.composerHintFooter.replace('{{mb}}', String(platformConfig?.uploadMaxMb ?? 100))}</span>
        <span className={cn(tooLong && 'text-accent-rose')}>{remaining} chars left</span>
      </div>
    </div>
  );
}
