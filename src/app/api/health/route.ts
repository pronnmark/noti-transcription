import { NextResponse } from 'next/server';
import { healthCheck } from '@/lib/database/client';

export async function GET() {
  try {
    const databaseHealthy = await healthCheck();
    
    return NextResponse.json({
      status: databaseHealthy ? 'healthy' : 'degraded',
      service: 'noti-nextjs',
      version: process.env.APP_VERSION || '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        supabase: databaseHealthy ? 'connected' : 'disconnected',
        healthy: databaseHealthy
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      service: 'noti-nextjs',
      version: process.env.APP_VERSION || '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        supabase: 'error',
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 503 });
  }
}
