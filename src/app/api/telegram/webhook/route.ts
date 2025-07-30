import { NextRequest, NextResponse } from 'next/server';

// Telegram webhook endpoint temporarily disabled during migration
// This endpoint needs to be converted from Drizzle ORM to Supabase

export async function POST(request: NextRequest) {
  console.warn(
    'Telegram webhook endpoint is temporarily disabled during migration'
  );

  return NextResponse.json(
    {
      success: false,
      error: 'Telegram webhook is temporarily disabled',
      message: 'This feature is being migrated to use Supabase',
    },
    { status: 503 } // Service Unavailable
  );
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'disabled',
    message: 'Telegram webhook is temporarily disabled during migration',
  });
}
