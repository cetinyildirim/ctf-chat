'use client';

import * as React from 'react';
import { ChannelNotifyMode } from '@sydt/shared';
import {
  AtSign,
  Bell,
  BellOff,
  SlidersHorizontal,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/components/providers/LocaleProvider';

function NotifyMenuItem({
  icon: Icon,
  label,
  disabled,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onClick={onSelect}
      className="group cursor-pointer gap-2.5 text-fg-subtle data-[highlighted]:bg-accent-cyan/12 data-[highlighted]:text-accent-cyan"
    >
      <Icon className="h-4 w-4 shrink-0 text-fg-subtle transition-colors group-data-[highlighted]:text-accent-cyan" aria-hidden />
      <span>{label}</span>
    </DropdownMenuItem>
  );
}

export function ChannelNotifyContextMenu({
  children,
  notifyBusy,
  onSetNotify,
}: {
  children: React.ReactNode;
  notifyBusy: boolean;
  onSetNotify: (mode: ChannelNotifyMode) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState({ x: 0, y: 0 });

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAnchor({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  return (
    <>
      <div className="min-w-0" onContextMenu={onContextMenu}>
        {children}
      </div>
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none fixed z-[60] h-px w-px opacity-0"
            style={{ left: anchor.x, top: anchor.y }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{t.notifyMenuTitle}</DropdownMenuLabel>
          <NotifyMenuItem
            icon={SlidersHorizontal}
            label={t.notifyModeDefault}
            disabled={notifyBusy}
            onSelect={() => onSetNotify(ChannelNotifyMode.DEFAULT)}
          />
          <NotifyMenuItem
            icon={Bell}
            label={t.notifyModeAll}
            disabled={notifyBusy}
            onSelect={() => onSetNotify(ChannelNotifyMode.ALL)}
          />
          <NotifyMenuItem
            icon={AtSign}
            label={t.notifyModeMentions}
            disabled={notifyBusy}
            onSelect={() => onSetNotify(ChannelNotifyMode.MENTIONS_ONLY)}
          />
          <NotifyMenuItem
            icon={BellOff}
            label={t.notifyModeNone}
            disabled={notifyBusy}
            onSelect={() => onSetNotify(ChannelNotifyMode.NONE)}
          />
          <DropdownMenuSeparator />
          <NotifyMenuItem
            icon={VolumeX}
            label={t.notifyModeMuted}
            disabled={notifyBusy}
            onSelect={() => onSetNotify(ChannelNotifyMode.MUTED)}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
