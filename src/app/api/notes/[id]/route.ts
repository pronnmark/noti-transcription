import { NextRequest, NextResponse } from 'next/server';
import { withAuthMiddleware } from '@/lib/middleware';
import { ExtractionRepository } from '@/lib/database/repositories';
import { debugLog } from '@/lib/utils';

// DELETE /api/notes/:id
export const DELETE = withAuthMiddleware(
  async (request: NextRequest, context) => {
    try {
      // Extract ID from URL path
      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/');
      const id = pathSegments[pathSegments.length - 1]; // Get id from URL path
      const extractionRepo = new ExtractionRepository();

      const success = await extractionRepo.delete(id);
      if (!success) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      debugLog('api', 'DELETE error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  },
);

// PATCH /api/notes/:id
export const PATCH = withAuthMiddleware(
  async (request: NextRequest, context) => {
    try {
      // Extract ID from URL path
      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/');
      const id = pathSegments[pathSegments.length - 1]; // Get id from URL path
      const updates = await request.json();
      const extractionRepo = new ExtractionRepository();

      const updated = await extractionRepo.update(id, updates);
      if (!updated) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, note: updated });
    } catch (error) {
      debugLog('api', 'PATCH error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  },
);
