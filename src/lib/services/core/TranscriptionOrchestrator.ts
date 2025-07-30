import { ErrorHandler } from '../../utils/errorHandler';
import { ValidationUtils } from '../../utils/validation';
import { RepositoryFactory } from '../../database/repositories';

export interface TranscriptionJobOptions {
  speakerCount?: number;
  language?: string;
  modelSize?: string;
  enableDiarization?: boolean;
}

export interface TranscriptionJobResult {
  jobId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
}

/**
 * TranscriptionOrchestrator - Single Responsibility: Orchestrate transcription workflow
 * Extracted from FileUploadService to follow SRP
 */
export class TranscriptionOrchestrator {
  /**
   * Create and queue transcription job
   */
  static async createTranscriptionJob(
    fileId: number,
    audioPath: string,
    options: TranscriptionJobOptions = {}
  ): Promise<TranscriptionJobResult> {
    return await ErrorHandler.serviceMethod(async () => {
      ValidationUtils.validateId(fileId, 'fileId');
      ValidationUtils.validateRequiredString(audioPath, 'audioPath');

      const {
        speakerCount,
        language = 'auto',
        modelSize = 'large-v3',
        enableDiarization = true,
      } = options;

      // Validate speaker count if provided
      if (speakerCount !== undefined) {
        ValidationUtils.validateSpeakerCount(speakerCount);
      }

      const transcriptionRepository = RepositoryFactory.transcriptionRepository;

      // Create transcription job
      const job = await transcriptionRepository.create({
        file_id: fileId,
        language,
        model_size: modelSize,
        diarization: enableDiarization,
        speaker_count: speakerCount,
        status: 'pending',
        progress: 0,
      });

      return {
        jobId: job.id,
        status: 'pending' as const,
        message: 'Transcription job created and queued for processing',
      };
    }, {
      service: 'TranscriptionOrchestrator',
      operation: 'createTranscriptionJob',
      metadata: { fileId, options }
    });
  }

  /**
   * Start background transcription process
   */
  static async startBackgroundTranscription(
    fileId: number,
    audioPath: string,
    options: TranscriptionJobOptions = {}
  ): Promise<void> {
    return await ErrorHandler.serviceMethod(async () => {
      // Import transcription service dynamically to avoid circular dependencies
      const { startTranscription } = await import('../transcription');
      
      // Start transcription in background (don't await)
      startTranscription(fileId, audioPath, options.speakerCount)
        .catch(error => {
          console.error(
            `Background transcription failed for file ${fileId}:`,
            error
          );
        });
    }, {
      service: 'TranscriptionOrchestrator',
      operation: 'startBackgroundTranscription',
      metadata: { fileId }
    });
  }

  /**
   * Check transcription job status
   */
  static async getTranscriptionStatus(fileId: number): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'not_found';
    progress?: number;
    error?: string;
    jobId?: number;
  }> {
    return await ErrorHandler.serviceMethod(async () => {
      ValidationUtils.validateId(fileId, 'fileId');

      const transcriptionRepository = RepositoryFactory.transcriptionRepository;
      const job = await transcriptionRepository.findLatestByFileId(fileId);

      if (!job) {
        return { status: 'not_found' as const };
      }

      return {
        status: job.status === 'draft' ? 'pending' : job.status,
        progress: job.progress,
        error: job.last_error || undefined,
        jobId: job.id,
      };
    }, {
      service: 'TranscriptionOrchestrator', 
      operation: 'getTranscriptionStatus',
      metadata: { fileId }
    });
  }

  /**
   * Cancel transcription job
   */
  static async cancelTranscription(fileId: number): Promise<boolean> {
    return await ErrorHandler.serviceMethod(async () => {
      ValidationUtils.validateId(fileId, 'fileId');

      const transcriptionRepository = RepositoryFactory.transcriptionRepository;
      const job = await transcriptionRepository.findLatestByFileId(fileId);

      if (!job) {
        return false;
      }

      if (job.status === 'completed') {
        throw new Error('Cannot cancel completed transcription');
      }

      await transcriptionRepository.updateStatus(job.id, 'failed', {
        lastError: 'Cancelled by user',
        completedAt: new Date().toISOString(),
      });

      return true;
    }, {
      service: 'TranscriptionOrchestrator',
      operation: 'cancelTranscription', 
      metadata: { fileId }
    });
  }

  /**
   * Retry failed transcription
   */
  static async retryTranscription(fileId: number): Promise<TranscriptionJobResult> {
    return await ErrorHandler.serviceMethod(async () => {
      ValidationUtils.validateId(fileId, 'fileId');

      const transcriptionRepository = RepositoryFactory.transcriptionRepository;
      const job = await transcriptionRepository.findLatestByFileId(fileId);

      if (!job) {
        throw new Error('No transcription job found for file');
      }

      if (job.status !== 'failed') {
        throw new Error(`Cannot retry transcription with status: ${job.status}`);
      }

      // Update job status to pending for retry
      await transcriptionRepository.updateStatus(job.id, 'pending', {
        progress: 0,
        lastError: undefined,
        startedAt: undefined,
        completedAt: undefined,
      });

      return {
        jobId: job.id,
        status: 'pending' as const,
        message: 'Transcription job queued for retry',
      };
    }, {
      service: 'TranscriptionOrchestrator',
      operation: 'retryTranscription',
      metadata: { fileId }
    });
  }

  /**
   * Get transcription statistics
   */
  static async getTranscriptionStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    return await ErrorHandler.serviceMethod(async () => {
      const transcriptionRepository = RepositoryFactory.transcriptionRepository;

      const [pending, processing, completed, failed] = await Promise.all([
        transcriptionRepository.findByStatus('pending'),
        transcriptionRepository.findByStatus('processing'), 
        transcriptionRepository.findByStatus('completed'),
        transcriptionRepository.findByStatus('failed'),
      ]);

      return {
        total: pending.length + processing.length + completed.length + failed.length,
        pending: pending.length,
        processing: processing.length,
        completed: completed.length,
        failed: failed.length,
      };
    }, {
      service: 'TranscriptionOrchestrator',
      operation: 'getTranscriptionStats'
    });
  }

  /**
   * Estimate transcription time based on file duration
   */
  static estimateTranscriptionTime(durationSeconds: number): number {
    // Whisper typically processes at ~2x real-time speed
    const processingMultiplier = 0.5; // 50% of real-time
    const baseOverhead = 30; // 30 seconds base overhead
    
    return Math.max(
      Math.round(durationSeconds * processingMultiplier + baseOverhead),
      60 // Minimum 1 minute estimate
    );
  }

  /**
   * Validate transcription requirements
   */
  static validateTranscriptionRequirements(
    fileSizeBytes: number,
    durationSeconds: number
  ): void {
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    const maxDuration = 60 * 60; // 60 minutes

    if (fileSizeBytes > maxFileSize) {
      throw new Error(`File too large for transcription (max ${maxFileSize / 1024 / 1024}MB)`);
    }

    if (durationSeconds > maxDuration) {
      throw new Error(`Audio too long for transcription (max ${maxDuration / 60} minutes)`);
    }

    if (durationSeconds < 1) {
      throw new Error('Audio too short for transcription (minimum 1 second)');
    }
  }
}