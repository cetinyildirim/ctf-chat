'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { useUIStore } from '@/store/ui';
import { channelsApi, challengesApi, ticketsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useServerStore } from '@/store/server';
import {
  Hash,
  Flag,
  LifeBuoy,
  Trophy,
  ShieldAlert,
  AlertOctagon,
  Users,
  Bell,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { isStaff, Permission } from '@sydt/shared';

export function CommandPalette() {
  const router = useRouter();
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);
  const user = useAuthStore((s) => s.user);
  const activeServerId = useServerStore((s) => s.activeServerId);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const { data: channelsData } = useQuery({
    queryKey: queryKeys.channels(activeServerId ?? ''),
    queryFn: () => channelsApi.list(activeServerId!),
    enabled: open && !!user && !!activeServerId,
  });

  const { data: challenges } = useQuery({
    queryKey: queryKeys.challenges(),
    queryFn: () => challengesApi.list(),
    enabled: open && !!user,
  });

  const { data: tickets } = useQuery({
    queryKey: queryKeys.tickets,
    queryFn: ticketsApi.list,
    enabled: open && !!user,
  });

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go('/')}>
            <Hash className="h-4 w-4 text-accent-cyan" /> Open chat
            <CommandShortcut>G C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go('/scoreboard')}>
            <Trophy className="h-4 w-4 text-accent-amber" /> Open scoreboard
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go('/challenges')}>
            <Flag className="h-4 w-4 text-accent-emerald" /> Browse challenges
          </CommandItem>
          <CommandItem onSelect={() => go('/tickets')}>
            <LifeBuoy className="h-4 w-4 text-accent-rose" /> View tickets
          </CommandItem>
          <CommandItem onSelect={() => go('/team')}>
            <Users className="h-4 w-4 text-accent-violet" /> My team
          </CommandItem>
          <CommandItem onSelect={() => go('/notifications')}>
            <Bell className="h-4 w-4 text-accent-cyan" /> Notifications
          </CommandItem>
          {isStaff(user?.role) ? (
            <CommandItem onSelect={() => go('/incidents')}>
              <AlertOctagon className="h-4 w-4 text-accent-rose" /> Incidents
            </CommandItem>
          ) : null}
          {user?.permissions.includes(Permission.ADMIN_DASHBOARD) ? (
            <CommandItem onSelect={() => go('/admin')}>
              <ShieldAlert className="h-4 w-4 text-accent-rose" /> Admin dashboard
            </CommandItem>
          ) : null}
        </CommandGroup>

        {channelsData?.channels?.length ? (
          <CommandGroup heading="Channels">
            {channelsData.channels.slice(0, 12).map((c) => (
              <CommandItem
                key={c.id}
                value={`channel ${c.name}`}
                onSelect={() => go(`/channels/${c.id}`)}
              >
                <Hash className="h-4 w-4" /> {c.name}
                <ArrowRight className="ml-auto h-3 w-3 text-muted-fg" />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {challenges?.length ? (
          <CommandGroup heading="Challenges">
            {challenges.slice(0, 8).map((c) => (
              <CommandItem
                key={c.id}
                value={`chal ${c.title}`}
                onSelect={() => go(`/challenges/${c.id}`)}
              >
                <Flag className="h-4 w-4 text-accent-emerald" /> {c.title}
                <CommandShortcut>{c.category}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {tickets?.length ? (
          <CommandGroup heading="Tickets">
            {tickets.slice(0, 6).map((t) => (
              <CommandItem
                key={t.id}
                value={`ticket ${t.code} ${t.title}`}
                onSelect={() => go(`/tickets/${t.id}`)}
              >
                <LifeBuoy className="h-4 w-4 text-accent-rose" /> {t.code} · {t.title}
                <CommandShortcut>{t.status}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
