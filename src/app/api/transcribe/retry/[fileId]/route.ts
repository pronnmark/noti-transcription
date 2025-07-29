import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database/client';
import { processTranscriptionJobs } from '@/lib/services/transcriptionWorker';
import { debugLog } from '@/lib/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);

    if (isNaN(fileIdInt)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const db = getDb();

    // Check if file exists
    const file = await db
      .select()
      .from(audioFiles)
      .where(eq(audioFiles.id, fileIdInt))
      .limit(1);

    if (!file.length) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get the most recent transcription job
    const existingJob = await db
      .select()
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.fileId, fileIdInt))
      .orderBy(desc(transcriptionJobs.createdAt))
      .limit(1);

    if (!existingJob.length) {
      // Create new transcription job if none exists
      await db.insert(transcriptionJobs).values({
        fileId: fileIdInt,
        status: 'pending',
        progress: 0,
        diarizationStatus: 'not_attempted',
        diarization: true,
        lastError: 'Retry requested - creating new job',
      });

      debugLog('api', `Created new transcription job for file ${fileIdInt}`);
    } else {
      // Reset existing job to pending
      await db
        .update(transcriptionJobs)
        .set({
          status: 'pending',
          progress: 0,
          startedAt: null,
          completedAt: null,
          diarizationStatus: 'not_attempted',
          diarizationError: null,
          lastError: 'Retry requested by user',
        })
        .where(eq(transcriptionJobs.id, existingJob[0].id));

      debugLog(
        'api',
        `Reset transcription job ${existingJob[0].id} for file ${fileIdInt}`,
      );
    }

    // Trigger transcription worker asynchronously
    setImmediate(async () => {
      try {
        debugLog(
          'api',
          `Starting transcription retry for file ${fileIdInt}...`,
        );
        const result = await processTranscriptionJobs();
        debugLog('api', 'Transcription worker completed:', result);
      } catch (error) {
        console.error('Error in transcription worker:', error);
      }
    });

    // Get updated job status
    const updatedJob = await db
      .select({
        id: transcriptionJobs.id,
        fileId: transcriptionJobs.fileId,
        status: transcriptionJobs.status,
        progress: transcriptionJobs.progress,
        diarizationStatus: transcriptionJobs.diarizationStatus,
        lastError: transcriptionJobs.lastError,
      })
      .from(transcriptionJobs)
      .where(eq(transcriptionJobs.fileId, fileIdInt))
      .orderBy(desc(transcriptionJobs.createdAt))
      .limit(1);

    return NextResponse.json({
      success: true,
      message: 'Transcription retry initiated',
      job: updatedJob[0],
      file: {
        id: file[0].id,
        fileName: file[0].fileName,
        originalFileName: file[0].originalFileName,
      },
    });
  } catch (error) {
    console.error('Retry transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to retry transcription' },
      { status: 500 },
    );
  }
}
