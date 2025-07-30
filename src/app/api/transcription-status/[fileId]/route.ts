import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/client';
import type { TranscriptionJob, AudioFile } from '@/lib/database/client';
import {
  getSessionTokenFromRequest,
  unauthorizedResponse,
} from '@/lib/auth-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Note: Authentication now handled by middleware, so this endpoint is public
    // This allows the recording page to poll without requiring auth headers

    const { fileId: fileIdParam } = await params;
    const fileId = parseInt(fileIdParam);

    if (!fileId || isNaN(fileId)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get the most recent transcription job for this file with audio file info
    const { data: jobs, error } = await supabase
      .from('transcription_jobs')
      .select(
        `
        id,
        status,
        progress,
        started_at,
        completed_at,
        last_error,
        speaker_count,
        diarization_status,
        transcript,
        created_at,
        audio_files!inner (
          original_file_name
        )
      `
      )
      .eq('file_id', fileId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json(
        { error: 'Failed to query transcription status' },
        { status: 500 }
      );
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json(
        { error: 'No transcription job found for this file' },
        { status: 404 }
      );
    }

    const job = jobs[0];

    // Calculate estimated time remaining (rough estimate)
    let estimatedTimeRemaining: number | null = null;
    if (
      job.status === 'processing' &&
      job.started_at &&
      job.progress &&
      job.progress > 0
    ) {
      const elapsedMs = Date.now() - new Date(job.started_at).getTime();
      const progressDecimal = job.progress / 100;
      const totalEstimatedMs = elapsedMs / progressDecimal;
      estimatedTimeRemaining = Math.max(0, totalEstimatedMs - elapsedMs);
    }

    // Format response
    const response = {
      status: job.status as 'pending' | 'processing' | 'completed' | 'failed',
      progress: job.progress || 0,
      transcript: job.status === 'completed' ? job.transcript : null,
      error: job.status === 'failed' ? job.last_error : null,
      speakerCount: job.speaker_count,
      diarizationStatus: job.diarization_status,
      estimatedTimeRemaining: estimatedTimeRemaining
        ? Math.round(estimatedTimeRemaining / 1000)
        : null, // in seconds
      fileName: (job.audio_files as any)?.original_file_name,
      jobId: job.id,
      startedAt: job.started_at,
      completedAt: job.completed_at,
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
