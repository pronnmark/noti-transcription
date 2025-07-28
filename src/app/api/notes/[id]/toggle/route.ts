import { NextRequest, NextResponse } from 'next/server';
import { withAuthMiddleware } from '@/lib/middleware';
import { ExtractionRepository } from '@/lib/database/repositories';
import { debugLog } from '@/lib/utils';

export const POST = withAuthMiddleware(async (
  request: NextRequest,
  context,
) => {
  try {
    const { status } = await request.json();
    
    // Extract ID from URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const id = pathSegments[pathSegments.length - 2]; // Get id from URL path

    if (!status || !['active', 'completed', 'archived'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const extractionRepo = new ExtractionRepository();
    const success = await extractionRepo.update(id, { status });

    if (!success) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    debugLog('api', 'Error toggling status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
