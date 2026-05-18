'use client';
import * as React from 'react';
import { can, type Permission } from '@sydt/shared';
import { useAuthStore } from '@/store/auth';

interface CanProps {
  permission?: Permission;
  permissions?: Permission[];
  mode?: 'all' | 'any';
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function Can({ permission, permissions, mode = 'all', fallback = null, children }: CanProps) {
  const role = useAuthStore((s) => s.user?.role);
  const list = permission ? [permission] : permissions ?? [];
  if (list.length === 0) return <>{children}</>;
  const ok = mode === 'all' ? list.every((p) => can(role, p)) : list.some((p) => can(role, p));
  return <>{ok ? children : fallback}</>;
}

export function useCan(permission: Permission): boolean {
  const role = useAuthStore((s) => s.user?.role);
  return can(role, permission);
}
