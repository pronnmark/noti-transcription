import { NextRequest, NextResponse } from 'next/server';
import { withAuthMiddleware } from '@/lib/middleware';
import { 
  getAudioRepository,
  getTranscriptionRepository,
  getValidationService,
  getErrorHandlingService
} from '@/lib/di/containerSetup';
import { debugLog } from '@/lib/utils/debug';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuthMiddleware(
    async (req: NextRequest, context) => {
      const errorHandlingService = getErrorHandlingService();
      const validationService = getValidationService();
      const startTime = Date.now();

      try {
        const resolvedParams = await params;
        const fileId = parseInt(resolvedParams.id);

        // Validate file ID
        const idValidation = validationService.validateId(fileId, 'File ID');
        if (!idValidation.isValid) {
          return errorHandlingService.handleValidationError(idValidation.errors, 'transcribe');
        }

        debugLog('api', 'Starting transcription for file', {
          fileId,
          requestId: context.requestId,
        });

        // Get repositories using DI container
        const audioRepo = getAudioRepository();
        const transcriptionRepo = getTranscriptionRepository();

        // Get file from database using repository
        const file = await audioRepo.findById(fileId);
        if (!file) {
          return errorHandlingService.handleNotFoundError('File', fileId, 'transcribe');
        }

        // Check if transcription job already exists
        const existingJob = await transcriptionRepo.findLatestByFileId(fileId);
        if (existingJob && existingJob.status !== 'failed') {
          return errorHandlingService.handleSuccess({
            message: 'Transcription already exists',
            job: existingJob,
            meta: {
              requestId: context.requestId,
              duration: Date.now() - startTime,
            },
          }, 'transcribe-existing');
        }

        // Create transcription job using repository
        const job = await transcriptionRepo.create({
          file_id: fileId,
          language: 'auto',
          model_size: 'large-v3',
          diarization: true,
          speaker_count: undefined,
          status: 'processing',
          progress: 0,
          started_at: new Date().toISOString(),
        });

        // Start transcription in background (fire and forget)
        transcribeInBackground(file, job.id).catch(error => {
          debugLog('api', 'Background transcription failed:', error);
        });

        return errorHandlingService.handleSuccess({
          message: 'Transcription started',
          jobId: job.id,
          meta: {
            requestId: context.requestId,
            duration: Date.now() - startTime,
          },
        }, 'transcribe-started');
      } catch (error: any) {
        return errorHandlingService.handleApiError(error, 'transcribe');
      }
    },
    {
      logging: {
        enabled: true,
        logRequests: true,
        logResponses: true,
      },
      errorHandling: {
        enabled: true,
        sanitizeErrors: true,
      },
    }
  )(request);
}

async function transcribeInBackground(file: any, jobId: number) {
  const transcriptionRepo = getTranscriptionRepository();

  try {
    // Update job status to processing
    await transcriptionRepo.updateProgress(jobId, 10, 'processing');

    // Path to audio file
    const audioPath = join(process.cwd(), 'data', 'audio_files', file.fileName);

    // Check if file exists
    await fs.access(audioPath);

    // Convert to WAV if needed (Whisper works better with WAV)
    const wavPath = audioPath.replace(/\.[^/.]+$/, '.wav');
    if (!audioPath.endsWith('.wav')) {
      debugLog('worker', 'Converting to WAV...', { audioPath, wavPath });
      await execAsync(
        `ffmpeg -i "${audioPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}" -y`
      );
    }

    // Update progress
    await transcriptionRepo.updateProgress(jobId, 30);

    // Run Whisper transcription using Python script
    const pythonScript = join(process.cwd(), 'scripts', 'transcribe.py');
    debugLog('worker', 'Running transcription...', { pythonScript, wavPath });

    const { stdout, stderr } = await execAsync(
      `python3 "${pythonScript}" "${wavPath}" --model base --language en`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
    );

    if (stderr) {
      debugLog('worker', 'Transcription warnings:', stderr);
    }

    // Parse transcription result (assuming JSON output)
    let transcript;
    try {
      transcript = JSON.parse(stdout);
    } catch (e) {
      // If not JSON, treat as plain text
      transcript = { text: stdout.trim(), segments: [] };
    }

    // Update job with results using repository
    const transcriptSegments = transcript.segments || [
      {
        text: transcript.text || stdout.trim(),
        start: 0,
        end: 0,
      },
    ];

    await transcriptionRepo.updateWithResults(jobId, {
      status: 'completed',
      progress: 100,
      transcript: transcriptSegments,
      completedAt: new Date(),
    });

    debugLog('worker', 'Transcription completed for job:', jobId);

    // Clean up WAV file if we created it
    if (!audioPath.endsWith('.wav')) {
      await fs.unlink(wavPath).catch(() => {});
    }
  } catch (error) {
    debugLog('worker', 'Transcription error:', error);

    // Update job status to failed using repository
    await transcriptionRepo.updateWithError(jobId, {
      status: 'failed',
      lastError: error instanceof Error ? error.message : 'Unknown error',
      completedAt: new Date(),
    });
  }
}
