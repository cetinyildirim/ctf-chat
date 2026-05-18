'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Hash, Users, ShieldAlert, UserRound } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Permission } from '@sydt/shared';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/components/providers/LocaleProvider';

interface RailItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  match: (path: string) => boolean;
}

export function ServerRail() {
  const pathname = usePathname() ?? '/';
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();

  const items: RailItem[] = React.useMemo(
    () => [
      { href: '/', label: t.railChat, icon: Hash, match: (p) => p === '/' || p.startsWith('/channels') },
      { href: '/friends', label: t.railFriends, icon: UserRound, match: (p) => p.startsWith('/friends') },
      { href: '/team', label: t.railTeam, icon: Users, match: (p) => p.startsWith('/team') },
      {
        href: '/admin',
        label: t.railAdmin,
        icon: ShieldAlert,
        permission: Permission.ADMIN_DASHBOARD,
        match: (p) => p.startsWith('/admin'),
      },
    ],
    [t],
  );

  return (
    <aside className="hidden h-full min-h-0 w-16 shrink-0 flex-col items-center gap-2 border-r border-white/5 bg-bg-deep/60 py-3 backdrop-blur-md sm:flex">
      <Link href="/" className="group relative mb-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent-cyan to-accent-violet text-bg-deep font-bold shadow-glow-cyan transition-transform group-hover:scale-105">
          SY
        </div>
        <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent-cyan animate-pulse-glow" />
      </Link>

      <div className="my-1 h-px w-8 bg-white/5" />

      <nav className="flex flex-1 flex-col items-center gap-2">
        {items.map((item) => {
          if (item.permission && !user?.permissions.includes(item.permission)) return null;
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    'relative grid h-11 w-11 place-items-center rounded-xl border transition-all',
                    active
                      ? 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan shadow-glow-cyan'
                      : 'border-transparent bg-white/[0.03] text-fg-subtle hover:bg-white/8 hover:text-fg',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {active ? (
                    <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent-cyan shadow-glow-cyan" />
                  ) : null}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
}
