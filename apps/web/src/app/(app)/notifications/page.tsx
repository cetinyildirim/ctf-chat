'use client';

import * as React from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bell, Megaphone } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { useNotificationStore } from '@/store/notifications';
import { useNotificationSync } from '@/lib/notifications/use-notification-sync';
import { announcementsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { useI18n } from '@/components/providers/LocaleProvider';
import { relative } from '@/lib/format/time';
import { cn } from '@/lib/utils';
import type { Announcement } from '@sydt/shared';

function NotificationsPageInner() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const highlightId = params.get('announcement');

  const items = useNotificationStore((s) => s.items);
  // Reads are persisted server-side, so the inbox survives a reload.
  const { markRead, markAllRead } = useNotificationSync();

  const { data: announcements = [] } = useQuery({
    queryKey: queryKeys.notificationsFeed,
    queryFn: announcementsApi.list,
  });

  const highlighted = announcements.find((a) => a.id === highlightId) ?? null;

  React.useEffect(() => {
    if (!highlightId) return;
    const match = items.find((n) => n.refId === highlightId || n.href?.includes(highlightId));
    if (match) markRead(match.id);
  }, [highlightId, items, markRead]);

  const openNotification = (href: string | undefined, id: string) => {
    markRead(id);
    if (href && href !== '#') router.push(href);
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={t.notificationsPageTitle}
        subtitle={t.notificationsPageLead}
        right={
          <Button type="button" size="sm" variant="outline" onClick={markAllRead}>
            {t.markAllNotificationsRead}
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
        <GlassPanel className="flex w-full max-w-md shrink-0 flex-col overflow-hidden lg:max-w-sm">
          <div className="border-b border-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-fg">
            {t.notificationsInbox}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-fg-subtle">{t.notificationsEmptyHint}</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotification(n.href, n.id)}
                  className={cn(
                    'flex w-full items-start gap-2 border-b border-white/5 px-3 py-2.5 text-left text-sm hover:bg-white/5',
                    !n.read && 'bg-accent-cyan/5',
                    highlightId && n.refId === highlightId && 'ring-1 ring-inset ring-accent-cyan/40',
                  )}
                >
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-accent-cyan" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-fg">{n.title}</div>
                    <div className="line-clamp-2 text-xs text-fg-subtle">{n.body}</div>
                    <div className="mt-0.5 text-[10px] text-muted-fg">{relative(n.createdAt)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-white/8 p-2">
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/settings/notifications">{t.settingsNotificationsMenu}</Link>
            </Button>
          </div>
        </GlassPanel>

        <GlassPanel className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-accent-violet" />
            <h2 className="text-lg font-semibold text-fg">{t.notificationsAnnouncementsTitle}</h2>
          </div>
          {highlighted ? (
            <AnnouncementDetail announcement={highlighted} />
          ) : announcements.length === 0 ? (
            <p className="text-sm text-fg-subtle">{t.notificationsNoAnnouncements}</p>
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/notifications?announcement=${a.id}`}
                    className={cn(
                      'block rounded-lg border border-white/8 px-4 py-3 transition-colors hover:bg-white/5',
                      highlightId === a.id && 'border-accent-cyan/30 bg-accent-cyan/5',
                    )}
                  >
                    <AnnouncementDetail announcement={a} compact />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsPageInner />
    </Suspense>
  );
}

function AnnouncementDetail({ announcement, compact }: { announcement: Announcement; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div>
      <h3 className={compact ? 'font-semibold text-fg' : 'text-xl font-bold text-fg'}>{announcement.title}</h3>
      <p className="mt-1 text-xs text-muted-fg">
        {announcement.author.displayName} · {relative(announcement.createdAt)}
        {announcement.scheduledFor && !announcement.publishedAt ? ` · ${t.serverAnnouncementPending}` : ''}
      </p>
      {!compact ? <p className="mt-4 whitespace-pre-wrap text-sm text-fg-subtle">{announcement.body}</p> : null}
      {compact ? <p className="mt-1 line-clamp-2 text-xs text-fg-subtle">{announcement.body}</p> : null}
    </div>
  );
}
