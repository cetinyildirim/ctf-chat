'use client';

import * as React from 'react';
import { ChannelNotifyMode } from '@sydt/shared';
import {
  AtSign,
  Bell,
  BellOff,
  Copy,
  Link2,
  Pencil,
  Settings,
  SlidersHorizontal,
  Trash2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/components/providers/LocaleProvider';
import type { ChatServer } from '@sydt/shared';
import { Permission } from '@sydt/shared';
import { useAuthStore } from '@/store/auth';

function MenuItem({
  icon: Icon,
  label,
  disabled,
  destructive,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onClick={onSelect}
      className={
        destructive
          ? 'cursor-pointer gap-2.5 text-accent-rose data-[highlighted]:bg-accent-rose/15 data-[highlighted]:text-accent-rose'
          : 'group cursor-pointer gap-2.5 text-fg-subtle data-[highlighted]:bg-accent-cyan/12 data-[highlighted]:text-accent-cyan'
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </DropdownMenuItem>
  );
}

export function ServerContextMenu({
  server,
  children,
  notifyBusy,
  onSetNotify,
  onEditAppearance,
  onCreateInvite,
  onServerSettings,
  onDeleteServer,
}: {
  server: ChatServer;
  children: React.ReactNode;
  notifyBusy?: boolean;
  onSetNotify: (mode: ChannelNotifyMode) => void;
  onEditAppearance: () => void;
  onCreateInvite: () => void;
  onServerSettings: () => void;
  onDeleteServer: () => void;
}) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState({ x: 0, y: 0 });

  const canManage =
    !!user?.permissions.includes(Permission.ADMIN_DASHBOARD) ||
    !!user?.permissions.includes(Permission.CATEGORY_MANAGE);

  const canDelete = !!user?.permissions.includes(Permission.ADMIN_DASHBOARD);

  const close = () => setOpen(false);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAnchor({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  return (
    <>
      <div className="inline-flex" onContextMenu={onContextMenu}>
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
        <DropdownMenuContent align="start" className="min-w-[14.5rem] border-border bg-bg/98 backdrop-blur-md">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-fg-subtle">
              <Bell className="h-4 w-4 shrink-0" />
              <span>{t.notifyMenuTitle}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="border-border bg-bg/98">
              <MenuItem icon={SlidersHorizontal} label={t.notifyModeDefault} disabled={notifyBusy} onSelect={() => { onSetNotify(ChannelNotifyMode.DEFAULT); close(); }} />
              <MenuItem icon={Bell} label={t.notifyModeAll} disabled={notifyBusy} onSelect={() => { onSetNotify(ChannelNotifyMode.ALL); close(); }} />
              <MenuItem icon={AtSign} label={t.notifyModeMentions} disabled={notifyBusy} onSelect={() => { onSetNotify(ChannelNotifyMode.MENTIONS_ONLY); close(); }} />
              <MenuItem icon={BellOff} label={t.notifyModeNone} disabled={notifyBusy} onSelect={() => { onSetNotify(ChannelNotifyMode.NONE); close(); }} />
              <MenuItem icon={VolumeX} label={t.notifyModeMuted} disabled={notifyBusy} onSelect={() => { onSetNotify(ChannelNotifyMode.MUTED); close(); }} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <MenuItem icon={Link2} label={t.serverMenuInvite} onSelect={() => { close(); onCreateInvite(); }} />
          <MenuItem icon={Pencil} label={t.serverMenuEditAppearance} onSelect={() => { close(); onEditAppearance(); }} />
          {canManage ? (
            <MenuItem icon={Settings} label={t.serverMenuSettings} onSelect={() => { close(); onServerSettings(); }} />
          ) : null}
          <MenuItem
            icon={Copy}
            label={t.serverMenuCopyId}
            onSelect={() => {
              void navigator.clipboard.writeText(server.id);
              close();
            }}
          />

          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <MenuItem
                icon={Trash2}
                label={t.serverDeleteBtn}
                destructive
                onSelect={() => {
                  close();
                  onDeleteServer();
                }}
              />
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
