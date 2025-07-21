import { NextRequest, NextResponse } from 'next/server';
import { notesService } from "@/lib/db"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { comment } = await request.json();
    const { id } = await params;
    
    if (!comment || typeof comment !== 'string') {
      return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
    }

    const success = await notesService.addComment(id, comment.trim());
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { comment } = await request.json();
    const { id } = await params;
    
    if (!comment || typeof comment !== 'string') {
      return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
    }

    const success = await notesService.updateComment(id, comment.trim());
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}