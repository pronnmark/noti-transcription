import { NextRequest, NextResponse } from 'next/server';
import { withAuthMiddleware } from '@/lib/middleware';
import { ExtractionRepository } from '@/lib/database/repositories';
import { debugLog } from '@/lib/utils';

export const GET = withAuthMiddleware(async (request: NextRequest) => {
  try {
    const extractionRepo = new ExtractionRepository();
    const allNotes = await extractionRepo.findAll();

    const stats = {
      total: allNotes.length,
      active: allNotes.filter(n => n.status === 'active').length,
      completed: allNotes.filter(n => n.status === 'completed').length,
      archived: allNotes.filter(n => n.status === 'archived').length,
      byPriority: {
        high: allNotes.filter(n => n.priority === 'high').length,
        medium: allNotes.filter(n => n.priority === 'medium').length,
        low: allNotes.filter(n => n.priority === 'low').length,
      },
      recentActivity: allNotes
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10)
        .map(n => ({
          id: n.id,
          content: n.content.substring(0, 100),
          status: n.status,
          fileId: n.fileId,
          updatedAt: n.updatedAt,
        })),
      completionRate: allNotes.length > 0
        ? Math.round((allNotes.filter(n => n.status === 'completed').length / allNotes.length) * 100)
        : 0,
    };

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    debugLog('api', 'Error fetching global stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch global stats' },
      { status: 500 },
    );
  }
});
