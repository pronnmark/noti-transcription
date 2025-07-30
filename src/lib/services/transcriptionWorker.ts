import { getSupabase } from '../database/client';
import { join } from 'path';
import { promises as fs } from 'fs';
import { startTranscription } from './transcription';
import { SupabaseStorageService } from './core/SupabaseStorageService';

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
      reject(
        new Error(`Transcription timeout after ${timeoutMs / 1000} seconds`)
      );
    }, timeoutMs);
  });
}

export async function processTranscriptionJobs(): Promise<WorkerResult> {
  const supabase = getSupabase();

  try {
    // Get pending or stuck processing jobs with file info
    const { data: jobs, error } = await supabase
      .from('transcription_jobs')
      .select(
        `
        *,
        audio_files (*)
      `
      )
      .eq('status', 'pending')
      .limit(5);

    if (error) {
      throw new Error(`Failed to fetch pending jobs: ${error.message}`);
    }

    if (jobs.length === 0) {
      return {
        message: 'No pending transcriptions',
        processed: 0,
        results: [],
      };
    }

    const results: {
      jobId: number;
      fileId: number;
      fileName: string;
      status: 'completed' | 'failed';
      error?: string;
    }[] = [];

    for (const job of jobs) {
      const file = job.audio_files;
      if (!file) {
        console.error(`No audio file found for job ${job.id}`);
        continue;
      }

      let tempFilePath: string | undefined;

      try {
        console.log(
          `Processing transcription job ${job.id} for file: ${file.original_file_name}`
        );

        // Update status to processing
        const { error: updateError } = await supabase
          .from('transcription_jobs')
          .update({
            status: 'processing',
            started_at: new Date().toISOString(),
            progress: 10,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        if (updateError) {
          throw new Error(
            `Failed to update job status: ${updateError.message}`
          );
        }

        // Download file from Supabase Storage to temporary location
        const supabaseStorageService = new SupabaseStorageService();

        try {
          // Download file from Supabase Storage
          console.log(
            `Downloading file from Supabase Storage: ${file.file_name}`
          );
          const fileBuffer = await supabaseStorageService.downloadFile(
            'audio-files',
            file.file_name
          );

          // Create temporary file path
          const tempDir = join(process.cwd(), 'data', 'temp');
          await fs.mkdir(tempDir, { recursive: true });

          // Generate temp filename with original extension
          const fileExtension =
            file.original_file_name.split('.').pop() || 'tmp';
          tempFilePath = join(
            tempDir,
            `temp_${job.id}_${Date.now()}.${fileExtension}`
          );

          // Write buffer to temporary file
          await fs.writeFile(tempFilePath, fileBuffer);
          console.log(
            `File downloaded and saved to temporary location: ${tempFilePath}`
          );
        } catch (downloadError) {
          console.error(
            'Error downloading file from Supabase Storage:',
            downloadError
          );
          throw new Error(
            `Failed to download audio file from storage: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`
          );
        }

        // Add file size validation
        const fileSizeMB = file.file_size / (1024 * 1024);
        console.log(`File size: ${fileSizeMB.toFixed(2)}MB`);

        if (fileSizeMB > 100) {
          throw new Error(
            `File too large: ${fileSizeMB.toFixed(2)}MB (max 100MB)`
          );
        }

        // Start real transcription with timeout protection
        console.log(
          `Starting real transcription for job ${job.id}, file: ${file.original_file_name}`
        );

        if (!tempFilePath) {
          throw new Error(
            'Temporary file path is undefined - file download may have failed'
          );
        }

        try {
          // Call the real transcription function with timeout (10 minutes)
          const TRANSCRIPTION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
          await Promise.race([
            startTranscription(file.id, tempFilePath),
            createTimeoutPromise(TRANSCRIPTION_TIMEOUT),
          ]);

          // After transcription completes, read the result from the database
          const { data: updatedJobs, error: fetchError } = await supabase
            .from('transcription_jobs')
            .select('*')
            .eq('id', job.id)
            .limit(1);

          if (fetchError) {
            throw new Error(
              `Failed to fetch updated job: ${fetchError.message}`
            );
          }

          if (!updatedJobs || updatedJobs.length === 0) {
            throw new Error('Job not found after transcription');
          }

          const transcriptionResult = updatedJobs[0];

          // Check if transcription was successful
          if (transcriptionResult.status !== 'completed') {
            // The transcription function should have updated the status to 'completed'
            // If it didn't, something went wrong
            throw new Error(
              `Transcription failed with status: ${transcriptionResult.status}`
            );
          }

          console.log(`Transcription completed successfully for job ${job.id}`);

          // Clean up temporary file
          if (tempFilePath) {
            try {
              await fs.unlink(tempFilePath);
              console.log(`Cleaned up temporary file: ${tempFilePath}`);
            } catch (cleanupError) {
              console.warn(
                `Failed to clean up temporary file ${tempFilePath}:`,
                cleanupError
              );
            }
          }
        } catch (transcriptionError) {
          console.error(
            `Transcription failed for job ${job.id}:`,
            transcriptionError
          );

          // Update job as failed
          await supabase
            .from('transcription_jobs')
            .update({
              status: 'failed',
              progress: 0,
              last_error:
                transcriptionError instanceof Error
                  ? transcriptionError.message
                  : 'Unknown transcription error',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          // Clean up temporary file on error
          if (tempFilePath) {
            try {
              await fs.unlink(tempFilePath);
              console.log(
                `Cleaned up temporary file after error: ${tempFilePath}`
              );
            } catch (cleanupError) {
              console.warn(
                `Failed to clean up temporary file ${tempFilePath}:`,
                cleanupError
              );
            }
          }

          throw transcriptionError;
        }

        results.push({
          jobId: job.id,
          fileId: file.id,
          fileName: file.original_file_name,
          status: 'completed',
        });
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);

        // Mark job as failed if not already updated
        try {
          await supabase
            .from('transcription_jobs')
            .update({
              status: 'failed',
              last_error:
                error instanceof Error ? error.message : 'Unknown error',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
        } catch (dbError) {
          console.error(`Failed to update job ${job.id} status:`, dbError);
        }

        // Clean up temporary file on overall error
        if (tempFilePath) {
          try {
            await fs.unlink(tempFilePath);
            console.log(
              `Cleaned up temporary file after overall error: ${tempFilePath}`
            );
          } catch (cleanupError) {
            console.warn(
              `Failed to clean up temporary file ${tempFilePath}:`,
              cleanupError
            );
          }
        }

        results.push({
          jobId: job.id,
          fileId: file.id,
          fileName: file.original_file_name,
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
