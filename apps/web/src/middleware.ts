import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];
const ALWAYS_ALLOW_PREFIXES = ['/api', '/_next', '/socket.io', '/favicon', '/icon'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (ALWAYS_ALLOW_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasAccessToken = req.cookies.has('sydt_at');
  const hasRefreshToken = req.cookies.has('sydt_rt');
  const isAuthed = hasAccessToken || hasRefreshToken;

  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!isAuthed && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (isAuthed && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
