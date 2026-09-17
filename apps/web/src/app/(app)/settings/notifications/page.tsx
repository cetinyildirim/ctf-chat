'use client';

import * as React from 'react';

import Link from 'next/link';
import { Bell, BellOff, Volume2, VolumeX, Radar } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNotificationStore } from '@/store/notifications';
import { requestBrowserPermission } from '@/lib/notifications/browser';
import { playSoundFromUserGesture } from '@/lib/notifications/sound';
import { toast } from 'sonner';
import { useI18n } from '@/components/providers/LocaleProvider';
import { cn } from '@/lib/utils';

export default function NotificationSettingsPage() {
  const { t } = useI18n();
  const soundEnabled = useNotificationStore((s) => s.soundEnabled);
  const dnd = useNotificationStore((s) => s.dnd);
  const setSoundEnabled = useNotificationStore((s) => s.setSoundEnabled);
  const setDnd = useNotificationStore((s) => s.setDnd);

  const enablePush = async () => {
    const res = await requestBrowserPermission();
    if (res === 'granted') toast.success(t.notificationsBrowserGranted);
    else if (res === 'denied') toast.warning(t.notificationsBrowserDenied);
  };

  const SwitchRow = ({
    id,
    label,
    description,
    pressed,
    onToggle,
    onIcon,
    offIcon,
  }: {
    id: string;
    label: string;
    description: string;
    pressed: boolean;
    onToggle: () => void;
    onIcon: React.ReactNode;
    offIcon: React.ReactNode;
  }) => (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5">
      <div className={cn('shrink-0 text-accent-cyan', pressed ? 'opacity-100' : 'opacity-75')}>
        {pressed ? onIcon : offIcon}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <div className="min-w-0 pr-2">
          <Label htmlFor={id} className="text-sm font-medium text-fg">
            {label}
          </Label>
          <p className="mt-1 text-xs text-fg-subtle">{description}</p>
        </div>
        <Switch id={id} checked={pressed} onCheckedChange={() => onToggle()} />
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar title={t.settingsNotificationsTitle} subtitle={t.settingsNotificationsLead} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <SwitchRow
            id="set-sound"
            label={t.settingsSoundHeading}
            description={t.settingsSoundBody}
            pressed={soundEnabled}
            onToggle={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playSoundFromUserGesture('ticket');
            }}
            onIcon={<Volume2 className="h-5 w-5" />}
            offIcon={<VolumeX className="h-5 w-5" />}
          />
          <SwitchRow
            id="set-dnd"
            label={t.settingsDndHeading}
            description={t.settingsDndBody}
            pressed={dnd}
            onToggle={() => setDnd(!dnd)}
            onIcon={<BellOff className="h-5 w-5" />}
            offIcon={<Bell className="h-5 w-5" />}
          />

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start gap-3">
              <Radar className="mt-0.5 h-5 w-5 shrink-0 text-accent-violet" />
              <div>
                <div className="text-sm font-medium text-fg">{t.settingsBrowserHeading}</div>
                <p className="mt-1 text-xs text-fg-subtle">{t.settingsBrowserBody}</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void enablePush()}>
              {t.notificationsEnableBrowser}
            </Button>
          </div>

          <Link
            href="/"
            className="text-center text-sm font-medium text-accent-cyan hover:underline md:text-left"
          >
            {t.settingsBackToWorkspace}
          </Link>
        </div>
      </div>
    </div>
  );
}
