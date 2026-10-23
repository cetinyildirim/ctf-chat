'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import { authApi } from '@/lib/api/endpoints';
import { useAuthStore } from '@/store/auth';
import { normalizeSessionUser } from '@/lib/auth/session-normalize';

const PUBLIC_ROUTES = new Set(['/login', '/register']);
/** Must stay in sync with the public paths in middleware.ts. */
const PUBLIC_PREFIXES = ['/invite/', '/legal/', '/p/'];

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

async function loadSessionUser() {
  try {
    return await authApi.me();
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status !== 401) throw err;
    // Access cookie may be expired while refresh is still valid; /auth/me skips the interceptor retry.
    await axios.post('/api/auth/refresh', {}, { withCredentials: true });
    return authApi.me();
  }
}

export function AuthBootstrapper() {
  const router = useRouter();
  const pathname = usePathname();
  const setUser = useAuthStore((s) => s.setUser);
  const setReady = useAuthStore((s) => s.setReady);
  const pathnameRef = React.useRef(pathname);
  pathnameRef.current = pathname;

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await authApi.ensureCsrf();
        const user = await loadSessionUser();
        if (!mounted) return;
        setUser(normalizeSessionUser(user));
        setReady(true);
        const path = pathnameRef.current ?? '/';
        if (path === '/login' || path === '/register') {
          router.replace('/');
        }
      } catch {
        if (!mounted) return;
        setUser(null);
        setReady(true);
        const path = pathnameRef.current ?? '/';
        if (!isPublicRoute(path)) {
          router.replace('/login');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, setUser, setReady]);

  return null;
}
