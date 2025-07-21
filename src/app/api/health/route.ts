import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'noti-nextjs',
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}