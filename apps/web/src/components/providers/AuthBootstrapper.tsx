'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { normalizeSessionUser } from '@/lib/auth/session-normalize';

const PUBLIC_ROUTES = new Set(['/login', '/register']);

export function AuthBootstrapper() {
  const router = useRouter();
  const pathname = usePathname();
  const setUser = useAuthStore((s) => s.setUser);
  const setReady = useAuthStore((s) => s.setReady);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await authApi.ensureCsrf();
        const user = await authApi.me();
        if (!mounted) return;
        setUser(normalizeSessionUser(user));
        setReady(true);
        if (pathname === '/login' || pathname === '/register') {
          router.replace('/');
        }
      } catch {
        if (!mounted) return;
        setUser(null);
        setReady(true);
        if (!PUBLIC_ROUTES.has(pathname ?? '/')) {
          router.replace('/login');
        }
      }
    })();
    return () => {
      mounted = false;
    };
    
  }, []);

  return null;
}
