import { NextResponse } from 'next/server';
import { areServicesInitialized } from '../../../lib/services';

export async function GET() {
  try {
    const initialized = areServicesInitialized();

    return NextResponse.json({
      servicesInitialized: initialized,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      servicesInitialized: false,
    }, { status: 500 });
  }
}
