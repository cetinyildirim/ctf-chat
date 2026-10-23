'use client';

import * as React from 'react';
import { ALL_ROLES, ROLE_RANK, Role } from '@sydt/shared';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/providers/LocaleProvider';
import type { ManagedServer } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';

export const selectClass =
  'flex h-10 w-full rounded-md border border-white/10 bg-bg-deep px-3 text-sm text-fg outline-none focus:border-accent-cyan/50 disabled:opacity-50';

export const usersManageKey = ['admin', 'users-manage'] as const;
export const managedServersKey = ['admin', 'users-manage', 'servers'] as const;

/** Roles the actor may hand out: everything for super admins, otherwise strictly below their own. */
export function assignableRoles(actorRole: Role | undefined): Role[] {
  if (!actorRole) return [];
  if (actorRole === Role.SUPER_ADMIN) return [...ALL_ROLES];
  return ALL_ROLES.filter((r) => ROLE_RANK[r] < ROLE_RANK[actorRole]);
}

export function canManageTarget(actorRole: Role | undefined, targetRole: Role, isSelf: boolean): boolean {
  if (!actorRole) return false;
  if (isSelf || actorRole === Role.SUPER_ADMIN) return true;
  return ROLE_RANK[targetRole] < ROLE_RANK[actorRole];
}

export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((s, [k, v]) => s.split(`{{${k}}}`).join(String(v)), template);
}

export function ServerRoleSelect({
  server,
  value,
  onChange,
  emptyLabel,
  disabled,
}: {
  server: ManagedServer | undefined;
  value: string;
  onChange: (roleId: string) => void;
  emptyLabel: string;
  disabled?: boolean;
}) {
  return (
    <select
      className={selectClass}
      value={value}
      disabled={disabled || !server}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{emptyLabel}</option>
      {server?.roles.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}

export function TempPasswordBox({ password }: { password: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success(t.umCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t.codeClipboardUnavailable);
    }
  };
  return (
    <div className="space-y-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3">
      <div className="text-xs font-semibold text-accent-amber">{t.umTempPasswordTitle}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 select-all break-all rounded bg-bg-deep/60 px-2 py-1.5 font-mono text-sm text-fg">
          {password}
        </code>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void copy()}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {t.umCopy}
        </Button>
      </div>
      <p className="text-[11px] text-fg-subtle">{t.umTempPasswordHint}</p>
    </div>
  );
}

export function StatusBadge({ tone, children }: { tone: 'rose' | 'amber' | 'violet' | 'muted'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        tone === 'rose' && 'border-accent-rose/40 bg-accent-rose/10 text-accent-rose',
        tone === 'amber' && 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber',
        tone === 'violet' && 'border-accent-violet/40 bg-accent-violet/10 text-accent-violet',
        tone === 'muted' && 'border-white/10 bg-white/5 text-muted-fg',
      )}
    >
      {children}
    </span>
  );
}
