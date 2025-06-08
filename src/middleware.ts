
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get('auth_token')?.value;
  const expectedAuthToken = process.env.AUTH_COOKIE_VALUE;
  const { pathname } = request.nextUrl;

  // Allow access to the login page and public assets unconditionally
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next/') || // Next.js specific assets
    pathname.startsWith('/static/') || // If you have a /public/static folder
    pathname.includes('.') // Generally allows files with extensions (images, css, js)
  ) {
    return NextResponse.next();
  }
  
  const isAuthenticated = authToken === expectedAuthToken;

  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    // Optionally, add a query param to show a message, e.g., loginUrl.searchParams.set('error', 'session_expired');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Match all request paths except for API routes or specific static files if needed.
// This configuration is a common starting point.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ],
};
