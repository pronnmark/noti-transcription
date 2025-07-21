import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow access to these paths without authentication
  if (
    pathname === '/' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next();
  }

  // Check for authentication token in various places
  const sessionToken = request.cookies.get('noti-session')?.value || 
                      request.headers.get('x-session-token') ||
                      request.headers.get('authorization')?.replace('Bearer ', '');

  // Skip auth check for certain API endpoints that might be called before auth
  const publicApiEndpoints = ['/api/health', '/api/auth'];
  const isPublicApi = publicApiEndpoints.some(endpoint => pathname.startsWith(endpoint));
  
  if (isPublicApi) {
    return NextResponse.next();
  }

  // For authenticated requests, we could verify the token here
  // For now, we trust the client-side authentication
  // In a more secure setup, you'd verify the token against a database
  
  if (!sessionToken) {
    // Check if this is an API request
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Redirect to login page for non-API requests
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.ico$).*)',
  ],
};