import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database/client';
import { transcriptionJobs, audioFiles } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';
import { getSessionTokenFromRequest, unauthorizedResponse } from '@/lib/auth-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Check authentication
    const sessionToken = getSessionTokenFromRequest(request);
    if (!sessionToken) {
      return unauthorizedResponse();
    }

    const { fileId: fileIdParam } = await params;
    const fileId = parseInt(fileIdParam);
    
    if (!fileId || isNaN(fileId)) {
      return NextResponse.json(
        { error: 'Invalid file ID' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Get the most recent transcription job for this file
    const jobs = await db
      .select({
        id: transcriptionJobs.id,
        status: transcriptionJobs.status,
        progress: transcriptionJobs.progress,
        startedAt: transcriptionJobs.startedAt,
        completedAt: transcriptionJobs.completedAt,
        lastError: transcriptionJobs.lastError,
        speakerCount: transcriptionJobs.speakerCount,
        diarizationStatus: transcriptionJobs.diarizationStatus,
        transcript: transcriptionJobs.transcript,
        fileName: audioFiles.originalFileName,
      })
      .from(transcriptionJobs)
      .innerJoin(audioFiles, eq(transcriptionJobs.fileId, audioFiles.id))
      .where(eq(transcriptionJobs.fileId, fileId))
      .orderBy(transcriptionJobs.createdAt)
      .limit(1);

    if (jobs.length === 0) {
      return NextResponse.json(
        { error: 'No transcription job found for this file' },
        { status: 404 }
      );
    }

    const job = jobs[0];

    // Calculate estimated time remaining (rough estimate)
    let estimatedTimeRemaining: number | null = null;
    if (job.status === 'processing' && job.startedAt && job.progress > 0) {
      const elapsedMs = Date.now() - new Date(job.startedAt).getTime();
      const progressDecimal = job.progress / 100;
      const totalEstimatedMs = elapsedMs / progressDecimal;
      estimatedTimeRemaining = Math.max(0, totalEstimatedMs - elapsedMs);
    }

    // Format response
    const response = {
      status: job.status as 'pending' | 'processing' | 'completed' | 'failed',
      progress: job.progress || 0,
      transcript: job.status === 'completed' ? job.transcript : null,
      error: job.status === 'failed' ? job.lastError : null,
      speakerCount: job.speakerCount,
      diarizationStatus: job.diarizationStatus,
      estimatedTimeRemaining: estimatedTimeRemaining ? Math.round(estimatedTimeRemaining / 1000) : null, // in seconds
      fileName: job.fileName,
      jobId: job.id,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Transcription status error:', error);
    return NextResponse.json(
      { error: 'Failed to get transcription status' },
      { status: 500 }
    );
  }
}