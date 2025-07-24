import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '../../../../../lib/auth';
import { getDb } from '../../../../../lib/database/client';
import { transcriptionJobs } from '../../../../../lib/database/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check auth
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!await validateSession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const fileId = parseInt(resolvedParams.id);
    if (isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    // Get transcription job
    const db = getDb();
    const [job] = await db.select()
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.fileId, fileId))
      .limit(1);

    if (!job) {
      return NextResponse.json({
        exists: false,
        message: 'No transcription job found for this file',
      });
    }

    return NextResponse.json({
      exists: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        modelSize: job.modelSize,
        diarization: job.diarization,
        transcript: job.transcript,
        lastError: job.lastError,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      },
    });

  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to check status',
    }, { status: 500 });
  }
}
