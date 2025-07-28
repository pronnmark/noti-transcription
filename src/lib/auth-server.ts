import { NextRequest } from 'next/server';

/**
 * Server-side authentication utilities for API routes
 * Extracts session token from request headers or cookies
 */
export function getSessionTokenFromRequest(request: NextRequest): string | null {
  // Check multiple sources for the session token, matching middleware logic
  const sessionToken = 
    request.cookies.get('auth-token')?.value ||
    request.headers.get('x-session-token') ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  return sessionToken || null;
}

/**
 * Validates if a request is authenticated
 */
export function isAuthenticatedRequest(request: NextRequest): boolean {
  return !!getSessionTokenFromRequest(request);
}

/**
 * Returns an unauthorized response for API routes
 */
export function unauthorizedResponse(message: string = 'Authentication required') {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}