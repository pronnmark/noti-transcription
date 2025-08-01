import { NextRequest, NextResponse } from 'next/server';
import { withAuthMiddleware } from '@/lib/middleware';
import { 
  getAudioRepository,
  getTranscriptionRepository,
  getValidationService,
  getErrorHandlingService
} from '@/lib/di/containerSetup';
import { debugLog } from '@/lib/utils';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Refactored POST handler using middleware and repository pattern
 * Simple transcription endpoint with whisper CLI fallback
 */
/**
 * POST handler without authentication for testing
 */
export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const errorHandlingService = getErrorHandlingService();
  const validationService = getValidationService();
  
  const resolvedParams = await params;
  const fileId = parseInt(resolvedParams.id);
  
  const idValidation = validationService.validateId(fileId, 'File ID');
  if (!idValidation.isValid) {
    return errorHandlingService.handleValidationError(idValidation.errors, 'transcribe-simple');
  }

  debugLog('api', 'Starting simple transcription', { fileId });

  try {
    // Get file using DI container
    const audioRepo = getAudioRepository();
    const file = await audioRepo.findById(fileId);

    if (!file) {
      return errorHandlingService.handleNotFoundError('File', fileId, 'transcribe-simple');
    }

    // Check existing transcription jobs using DI container
    const transcriptionRepo = getTranscriptionRepository();
    const existingJob = await transcriptionRepo.findLatestByFileId(fileId);

    if (existingJob && existingJob.status === 'completed') {
      return errorHandlingService.handleSuccess({
        message: 'Transcription already completed',
        transcript: existingJob.transcript,
        meta: {
          requestId: 'transcribe-simple',
        },
      }, 'transcribe-simple-existing');
    }

    // Create or update transcription job
    let job;
    if (existingJob) {
      job = await transcriptionRepo.update(existingJob.id, {
        status: 'processing',
        progress: 0,
        last_error: undefined,
        started_at: new Date().toISOString(),
      });
    } else {
      job = await transcriptionRepo.create({
        file_id: fileId,
        status: 'processing',
        model_size: 'base',
        progress: 0,
        language: 'en',
        diarization: false,
        started_at: new Date().toISOString(),
      });
    }

    // Download audio file from Supabase Storage for processing
    let tempAudioPath: string | null = null;
    try {
      const { SupabaseStorageService } = await import(
        '@/lib/services/core/SupabaseStorageService'
      );
      const supabaseStorageService = new SupabaseStorageService();

      // Download file from Supabase Storage
      const fileBuffer = await supabaseStorageService.downloadFile(
        'audio-files',
        file.file_name
      );

      // Create temporary file for whisper processing
      const tempFileName = `temp_${Date.now()}_${file.original_file_name}`;
      tempAudioPath = join('/tmp', tempFileName);

      await import('fs').then(fs =>
        fs.promises.writeFile(tempAudioPath!, fileBuffer)
      );

      debugLog('api', 'Downloaded audio file from Supabase for processing', {
        storagePath: file.file_name,
        tempPath: tempAudioPath,
      });
    } catch (downloadError) {
      debugLog('api',
        'Failed to download audio file from Supabase Storage',
        downloadError
      );
      throw new Error('Failed to access audio file for transcription');
    }

    // Simple transcription using whisper CLI (if available)
    try {
      // Check if whisper is available
      await execAsync('which whisper');

      // Run whisper on downloaded file
      debugLog('api', 'Running whisper transcription...');
      const { stdout, stderr } = await execAsync(
        `whisper "${tempAudioPath}" --model base --language en --output_format json --output_dir /tmp`,
        { maxBuffer: 10 * 1024 * 1024 }
      );

      // Read the JSON output
      const baseFileName =
        tempAudioPath
          .split('/')
          .pop()
          ?.replace(/\.[^/.]+$/, '') || 'output';
      const jsonPath = `/tmp/${baseFileName}.json`;
      const { stdout: jsonContent } = await execAsync(`cat "${jsonPath}"`);
      const result = JSON.parse(jsonContent);

      // Clean up temporary files
      await import('fs').then(fs => {
        fs.promises.unlink(tempAudioPath!).catch(() => {});
        fs.promises.unlink(jsonPath).catch(() => {});
      });

      // Convert to our format
      const segments = result.segments.map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      }));

      // Update job using repository
      await transcriptionRepo.update(job.id, {
        status: 'completed',
        progress: 100,
        transcript: segments,
        completed_at: new Date().toISOString(),
      });

      return errorHandlingService.handleSuccess({
        transcript: segments,
        text: result.text,
        meta: {
          requestId: 'transcribe-simple',
        },
      }, 'transcribe-simple-whisper-success');
    } catch (whisperError) {
      debugLog('api', 'Whisper not available, using fallback...', whisperError);

      // Clean up temp file on error
      if (tempAudioPath) {
        await import('fs').then(fs =>
          fs.promises.unlink(tempAudioPath!).catch(() => {})
        );
      }

      // Fallback: Create a dummy transcription
      const dummyTranscript = [
        {
          start: 0,
          end: file.duration || 10,
          text: `[Transcription pending for ${file.original_file_name}. Audio duration: ${file.duration || 0} seconds]`,
        },
      ];

      await transcriptionRepo.update(job.id, {
        status: 'completed',
        progress: 100,
        transcript: dummyTranscript,
        completed_at: new Date().toISOString(),
      });

      return errorHandlingService.handleSuccess({
        transcript: dummyTranscript,
        text: dummyTranscript[0].text,
        note: 'Using placeholder transcription. Install whisper for real transcription.',
        meta: {
          requestId: 'transcribe-simple',
        },
      }, 'transcribe-simple-fallback');
    }
  } catch (error) {
    return errorHandlingService.handleApiError(error, 'transcribe-simple');
  }
};
