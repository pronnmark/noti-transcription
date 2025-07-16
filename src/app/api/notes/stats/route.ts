import { NextRequest, NextResponse } from 'next/server';
import { notesService } from '@/lib/db/notesService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const stats = await notesService.getStats(parseInt(fileId));
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}