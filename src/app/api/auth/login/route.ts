import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import { debugLog } from '@/lib/utils';

// Get password from environment variable or use default
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'ddash';
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'noti-secret-key-change-in-production',
);

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Check password
    if (password !== AUTH_PASSWORD) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Create JWT token
    const token = await new SignJWT({ authenticated: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d') // Token expires in 7 days
      .sign(JWT_SECRET);

    // Set cookie with consistent name for middleware compatibility
    const cookieStore = await cookies();
    cookieStore.set('noti-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    debugLog('api', 'Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
