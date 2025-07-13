import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const sessions = new Map<string, { createdAt: number }>();
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function createSession(): Promise<string> {
  const token = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessions.set(token, { createdAt: Date.now() });
  return token;
}

export async function validateSession(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  
  const session = sessions.get(token);
  if (!session) return false;
  
  // Check if session is expired
  if (Date.now() - session.createdAt > SESSION_DURATION) {
    sessions.delete(token);
    return false;
  }
  
  return true;
}

export async function deleteSession(token: string): Promise<void> {
  sessions.delete(token);
}

export async function getSessionFromRequest(request: NextRequest): Promise<string | null> {
  // Check cookie first
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
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
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/'
  });
}

// Helper to clear session cookie
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}