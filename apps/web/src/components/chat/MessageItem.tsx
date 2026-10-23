'use client';

import * as React from 'react';
import {
  Reply,
  Smile,
  Pencil,
  Trash2,
  Pin,
  MoreHorizontal,
} from 'lucide-react';
import type { Message } from '@sydt/shared';
import { Permission, isStaff } from '@sydt/shared';
import { resolveUserAvatarSrc, showsTeamCornerBadge } from '@/lib/branding/user-avatar';
import { AvatarWithStatus } from '@/components/common/AvatarWithStatus';
import { LightboxImage } from '@/components/common/ImageLightbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserIdentity } from '@/components/common/UserIdentity';
import { MessageMarkdown } from './MessageMarkdown';
import { cn } from '@/lib/utils';
import { shortTime, smartDate, fullTimestamp } from '@/lib/format/time';
import { useAuthStore } from '@/store/auth';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useCan } from '@/lib/rbac/Can';
import { useI18n } from '@/components/providers/LocaleProvider';
import { UserProfileTrigger } from '@/components/users/UserProfileTrigger';
import { useLivePresence } from '@/lib/presence/use-live-presence';

const QUICK_REACTIONS = ['👍', '🔥', '🩸', '💀', '🛡️', '🎯', '✅', '❌'];

interface Props {
  message: Message;
  grouped: boolean;
  highlighted?: boolean;
  onReact: (emoji: string) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onPin?: (id: string) => void;
  onReply: (id: string) => void;
  /** Server role grants `manageMessages` in this channel's server. */
  canModerate?: boolean;
}

export function MessageItem({
  message,
  grouped,
  highlighted,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onReply,
  canModerate = false,
}: Props) {
  const { t } = useI18n();
  const me = useAuthStore((s) => s.user);
  const canPin = useCan(Permission.MESSAGE_PIN) || canModerate;
  const canDeleteAny = useCan(Permission.MESSAGE_DELETE_ANY) || canModerate;

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(message.content);

  const isMine = me?.id === message.authorId;
  const authorPresence = useLivePresence(message.authorId, 'OFFLINE');
  const canEdit = isMine && !message.deletedAt;
  const canDelete = (isMine || canDeleteAny) && !message.deletedAt;

  React.useEffect(() => setDraft(message.content), [message.content]);

  const submitEdit = () => {
    const next = draft.trim();
    if (!next || next === message.content) {
      setEditing(false);
      return;
    }
    onEdit(message.id, next);
    setEditing(false);
  };

  if (message.deletedAt) {
    return (
      <div className={cn('group relative px-4 py-1 text-sm italic text-muted-fg', grouped ? 'pl-16' : 'pt-2')}>
        {t.msgDeleted}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex gap-3 px-4 transition-colors',
        grouped ? 'py-0.5 pl-16' : 'pt-3 pb-2',
        'hover:bg-white/[0.02]',
        highlighted && 'bg-accent-cyan/10 ring-1 ring-inset ring-accent-cyan/25',
      )}
      id={`message-${message.id}`}
    >
      {!grouped ? (
        <UserProfileTrigger
          userId={message.authorId}
          disabled={isMine}
          className="mt-1 inline-flex shrink-0 rounded-full"
        >
          <AvatarWithStatus
            name={message.author.displayName}
            src={resolveUserAvatarSrc(message.author)}
            status={authorPresence}
            size="md"
            teamColor={message.author.team?.color}
            teamName={message.author.team?.name}
            team={message.author.team}
            showTeamBadge={showsTeamCornerBadge(message.author)}
          />
        </UserProfileTrigger>
      ) : (
        <span className="w-9 shrink-0 self-start pt-1 text-[10px] tabular-nums text-muted-fg opacity-0 group-hover:opacity-100">
          {shortTime(message.createdAt)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        {!grouped ? (
          <div className="mb-0.5 space-y-0.5">
            <div className="flex flex-wrap items-baseline gap-2">
              {me?.id !== message.authorId ? (
                <UserProfileTrigger userId={message.authorId} className="min-w-0 flex-1">
                  <UserIdentity user={message.author} showTeamMark={false} className="min-w-0" />
                </UserProfileTrigger>
              ) : (
                <UserIdentity user={message.author} showTeamMark={false} className="flex-1 min-w-0" />
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[11px] text-muted-fg">{smartDate(message.createdAt)}</span>
                </TooltipTrigger>
                <TooltipContent>{fullTimestamp(message.createdAt)}</TooltipContent>
              </Tooltip>
            {message.pinned ? (
              <span className="inline-flex items-center gap-0.5 rounded border border-accent-amber/30 bg-accent-amber/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent-amber">
                <Pin className="h-2.5 w-2.5" /> {t.messagePinnedBadge}
              </span>
            ) : null}
            {message.editedAt ? (
              <span className="text-[10px] italic text-muted-fg">{t.msgEdited}</span>
            ) : null}
            </div>
          </div>
        ) : null}

        {message.replyTo ? (
          <div className="mb-1 max-w-[640px] truncate rounded-md border-l-2 border-accent-violet/50 bg-accent-violet/5 pl-2 text-[12px] text-fg-subtle">
            <span className="text-accent-violet">{t.msgReplyMarker}</span>{' '}
            <span className="text-muted-fg">·</span>{' '}
            <span className="truncate">{message.replyTo.content || t.composerEmptyReply}</span>
          </div>
        ) : null}

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              rows={Math.min(8, Math.max(2, draft.split('\n').length))}
            />
            <div className="flex items-center gap-2 text-[11px]">
              <Button size="sm" variant="primary" onClick={submitEdit}>
                {t.save}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t.commonCancel}
              </Button>
              <span className="text-muted-fg">{t.msgEditHint}</span>
            </div>
          </div>
        ) : (
          <MessageMarkdown content={message.content} />
        )}

        {message.attachments.length > 0 ? (
          <div className="mt-2 flex flex-col gap-2">
            {message.attachments.map((a) =>
              a.mimeType.startsWith('image/') ? (
                <LightboxImage key={a.id} src={a.url} alt={a.name} />
              ) : (
                <a
                  key={a.id}
                  href={a.url}
                  className="inline-flex max-w-md items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-accent-cyan hover:bg-white/10"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="shrink-0 font-mono text-[10px] text-muted-fg">
                    {(a.size / 1024).toFixed(a.size > 10240 ? 0 : 1)} KB
                  </span>
                  <span className="truncate font-medium">{a.name}</span>
                </a>
              ),
            )}
          </div>
        ) : null}

        {message.reactions.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => {
              const mine = me ? r.userIds.includes(me.id) : false;
              return (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => onReact(r.emoji)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all',
                    mine
                      ? 'border-accent-cyan/40 bg-accent-cyan/15 text-accent-cyan'
                      : 'border-white/10 bg-white/5 text-fg-subtle hover:bg-white/10',
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="font-mono text-[10px] tabular-nums">{r.count}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute right-3 -top-3 z-10 flex items-center gap-0.5 rounded-md border border-white/10 bg-bg-elev/80 px-1 py-0.5 opacity-0 shadow-glass backdrop-blur-md group-hover:pointer-events-auto group-hover:opacity-100">
        <Popover>
          <PopoverTrigger asChild>
            <button className="rounded p-1 text-fg-subtle hover:bg-white/10 hover:text-fg" title={t.msgAddReaction}>
              <Smile className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-1">
            <div className="flex flex-wrap gap-1">
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="rounded-md px-2 py-1 text-lg hover:bg-white/10"
                  onClick={() => onReact(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <button
          className="rounded p-1 text-fg-subtle hover:bg-white/10 hover:text-fg"
          onClick={() => onReply(message.id)}
          title={t.msgReply}
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
        {canEdit ? (
          <button
            className="rounded p-1 text-fg-subtle hover:bg-white/10 hover:text-fg"
            onClick={() => setEditing(true)}
            title={t.msgEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {onPin && canPin ? (
          <button
            className="rounded p-1 text-fg-subtle hover:bg-white/10 hover:text-fg"
            onClick={() => onPin(message.id)}
            title={t.msgPin}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {canDelete ? (
          <button
            className="rounded p-1 text-fg-subtle hover:bg-accent-rose/15 hover:text-accent-rose"
            onClick={() => onDelete(message.id)}
            title={t.msgDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
