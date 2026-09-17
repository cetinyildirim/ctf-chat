'use client';
import * as React from 'react';
import { PanelLeft } from 'lucide-react';
import { ServerRail } from '@/components/layout/ServerRail';
import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import { useI18n } from '@/components/providers/LocaleProvider';
import { usePlatformBranding } from '@/components/providers/PlatformBrandingProvider';
import { SurveyGate } from '@/components/surveys/SurveyGate';
import { UserProfileProvider } from '@/components/users/UserProfileProvider';
import { ServerBootstrap } from '@/components/servers/ServerBootstrap';
import { PasswordChangeGate } from '@/components/auth/PasswordChangeGate';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const setChannelsDrawerOpen = useUIStore((s) => s.setChannelsDrawerOpen);
  const { t } = useI18n();
  const branding = usePlatformBranding();

  if (!ready) return <LoadingScreen />;
  if (!user) return null; // bootstrapper handles redirect

  const hideSidebar = pathname?.startsWith('/scoreboard');

  return (
    <div
      className={cn(
        'flex h-svh min-h-0 w-screen flex-col overflow-hidden bg-bg lg:grid lg:h-screen lg:min-h-0 lg:w-screen lg:grid-rows-[minmax(0,1fr)]',
        hideSidebar
          ? 'lg:grid-cols-[auto_minmax(0,1fr)]'
          : 'lg:grid-cols-[auto_minmax(0,16rem)_minmax(0,1fr)]',
      )}
    >
      {!hideSidebar ? (
        <header className="flex min-h-[3rem] items-center gap-2 border-b border-white/5 bg-bg-deep/50 px-3 backdrop-blur-md lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="border-white/15 bg-white/[0.04]"
            aria-label={t.mobileChannelsOpen}
            onClick={() => setChannelsDrawerOpen(true)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-fg">{branding.workspaceLabel}</div>
            <div className="truncate text-sm font-semibold text-fg">{branding.workspaceTitle}</div>
          </div>
        </header>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 lg:contents">
        <ServerRail />
        {!hideSidebar ? <ChannelSidebar /> : null}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
      <CommandPalette />
      <SurveyGate />
      <PasswordChangeGate />
      <UserProfileProvider />
      <ServerBootstrap />
    </div>
  );
}
