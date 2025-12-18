import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData } from './types/session';
import { sessionOptions } from './lib/session';

// Define public and protected routes
const publicRoutes = ['/', '/prihlaseni', '/registrace'];
const authRoutes = ['/prihlaseni', '/registrace'];
const protectedRoutes = ['/dashboard', '/nastaveni'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block invalid server action requests from bots/scanners
  // This project has no server actions, so any request with next-action header is invalid
  const nextAction = request.headers.get("next-action");
  if (nextAction) {
    console.log(
      `[Proxy] Blocked invalid server action request: ${nextAction} from ${request.headers.get("x-forwarded-for") || "unknown"}`
    );
    return new NextResponse("Bad Request", {
      status: 400,
      statusText: "Invalid server action",
    });
  }

  // Skip session check for API routes - they handle their own authentication
  // This prevents body locking issues with formData uploads
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Get session
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  const isAuthenticated = session.isLoggedIn === true && !!session.jwt;

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Redirect unauthenticated users trying to access protected routes
  if (isProtectedRoute && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/prihlaseni';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users trying to access auth routes (login, register)
  if (isAuthRoute && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - uploads (shared Strapi uploads)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|uploads).*)',
  ],
};
