import { getDb } from './database/client';
import { audioFiles, transcriptionJobs } from './database/schema';
import { eq } from 'drizzle-orm';
import { join } from 'path';
import { promises as fs } from 'fs';
import { startTranscription } from './transcription';

export interface WorkerResult {
  message: string;
  processed: number;
  results: Array<{
    jobId: number;
    fileId: number;
    fileName: string;
    status: 'completed' | 'failed';
    error?: string;
  }>;
}

// Helper function to create a timeout promise
function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Transcription timeout after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });
}

export async function processTranscriptionJobs(): Promise<WorkerResult> {
  const db = getDb();

  try {
    // Get pending or stuck processing jobs
    const jobs = await db.select({
      job: transcriptionJobs,
      file: audioFiles,
    })
      .from(transcriptionJobs)
      .innerJoin(audioFiles, eq(transcriptionJobs.fileId, audioFiles.id))
      .where(eq(transcriptionJobs.status, 'pending'))
      .limit(5);

    if (jobs.length === 0) {
      return {
        message: 'No pending transcriptions',
        processed: 0,
        results: [],
      };
    }

    const results: { jobId: number; fileId: number; fileName: string; status: 'completed' | 'failed'; error?: string }[] = [];

    for (const { job, file } of jobs) {
      try {
        console.log(`Processing transcription job ${job.id} for file: ${file.originalFileName}`);

        // Update status to processing
        await db.update(transcriptionJobs)
          .set({
            status: 'processing',
            startedAt: new Date(),
            progress: 10,
          })
          .where(eq(transcriptionJobs.id, job.id));

        // Check if file exists
        const audioPath = join(process.cwd(), 'data', 'audio_files', file.fileName);
        try {
          await fs.access(audioPath);
        } catch (_e) {
          console.log('File not found at:', audioPath);
          console.log('File object:', file);
          throw new Error(`Audio file not found: ${file.fileName}`);
        }

        // Add file size validation
        const fileSizeMB = file.fileSize / (1024 * 1024);
        console.log(`File size: ${fileSizeMB.toFixed(2)}MB`);

        if (fileSizeMB > 100) {
          throw new Error(`File too large: ${fileSizeMB.toFixed(2)}MB (max 100MB)`);
        }

        // Start real transcription with timeout protection
        console.log(`Starting real transcription for job ${job.id}, file: ${file.originalFileName}`);

        try {
          // Call the real transcription function with timeout (10 minutes)
          const TRANSCRIPTION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
          await Promise.race([
            startTranscription(file.id, audioPath),
            createTimeoutPromise(TRANSCRIPTION_TIMEOUT),
          ]);

          // After transcription completes, read the result from the database
          const updatedJob = await db.select()
            .from(transcriptionJobs)
            .where(eq(transcriptionJobs.id, job.id))
            .limit(1);

          if (updatedJob.length === 0) {
            throw new Error('Job not found after transcription');
          }

          const transcriptionResult = updatedJob[0];

          // Check if transcription was successful
          if (transcriptionResult.status !== 'completed') {
            // The transcription function should have updated the status to 'completed'
            // If it didn't, something went wrong
            throw new Error(`Transcription failed with status: ${transcriptionResult.status}`);
          }

          console.log(`Transcription completed successfully for job ${job.id}`);

        } catch (transcriptionError) {
          console.error(`Transcription failed for job ${job.id}:`, transcriptionError);

          // Update job as failed
          await db.update(transcriptionJobs)
            .set({
              status: 'failed',
              progress: 0,
              lastError: transcriptionError instanceof Error ? transcriptionError.message : 'Unknown transcription error',
              completedAt: new Date(),
            })
            .where(eq(transcriptionJobs.id, job.id));

          throw transcriptionError;
        }

        results.push({
          jobId: job.id,
          fileId: file.id,
          fileName: file.originalFileName,
          status: 'completed',
        });

      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);

        // Mark job as failed if not already updated
        try {
          await db.update(transcriptionJobs)
            .set({
              status: 'failed',
              lastError: error instanceof Error ? error.message : 'Unknown error',
              completedAt: new Date(),
            })
            .where(eq(transcriptionJobs.id, job.id));
        } catch (dbError) {
          console.error(`Failed to update job ${job.id} status:`, dbError);
        }

        results.push({
          jobId: job.id,
          fileId: file.id,
          fileName: file.originalFileName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      message: `Processed ${results.length} transcriptions`,
      processed: results.length,
      results,
    };

  } catch (error: unknown) {
    console.error('Worker error:', error);
    throw new Error((error as Error).message || 'Worker failed');
  }
}
