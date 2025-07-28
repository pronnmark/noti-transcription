import { NextRequest, NextResponse } from 'next/server';
import { withAuthMiddleware, createApiResponse, createErrorResponse } from '@/lib/middleware';
import { RepositoryFactory } from '@/lib/database/repositories';
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
  return withAuthMiddleware(async (req: NextRequest, context) => {
    const startTime = Date.now();
    
    try {
      const resolvedParams = await params;
      const fileId = parseInt(resolvedParams.id);
      
      if (isNaN(fileId)) {
        return NextResponse.json(
          createErrorResponse('Invalid file ID', 'INVALID_FILE_ID', 400),
          { status: 400 }
        );
      }

      debugLog('api', 'Starting transcription for file', { fileId, requestId: context.requestId });

      // Get repositories
      const audioRepo = RepositoryFactory.audioRepository;
      const transcriptionRepo = RepositoryFactory.transcriptionRepository;

      // Get file from database using repository
      const file = await audioRepo.findById(fileId);
      if (!file) {
        return NextResponse.json(
          createErrorResponse('File not found', 'FILE_NOT_FOUND', 404),
          { status: 404 }
        );
      }

      // Check if transcription job already exists
      const existingJob = await transcriptionRepo.findLatestByFileId(fileId);
      if (existingJob && existingJob.status !== 'failed') {
        return NextResponse.json(
          createApiResponse({
            message: 'Transcription already exists',
            job: existingJob,
          }, {
            meta: {
              requestId: context.requestId,
              duration: Date.now() - startTime,
            }
          })
        );
      }

      // Create transcription job using repository
      const job = await transcriptionRepo.create({
        fileId: fileId,
        language: 'auto',
        modelSize: 'large-v3',
        diarization: true,
        speakerCount: undefined,
        status: 'processing',
        progress: 0,
        startedAt: new Date(),
      });

      // Start transcription in background (fire and forget)
      transcribeInBackground(file, job.id).catch(error => {
        debugLog('api', 'Background transcription failed:', error);
      });

      return NextResponse.json(
        createApiResponse({
          success: true,
          message: 'Transcription started',
          jobId: job.id,
        }, {
          meta: {
            requestId: context.requestId,
            duration: Date.now() - startTime,
          }
        })
      );

    } catch (error: any) {
      debugLog('api', 'Transcribe error:', error);
      throw error; // Let middleware handle the error
    }
  }, {
    logging: {
      enabled: true,
      logRequests: true,
      logResponses: true,
    },
    errorHandling: {
      enabled: true,
      sanitizeErrors: true,
    },
  })(request);
}

async function transcribeInBackground(file: any, jobId: number) {
  const transcriptionRepo = RepositoryFactory.transcriptionRepository;

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
      await execAsync(`ffmpeg -i "${audioPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavPath}" -y`);
    }

    // Update progress
    await transcriptionRepo.updateProgress(jobId, 30);

    // Run Whisper transcription using Python script
    const pythonScript = join(process.cwd(), 'scripts', 'transcribe.py');
    debugLog('worker', 'Running transcription...', { pythonScript, wavPath });

    const { stdout, stderr } = await execAsync(
      `python3 "${pythonScript}" "${wavPath}" --model base --language en`,
      { maxBuffer: 10 * 1024 * 1024 }, // 10MB buffer
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
    const transcriptSegments = transcript.segments || [{ 
      text: transcript.text || stdout.trim(), 
      start: 0, 
      end: 0 
    }];

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
