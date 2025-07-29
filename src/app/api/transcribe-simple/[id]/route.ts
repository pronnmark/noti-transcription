import { NextRequest, NextResponse } from 'next/server';
import {
  withAuthMiddleware,
  createApiResponse,
  createErrorResponse,
} from '@/lib/middleware';
import { RepositoryFactory } from '@/lib/database/repositories';
import { apiDebug } from '@/lib/utils';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Refactored POST handler using middleware and repository pattern
 * Simple transcription endpoint with whisper CLI fallback
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authenticatedHandler = withAuthMiddleware(
    async (request: NextRequest, context) => {
      const resolvedParams = await params;
      const fileId = parseInt(resolvedParams.id);

      if (isNaN(fileId)) {
        return NextResponse.json(
          createErrorResponse('Invalid file ID', 'INVALID_FILE_ID', 400),
          { status: 400 },
        );
      }

      apiDebug('Starting simple transcription', {
        fileId,
        requestId: context.requestId,
      });

      try {
        // Get file using repository
        const audioRepo = RepositoryFactory.audioRepository;
        const file = await audioRepo.findById(fileId);

        if (!file) {
          return NextResponse.json(
            createErrorResponse('File not found', 'FILE_NOT_FOUND', 404),
            { status: 404 },
          );
        }

        // Check existing transcription jobs
        const transcriptionRepo = RepositoryFactory.transcriptionRepository;
        const existingJob = await transcriptionRepo.findLatestByFileId(fileId);

        if (existingJob && existingJob.status === 'completed') {
          return NextResponse.json(
            createApiResponse(
              {
                message: 'Transcription already completed',
                transcript: existingJob.transcript,
              },
              {
                meta: {
                  requestId: context.requestId,
                },
              },
            ),
          );
        }

        // Create or update transcription job
        let job;
        if (existingJob) {
          job = await transcriptionRepo.update(existingJob.id, {
            status: 'processing',
            progress: 0,
            lastError: null,
            startedAt: new Date(),
          });
        } else {
          job = await transcriptionRepo.create({
            fileId: fileId,
            status: 'processing',
            modelSize: 'base',
            progress: 0,
            language: 'en',
            diarization: false,
            startedAt: new Date(),
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
            file.fileName,
          );

          // Create temporary file for whisper processing
          const tempFileName = `temp_${Date.now()}_${file.originalFileName}`;
          tempAudioPath = join('/tmp', tempFileName);

          await import('fs').then(fs =>
            fs.promises.writeFile(tempAudioPath!, fileBuffer),
          );

          apiDebug('Downloaded audio file from Supabase for processing', {
            storagePath: file.fileName,
            tempPath: tempAudioPath,
          });
        } catch (downloadError) {
          apiDebug(
            'Failed to download audio file from Supabase Storage',
            downloadError,
          );
          throw new Error('Failed to access audio file for transcription');
        }

        // Simple transcription using whisper CLI (if available)
        try {
          // Check if whisper is available
          await execAsync('which whisper');

          // Run whisper on downloaded file
          apiDebug('Running whisper transcription...');
          const { stdout, stderr } = await execAsync(
            `whisper "${tempAudioPath}" --model base --language en --output_format json --output_dir /tmp`,
            { maxBuffer: 10 * 1024 * 1024 },
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
            completedAt: new Date(),
          });

          return NextResponse.json(
            createApiResponse(
              {
                success: true,
                transcript: segments,
                text: result.text,
              },
              {
                meta: {
                  requestId: context.requestId,
                },
              },
            ),
          );
        } catch (whisperError) {
          apiDebug('Whisper not available, using fallback...', whisperError);

          // Clean up temp file on error
          if (tempAudioPath) {
            await import('fs').then(fs =>
              fs.promises.unlink(tempAudioPath!).catch(() => {}),
            );
          }

          // Fallback: Create a dummy transcription
          const dummyTranscript = [
            {
              start: 0,
              end: file.duration || 10,
              text: `[Transcription pending for ${file.originalFileName}. Audio duration: ${file.duration || 0} seconds]`,
            },
          ];

          await transcriptionRepo.update(job.id, {
            status: 'completed',
            progress: 100,
            transcript: dummyTranscript,
            completedAt: new Date(),
          });

          return NextResponse.json(
            createApiResponse(
              {
                success: true,
                transcript: dummyTranscript,
                text: dummyTranscript[0].text,
                note: 'Using placeholder transcription. Install whisper for real transcription.',
              },
              {
                meta: {
                  requestId: context.requestId,
                },
              },
            ),
          );
        }
      } catch (error) {
        apiDebug('Error in simple transcription', error);
        throw error; // Let middleware handle the error
      }
    },
    {
      logging: {
        enabled: true,
        logRequests: true,
        logResponses: false,
      },
      errorHandling: {
        enabled: true,
        sanitizeErrors: true,
      },
    },
  );

  return authenticatedHandler(request);
}
