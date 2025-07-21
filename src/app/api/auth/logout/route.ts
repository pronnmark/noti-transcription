import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  // Clear the session cookie (consistent with login and middleware)
  const cookieStore = await cookies();
  cookieStore.delete('noti-session');

  return NextResponse.json({ success: true });
}
