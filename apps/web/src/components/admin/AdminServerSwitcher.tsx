'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Server } from 'lucide-react';
import { Permission } from '@sydt/shared';
import { useAuthStore } from '@/store/auth';
import { useServerStore } from '@/store/server';
import { serversApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useI18n } from '@/components/providers/LocaleProvider';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function AdminServerSwitcher({ className }: { className?: string }) {
  const { t } = useI18n();
  const me = useAuthStore((s) => s.user);
  const canDash = !!me?.permissions.includes(Permission.ADMIN_DASHBOARD);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServerId = useServerStore((s) => s.setActiveServerId);
  const [open, setOpen] = React.useState(false);

  const { data: memberServers = [] } = useQuery({
    queryKey: queryKeys.servers,
    queryFn: serversApi.list,
  });
  const { data: allServers = [] } = useQuery({
    queryKey: [...queryKeys.servers, 'manageable'] as const,
    queryFn: serversApi.listManageable,
    enabled: canDash,
  });
  const options = canDash && allServers.length > 0 ? allServers : memberServers;
  const active = options.find((s) => s.id === activeServerId) ?? options[0];

  React.useEffect(() => {
    if (!activeServerId && options[0]) setActiveServerId(options[0].id);
  }, [activeServerId, options, setActiveServerId]);

  if (options.length === 0) {
    return (
      <p className={cn('px-3 py-2 text-xs text-fg-subtle', className)}>{t.adminOverviewNoServer}</p>
    );
  }

  return (
    <div className={cn('border-b border-white/8 px-2 pb-3 pt-2', className)}>
      <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
        <Server className="h-3 w-3" />
        {t.adminActiveServerLabel}
      </p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg-elev px-3 text-left text-sm font-medium text-fg shadow-sm transition-colors hover:border-accent-cyan/35 hover:bg-muted"
          >
            <span className="truncate">{active?.name ?? t.adminOverviewNoServer}</span>
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-fg transition-transform', open && 'rotate-180')} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] border-border bg-bg p-1"
        >
          <ul className="max-h-56 overflow-y-auto">
            {options.map((s) => {
              const picked = s.id === active?.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm',
                      picked ? 'bg-accent-cyan/15 text-fg' : 'text-fg-subtle hover:bg-white/8 hover:text-fg',
                    )}
                    onClick={() => {
                      setActiveServerId(s.id);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{s.name}</span>
                    {picked ? <Check className="h-4 w-4 shrink-0 text-accent-cyan" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
