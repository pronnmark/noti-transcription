import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/database/client';
import { processTranscriptionJobs } from '@/lib/services/transcriptionWorker';
import { debugLog } from '@/lib/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const fileIdInt = parseInt(fileId);

    if (isNaN(fileIdInt)) {
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check if file exists
    const { data: files, error: fileError } = await supabase
      .from('audio_files')
      .select('*')
      .eq('id', fileIdInt)
      .limit(1);

    if (fileError || !files || files.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const file = files[0];

    // Get the most recent transcription job
    const { data: existingJobs, error: jobError } = await supabase
      .from('transcription_jobs')
      .select('*')
      .eq('file_id', fileIdInt)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!existingJobs || existingJobs.length === 0) {
      // Create new transcription job if none exists
      const { error: insertError } = await supabase
        .from('transcription_jobs')
        .insert({
          file_id: fileIdInt,
          status: 'pending',
          progress: 0,
          diarization_status: 'not_attempted',
          diarization: true,
          last_error: 'Retry requested - creating new job',
        });

      if (insertError) {
        throw new Error(
          `Failed to create transcription job: ${insertError.message}`
        );
      }

      debugLog('api', `Created new transcription job for file ${fileIdInt}`);
    } else {
      // Reset existing job to pending
      const { error: updateError } = await supabase
        .from('transcription_jobs')
        .update({
          status: 'pending',
          progress: 0,
          started_at: null,
          completed_at: null,
          diarization_status: 'not_attempted',
          diarization_error: null,
          last_error: 'Retry requested by user',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingJobs[0].id);

      if (updateError) {
        throw new Error(
          `Failed to reset transcription job: ${updateError.message}`
        );
      }

      debugLog(
        'api',
        `Reset transcription job ${existingJobs[0].id} for file ${fileIdInt}`
      );
    }

    // Trigger transcription worker asynchronously
    setImmediate(async () => {
      try {
        debugLog(
          'api',
          `Starting transcription retry for file ${fileIdInt}...`
        );
        const result = await processTranscriptionJobs();
        debugLog('api', 'Transcription worker completed:', result);
      } catch (error) {
        console.error('Error in transcription worker:', error);
      }
    });

    // Get updated job status
    const { data: updatedJobs, error: updatedJobError } = await supabase
      .from('transcription_jobs')
      .select('id, file_id, status, progress, diarization_status, last_error')
      .eq('file_id', fileIdInt)
      .order('created_at', { ascending: false })
      .limit(1);

    if (updatedJobError) {
      throw new Error(
        `Failed to fetch updated job: ${updatedJobError.message}`
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Transcription retry initiated',
      job: updatedJobs?.[0],
      file: {
        id: file.id,
        fileName: file.file_name,
        originalFileName: file.original_file_name,
      },
    });
  } catch (error) {
    console.error('Retry transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to retry transcription' },
      { status: 500 }
    );
  }
}
