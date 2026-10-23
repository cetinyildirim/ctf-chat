'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Role } from '@sydt/shared';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { roleLabel } from '@/components/common/RoleBadge';
import { useI18n } from '@/components/providers/LocaleProvider';
import { useAuthStore } from '@/store/auth';
import { adminUserManageApi, type ManagedServer } from '@/lib/api/endpoints';
import { unwrapApiError } from '@/lib/api/axios';
import { ServerRoleSelect, TempPasswordBox, assignableRoles, fill, selectClass, usersManageKey } from './shared';

const EMPTY = {
  email: '',
  username: '',
  displayName: '',
  password: '',
  role: Role.SPECTATOR as Role,
  serverId: '',
  serverRoleId: '',
  mustChangePassword: true,
};

export function CreateUserDialog({
  open,
  onOpenChange,
  servers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servers: ManagedServer[];
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const roles = assignableRoles(me?.role as Role | undefined);
  const [form, setForm] = React.useState(EMPTY);
  const [created, setCreated] = React.useState<{ username: string; temporaryPassword: string | null } | null>(null);

  React.useEffect(() => {
    if (!open) {
      setForm(EMPTY);
      setCreated(null);
    }
  }, [open]);

  const createMut = useMutation({
    mutationFn: () =>
      adminUserManageApi.create({
        email: form.email.trim(),
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        ...(form.password ? { password: form.password } : {}),
        mustChangePassword: form.mustChangePassword,
        role: form.role,
        ...(form.serverId ? { serverId: form.serverId, serverRoleId: form.serverRoleId || null } : {}),
      }),
    onSuccess: (res) => {
      toast.success(fill(t.umCreatedOk, { username: res.username }));
      setCreated({ username: res.username, temporaryPassword: res.temporaryPassword });
      void qc.invalidateQueries({ queryKey: usersManageKey });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const valid =
    form.email.includes('@') && form.username.trim().length >= 3 && form.displayName.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.umCreateTitle}</DialogTitle>
          <DialogDescription>{t.umCreateLead}</DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <p className="text-sm text-fg">{fill(t.umCreatedOk, { username: created.username })}</p>
            {created.temporaryPassword ? <TempPasswordBox password={created.temporaryPassword} /> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreated(null)}>
                {t.umNewUser}
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t.umClose}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) createMut.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t.umFieldDisplayName}</Label>
                <Input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.umFieldUsername}</Label>
                <Input value={form.username} onChange={(e) => set('username', e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t.umFieldEmail}</Label>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t.umFieldPasswordOptional}</Label>
                <Input
                  type="text"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                />
                <p className="text-[11px] text-fg-muted">{t.umPasswordRule}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t.umFieldRole}</Label>
                <select className={selectClass} value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r, t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t.umFieldServer}</Label>
                <select
                  className={selectClass}
                  value={form.serverId}
                  onChange={(e) => setForm((f) => ({ ...f, serverId: e.target.value, serverRoleId: '' }))}
                >
                  <option value="">{t.umHomeServer}</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {form.serverId ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t.umFieldServerRole}</Label>
                  <ServerRoleSelect
                    server={servers.find((s) => s.id === form.serverId)}
                    value={form.serverRoleId}
                    onChange={(v) => set('serverRoleId', v)}
                    emptyLabel={t.umDefaultRole}
                  />
                </div>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-xs text-fg-subtle">
              <input
                type="checkbox"
                checked={form.mustChangePassword}
                onChange={(e) => set('mustChangePassword', e.target.checked)}
              />
              {t.umPasswordMustChange}
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t.umCancel}
              </Button>
              <Button type="submit" disabled={!valid || createMut.isPending}>
                {t.umCreateSubmit}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
