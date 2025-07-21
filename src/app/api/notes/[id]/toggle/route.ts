import { NextRequest, NextResponse } from 'next/server';
import { notesService } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { status } = await request.json();
    const { id } = await params;

    if (!status || !['active', 'completed', 'archived'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const success = await notesService.toggleStatus(id, status);

    if (!success) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Error toggling status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
