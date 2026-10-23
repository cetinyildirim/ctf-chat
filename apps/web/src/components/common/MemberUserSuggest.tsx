'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { usersApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useI18n } from '@/components/providers/LocaleProvider';
import { cn } from '@/lib/utils';

export function MemberUserSuggest({
  serverId,
  value,
  onChange,
  onPick,
  onSelectUser,
  placeholder,
  className,
  disabled,
}: {
  serverId: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (username: string) => void;
  onSelectUser?: (user: import('@sydt/shared').PublicUser) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const debounced = useDebounced(value.trim(), 200);

  const { data: suggestions = [] } = useQuery({
    queryKey: queryKeys.userSuggest(debounced, serverId),
    queryFn: () => usersApi.suggest(debounced, { serverId, limit: 12 }),
    enabled: debounced.length >= 1,
  });

  const showList = open && debounced.length >= 1;

  return (
    <div className={cn('relative', className)}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? t.teamAddMemberHint}
        autoComplete="off"
        disabled={disabled}
      />
      {showList && suggestions.length > 0 ? (
        <ul className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-bg py-1 shadow-2xl ring-1 ring-black/40">
          {suggestions.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/8"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelectUser?.(u);
                  onPick(u.username);
                  setOpen(false);
                }}
              >
                <Avatar name={u.displayName} src={u.avatarUrl} size="sm" />
                <span className="min-w-0 truncate">
                  <span className="font-medium text-fg">{u.displayName}</span>
                  <span className="ml-2 text-xs text-muted-fg">@{u.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : showList ? (
        <p className="absolute left-0 top-full z-[100] mt-1 rounded-md border border-border bg-bg px-3 py-2 text-xs text-muted-fg shadow-xl">
          {t.friendsSuggestEmpty}
        </p>
      ) : null}
    </div>
  );
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
