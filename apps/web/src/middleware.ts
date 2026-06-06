import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  resolveEdgeSessionState,
} from '@/lib/auth/edge-session';

const PUBLIC_PATHS = ['/login', '/register'];
const ALWAYS_ALLOW_PREFIXES = ['/api', '/_next', '/socket.io', '/favicon', '/icon'];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/invite/')) return true;
  if (pathname.startsWith('/legal/')) return true;
  if (pathname.startsWith('/p/')) return true;
  return false;
}

function redirectToLogin(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

function clearAuthCookies(res: NextResponse) {
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (ALWAYS_ALLOW_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const hasRefreshToken = req.cookies.has(REFRESH_COOKIE);
  const session = await resolveEdgeSessionState(accessToken, hasRefreshToken);
  const isAuthed = session === 'valid' || session === 'refreshable';
  const isPublic = isPublicPath(pathname);

  if (session === 'invalid') {
    const res = redirectToLogin(req, pathname);
    clearAuthCookies(res);
    return res;
  }

  if (!isAuthed && !isPublic) {
    return redirectToLogin(req, pathname);
  }

  if (isAuthed && isPublic && !pathname.startsWith('/legal/') && !pathname.startsWith('/p/')) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
