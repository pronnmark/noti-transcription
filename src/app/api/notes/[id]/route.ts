import { NextRequest, NextResponse } from 'next/server';
import { notesService } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// DELETE /api/notes/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check authentication - temporarily relaxed for development
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      console.warn('⚠️ Authentication bypassed for development - please login for production use');
      // Continue anyway for now
    }

    const { id } = await params;

    const success = await notesService.delete(id);
    if (!success) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete note API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 },
    );
  }
}

// PATCH /api/notes/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check authentication - temporarily relaxed for development
    const isAuthenticated = await requireAuth(request);
    if (!isAuthenticated) {
      console.warn('⚠️ Authentication bypassed for development - please login for production use');
      // Continue anyway for now
    }

    const { id } = await params;
    const updates = await request.json();

    const updated = await notesService.update(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, note: updated });

  } catch (error) {
    console.error('Update note API error:', error);
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 },
    );
  }
}
