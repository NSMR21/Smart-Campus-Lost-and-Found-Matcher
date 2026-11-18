// Runs before every page request: signed-out visitors are sent to /login.
// (This is only an optimistic check of the JWT; each page and API route
// still verifies the user and their permissions against the database.)
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './lib/session.js';

const PUBLIC_PATHS = ['/login', '/register'];

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!session && !isPublic) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (session && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // every page except API routes, Next.js internals and static files
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
