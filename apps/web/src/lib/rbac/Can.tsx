'use client';
import * as React from 'react';
import type { Permission } from '@sydt/shared';
import { useAuthStore } from '@/store/auth';

interface CanProps {
  permission?: Permission;
  permissions?: Permission[];
  mode?: 'all' | 'any';
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/** Gate on SessionUser.permissions (effective role), not raw user.role. */
export function Can({ permission, permissions, mode = 'all', fallback = null, children }: CanProps) {
  const perms = useAuthStore((s) => s.user?.permissions);
  const list = permission ? [permission] : permissions ?? [];
  if (list.length === 0) return <>{children}</>;
  const set = new Set(perms ?? []);
  const ok = mode === 'all' ? list.every((p) => set.has(p)) : list.some((p) => set.has(p));
  return <>{ok ? children : fallback}</>;
}

export function useCan(permission: Permission): boolean {
  const perms = useAuthStore((s) => s.user?.permissions);
  return !!perms?.includes(permission);
}
