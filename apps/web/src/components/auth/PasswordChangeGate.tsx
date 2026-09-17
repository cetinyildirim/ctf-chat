'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

/** Redirects users who must change password to profile settings. */
export function PasswordChangeGate() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const router = useRouter();

  const pending = user?.mustChangePasswordServerIds ?? [];

  React.useEffect(() => {
    if (pending.length === 0) return;
    if (pathname?.startsWith('/settings/profile')) return;
    router.replace('/settings/profile?passwordRequired=1');
  }, [pending, pathname, router]);

  return null;
}
