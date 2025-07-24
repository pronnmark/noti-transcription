import { NextRequest, NextResponse } from 'next/server';

// Debug logging (can be disabled by setting DEBUG_API=false)
const DEBUG_API = process.env.DEBUG_API !== 'false';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_API) {
    console.log(...args);
  }
};

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    // Get password from environment variable
    const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'ddash';

    if (password === AUTH_PASSWORD) {
      // Generate a simple session token
      const sessionToken = Buffer.from(`noti-session-${Date.now()}-${Math.random()}`).toString('base64');

      return NextResponse.json({
        success: true,
        sessionToken,
        message: 'Authentication successful',
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Invalid password',
      }, { status: 401 });
    }
  } catch (error) {
    debugLog('Auth error:', error);
    return NextResponse.json({
      success: false,
      message: 'Authentication failed',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Auth endpoint - use POST to authenticate',
  });
}
