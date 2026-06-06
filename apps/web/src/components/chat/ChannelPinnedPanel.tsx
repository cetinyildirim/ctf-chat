'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Hash } from 'lucide-react';
import type { PinnedMessageEntry, PinsByCategoryGroup } from '@sydt/shared';
import { serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useI18n } from '@/components/providers/LocaleProvider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Section } from '@/components/common/Section';
import { MessageMarkdown } from '@/components/chat/MessageMarkdown';
import { Avatar } from '@/components/ui/avatar';
import { smartDate } from '@/lib/format/time';
import { cn } from '@/lib/utils';

export function ChannelPinnedPanel({
  serverId,
  activeChannelId,
  onJumpToPin,
}: {
  serverId: string;
  activeChannelId: string;
  onJumpToPin: (entry: PinnedMessageEntry) => void;
}) {
  const { t } = useI18n();
  const { data: groups = [], isLoading } = useQuery({
    queryKey: queryKeys.serverPinsByCategory(serverId),
    queryFn: () => serversApi.listPinsByCategory(serverId),
    staleTime: 15_000,
  });

  const total = groups.reduce((n, g) => n + g.pins.length, 0);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-3">
        <Section title={t.channelPinnedTitle} description={t.channelPinnedDesc}>
          {isLoading ? (
            <div className="text-xs text-muted-fg">{t.loading}</div>
          ) : total === 0 ? (
            <div className="rounded-md border border-dashed border-white/10 p-4 text-xs text-muted-fg">
              {t.channelPinnedEmpty}
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <CategoryPinGroup
                  key={group.categoryId ?? '__none__'}
                  group={group}
                  activeChannelId={activeChannelId}
                  uncategorizedLabel={t.channelPinnedUncategorized}
                  channelLabel={(name) => t.channelPinnedInChannel.replace('{{channel}}', name)}
                  onJumpToPin={onJumpToPin}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </ScrollArea>
  );
}

function CategoryPinGroup({
  group,
  activeChannelId,
  uncategorizedLabel,
  channelLabel,
  onJumpToPin,
}: {
  group: PinsByCategoryGroup;
  activeChannelId: string;
  uncategorizedLabel: string;
  channelLabel: (channelName: string) => string;
  onJumpToPin: (entry: PinnedMessageEntry) => void;
}) {
  const title = group.categoryName.trim() || uncategorizedLabel;
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 border-b border-white/8 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-cyan/90">
        <span className="truncate">{title}</span>
        <span className="text-muted-fg">({group.pins.length})</span>
      </h4>
      <ul className="space-y-2">
        {group.pins.map((entry) => {
          const isHere = entry.channelId === activeChannelId;
          return (
            <li key={`${entry.channelId}-${entry.message.id}`}>
              <button
                type="button"
                onClick={() => onJumpToPin(entry)}
                className={cn(
                  'w-full rounded-md border p-2.5 text-left transition-colors',
                  isHere
                    ? 'border-accent-cyan/25 bg-accent-cyan/5 hover:border-accent-cyan/40'
                    : 'border-white/8 bg-white/[0.02] hover:border-accent-cyan/30 hover:bg-accent-cyan/5',
                )}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                  <span className="inline-flex items-center gap-0.5 font-medium text-accent-cyan/90">
                    <Hash className="h-3 w-3 shrink-0" />
                    {channelLabel(entry.channelName)}
                  </span>
                  <span className="text-muted-fg">·</span>
                  <span className="inline-flex items-center gap-1.5 text-fg-subtle">
                    <Avatar name={entry.message.author.displayName} src={entry.message.author.avatarUrl} size="xs" />
                    <span className="font-medium text-fg">{entry.message.author.displayName}</span>
                  </span>
                  <span className="text-muted-fg">·</span>
                  <span className="text-muted-fg">{smartDate(entry.pinnedAt)}</span>
                </div>
                <MessageMarkdown content={entry.message.content} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
