import { NextRequest, NextResponse } from 'next/server';
import { withAuthMiddleware } from '@/lib/middleware';
import { ExtractionRepository } from '@/lib/database/repositories';
import { debugLog } from '@/lib/utils';

export const POST = withAuthMiddleware(async (
  request: NextRequest,
  context,
) => {
  try {
    const { comment } = await request.json();
    
    // Extract ID from URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const id = pathSegments[pathSegments.length - 2]; // Get id from URL path

    if (!comment || typeof comment !== 'string') {
      return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
    }

    const extractionRepo = new ExtractionRepository();
    const existing = await extractionRepo.findById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const currentComments = existing.comments || '';
    const newComments = currentComments
      ? `${currentComments}\n---\n${comment.trim()}`
      : comment.trim();

    const success = await extractionRepo.update(id, { comments: newComments });

    if (!success) {
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    debugLog('api', 'Error adding comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const PATCH = withAuthMiddleware(async (
  request: NextRequest,
  context,
) => {
  try {
    const { comment } = await request.json();
    
    // Extract ID from URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const id = pathSegments[pathSegments.length - 2]; // Get id from URL path

    if (!comment || typeof comment !== 'string') {
      return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
    }

    const extractionRepo = new ExtractionRepository();
    const success = await extractionRepo.update(id, { comments: comment.trim() });

    if (!success) {
      return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    debugLog('api', 'Error updating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
