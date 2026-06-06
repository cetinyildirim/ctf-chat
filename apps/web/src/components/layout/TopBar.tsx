'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Moon,
  LogOut,
  ShieldOff,
  Sparkles,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { useNotificationStore } from '@/store/notifications';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { authApi } from '@/lib/api/endpoints';
import { disconnectSocket } from '@/lib/socket/client';
import { RoleBadge } from '@/components/common/RoleBadge';
import { KbdHint } from '@/components/common/KbdHint';
import { cn } from '@/lib/utils';
import { relative } from '@/lib/format/time';
import { requestBrowserPermission } from '@/lib/notifications/browser';
import { toast } from 'sonner';
import Link from 'next/link';
import { useI18n } from '@/components/providers/LocaleProvider';
import { ThemeToggle } from '@/components/common/ThemeToggle';

export function TopBar({ title, subtitle, right }: { title?: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const items = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const soundEnabled = useNotificationStore((s) => s.soundEnabled);
  const dnd = useNotificationStore((s) => s.dnd);
  const setSoundEnabled = useNotificationStore((s) => s.setSoundEnabled);
  const setDnd = useNotificationStore((s) => s.setDnd);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const clearAuth = useAuthStore((s) => s.clear);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    disconnectSocket();
    clearAuth();
    router.replace('/login');
  };

  const logoutAll = async () => {
    try {
      await authApi.logoutAll();
      toast.success(t.logoutAllDevicesOk);
    } catch {
      toast.error(t.logoutAllDevicesFail);
    }
    disconnectSocket();
    clearAuth();
    router.replace('/login');
  };

  const enablePush = async () => {
    const res = await requestBrowserPermission();
    if (res === 'granted') toast.success(t.notificationsBrowserGranted);
    else if (res === 'denied') toast.warning(t.notificationsBrowserDenied);
  };

  const { locale, setLocale, t } = useI18n();

  return (
    <header className="flex items-center gap-3 border-b border-white/5 bg-bg-deep/40 px-4 py-2.5 backdrop-blur-md">
      <div className="min-w-0 flex-1">
        {title ? (
          <div className="flex items-center gap-2 truncate text-sm font-semibold text-fg">{title}</div>
        ) : null}
        {subtitle ? <div className="truncate text-xs text-muted-fg">{subtitle}</div> : null}
      </div>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="hidden h-9 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-fg-subtle hover:bg-white/8 md:flex"
      >
        <Search className="h-4 w-4" />
        <span>{t.searchShortcut}</span>
        <KbdHint keys={['Ctrl', 'K']} className="ml-3" />
      </button>

      {right}

      <ThemeToggle className="hidden md:inline-flex" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="hidden h-9 items-center rounded-md border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-fg-subtle transition-colors hover:border-accent-cyan/30 hover:bg-accent-cyan/10 hover:text-accent-cyan data-[state=open]:border-accent-cyan/40 data-[state=open]:text-accent-cyan md:inline-flex"
          >
            {locale.toUpperCase()}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t.language}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => void setLocale('tr')}>{t.langTr}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void setLocale('en')}>{t.langEn}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent-rose shadow-glow-rose" />
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b border-white/8 px-3 py-2 text-xs">
            <span className="font-semibold uppercase tracking-wider text-muted-fg">{t.notifications}</span>
            <button onClick={markAllRead} className="text-fg-subtle hover:text-fg">
              {t.markAllNotificationsRead}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-fg">{t.notificationsEmptyHint}</div>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.href ?? '#'}
                  className={cn(
                    'flex items-start gap-2 border-b border-white/5 px-3 py-2 text-sm hover:bg-white/5',
                    !n.read && 'bg-accent-cyan/5',
                  )}
                >
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-cyan" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-fg">{n.title}</div>
                    <div className="truncate text-xs text-fg-subtle">{n.body}</div>
                    <div className="mt-0.5 text-[10px] text-muted-fg">{relative(n.createdAt)}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
          <div className="border-t border-white/8 px-3 py-2">
            <Link href="/notifications" className="text-xs font-medium text-accent-cyan hover:underline">
              {t.notificationsViewAll}
            </Link>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/8 px-3 py-2 text-[11px]">
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="inline-flex items-center gap-1 text-fg-subtle hover:text-fg">
              {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              {soundEnabled ? t.notificationsSoundOn : t.notificationsSoundOff}
            </button>
            <button onClick={() => setDnd(!dnd)} className="inline-flex items-center gap-1 text-fg-subtle hover:text-fg">
              {dnd ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
              {dnd ? t.notificationsDndOn : t.notificationsDndOff}
            </button>
            <button onClick={enablePush} className="inline-flex items-center gap-1 text-fg-subtle hover:text-fg">
              <Activity className="h-3 w-3" />
              {t.notificationsEnableBrowser}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 hover:border-white/10 hover:bg-white/5">
              <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
              <span className="hidden text-sm font-medium text-fg md:inline">{user.displayName}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t.signedInAs}</DropdownMenuLabel>
            <div className="px-2.5 pb-2 text-sm text-fg">
              <div className="font-medium">{user.displayName}</div>
              <div className="text-[11px] text-muted-fg">@{user.username}</div>
              <div className="mt-1">
                <RoleBadge role={user.role} />
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/team')}>{t.myTeam}</DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push('/settings/profile')}
            >
              {t.settingsProfileMenu}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push('/settings/notifications')}
            >
              {t.settingsNotificationsMenu}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDnd(!dnd)}>
              <Moon className="h-3.5 w-3.5" /> {dnd ? t.dndMenuDisable : t.dndMenuEnable}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logoutAll} className="text-accent-rose">
              <ShieldOff className="h-3.5 w-3.5" /> {t.logoutAllDevices}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout} className="text-accent-rose">
              <LogOut className="h-3.5 w-3.5" /> {t.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </header>
  );
}
