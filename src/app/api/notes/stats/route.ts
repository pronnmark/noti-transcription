import { NextRequest, NextResponse } from 'next/server';
import { withAuthMiddleware } from '@/lib/middleware';
import { ExtractionRepository } from '@/lib/database/repositories';
import { debugLog } from '@/lib/utils';

export const GET = withAuthMiddleware(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    const extractionRepo = new ExtractionRepository();
    const notes = await extractionRepo.findByFileId(parseInt(fileId));

    const stats = {
      total: notes.length,
      active: notes.filter(n => n.status === 'active').length,
      completed: notes.filter(n => n.status === 'completed').length,
      archived: notes.filter(n => n.status === 'archived').length,
      byPriority: {
        high: notes.filter(n => n.priority === 'high').length,
        medium: notes.filter(n => n.priority === 'medium').length,
        low: notes.filter(n => n.priority === 'low').length,
      },
      recentActivity: notes
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5)
        .map(n => ({
          id: n.id,
          content: n.content.substring(0, 100),
          status: n.status,
          updatedAt: n.updatedAt,
        })),
    };

    return NextResponse.json(stats);
  } catch (error) {
    debugLog('api', 'Error getting stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
