import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'noti-secret-key-change-in-production'
);

export async function createSession(): Promise<string> {
  // Create JWT token
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Token expires in 7 days
    .sign(JWT_SECRET);

  return token;
}

export async function validateSession(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  
  try {
    // Verify JWT token
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch (error) {
    return false;
  }
}

export async function deleteSession(token: string): Promise<void> {
  // JWT tokens are stateless, so we don't need to delete anything
  // Session invalidation is handled by clearing the cookie
}

export async function getSessionFromRequest(request: NextRequest): Promise<string | null> {
  // Check cookie first - use the same cookie name as middleware
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('auth-token');
  if (sessionCookie?.value) return sessionCookie.value;
  
  // Check Authorization header as fallback
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

export async function requireAuth(request: NextRequest): Promise<boolean> {
  const token = await getSessionFromRequest(request);
  return await validateSession(token);
}

// Helper to set session cookie
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  });
}

// Helper to clear session cookie
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
}