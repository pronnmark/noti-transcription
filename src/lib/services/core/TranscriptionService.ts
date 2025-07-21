import { BaseService, ValidationRules } from './BaseService';
import { RepositoryFactory } from '../../database/repositories';
import type { TranscriptionRepository } from '../../database/repositories/TranscriptRepository';
import type { ITranscriptionService } from './interfaces';
import type { 
  TranscriptionJob, 
  NewTranscriptionJob, 
  TranscriptSegment 
} from '../../database/schema';

export class TranscriptionService extends BaseService implements ITranscriptionService {
  private transcriptionRepository: TranscriptionRepository;

  constructor() {
    super('TranscriptionService');
    this.transcriptionRepository = RepositoryFactory.transcriptionRepository;
  }

  protected async onInitialize(): Promise<void> {
    this._logger.info('Transcription service initialized');
  }

  protected async onDestroy(): Promise<void> {
    this._logger.info('Transcription service destroyed');
  }

  async createJob(data: NewTranscriptionJob): Promise<TranscriptionJob> {
    return this.executeWithErrorHandling('createJob', async () => {
      this.validateInput(data, [
        ValidationRules.required('fileId'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isPositive('fileId')
      ]);

      // Set default values
      const jobData: NewTranscriptionJob = {
        ...data,
        status: data.status || 'pending',
        progress: data.progress || 0,
        language: data.language || 'auto',
        modelSize: data.modelSize || 'large-v3',
        threads: data.threads || 4,
        processors: data.processors || 1,
        diarization: data.diarization ?? true,
      };

      const job = await this.transcriptionRepository.create(jobData);
      this._logger.info(`Created transcription job ${job.id} for file ${data.fileId}`);
      return job;
    });
  }

  async getJobById(id: number): Promise<TranscriptionJob | null> {
    return this.executeWithErrorHandling('getJobById', async () => {
      this.validateInput(id, [
        ValidationRules.required('id'),
        ValidationRules.isNumber('id'),
        ValidationRules.isPositive('id')
      ]);

      return await this.transcriptionRepository.findById(id);
    });
  }

  async getJobsByFileId(fileId: number): Promise<TranscriptionJob[]> {
    return this.executeWithErrorHandling('getJobsByFileId', async () => {
      this.validateInput(fileId, [
        ValidationRules.required('fileId'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isPositive('fileId')
      ]);

      return await this.transcriptionRepository.findByFileId(fileId);
    });
  }

  // Add singular method for getting the latest job by file ID (DRY principle)
  async getJobByFileId(fileId: number): Promise<TranscriptionJob | null> {
    return this.executeWithErrorHandling('getJobByFileId', async () => {
      this.validateInput(fileId, [
        ValidationRules.required('fileId'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isPositive('fileId')
      ]);

      return await this.transcriptionRepository.findLatestByFileId(fileId);
    });
  }

  async getLatestJobByFileId(fileId: number): Promise<TranscriptionJob | null> {
    return this.executeWithErrorHandling('getLatestJobByFileId', async () => {
      this.validateInput(fileId, [
        ValidationRules.required('fileId'),
        ValidationRules.isNumber('fileId'),
        ValidationRules.isPositive('fileId')
      ]);

      return await this.transcriptionRepository.findLatestByFileId(fileId);
    });
  }

  async startTranscription(jobId: number): Promise<TranscriptionJob> {
    return this.executeWithErrorHandling('startTranscription', async () => {
      this.validateInput(jobId, [
        ValidationRules.required('jobId'),
        ValidationRules.isNumber('jobId'),
        ValidationRules.isPositive('jobId')
      ]);

      // Check if job exists and is in pending state
      const job = await this.transcriptionRepository.findById(jobId);
      if (!job) {
        throw new Error(`Transcription job ${jobId} not found`);
      }

      if (job.status !== 'pending') {
        throw new Error(`Cannot start transcription job ${jobId}: current status is ${job.status}`);
      }

      const updatedJob = await this.transcriptionRepository.updateStatus(jobId, 'processing');
      this._logger.info(`Started transcription job ${jobId}`);
      return updatedJob;
    });
  }

  async updateProgress(jobId: number, progress: number): Promise<TranscriptionJob> {
    return this.executeWithErrorHandling('updateProgress', async () => {
      this.validateInput(jobId, [
        ValidationRules.required('jobId'),
        ValidationRules.isNumber('jobId'),
        ValidationRules.isPositive('jobId')
      ]);

      this.validateInput(progress, [
        ValidationRules.required('progress'),
        ValidationRules.isNumber('progress'),
        ValidationRules.custom('progress', (val) => val >= 0 && val <= 100, 'must be between 0 and 100')
      ]);

      const updatedJob = await this.transcriptionRepository.updateProgress(jobId, progress);
      this._logger.debug(`Updated progress for job ${jobId}: ${progress}%`);
      return updatedJob;
    });
  }

  async completeTranscription(jobId: number, transcript: TranscriptSegment[]): Promise<TranscriptionJob> {
    return this.executeWithErrorHandling('completeTranscription', async () => {
      this.validateInput(jobId, [
        ValidationRules.required('jobId'),
        ValidationRules.isNumber('jobId'),
        ValidationRules.isPositive('jobId')
      ]);

      this.validateInput(transcript, [
        ValidationRules.required('transcript'),
        ValidationRules.isArray('transcript')
      ]);

      // Validate transcript segments
      for (const segment of transcript) {
        this.validateInput(segment, [
          ValidationRules.required('start'),
          ValidationRules.required('end'),
          ValidationRules.required('text'),
          ValidationRules.isNumber('start'),
          ValidationRules.isNumber('end'),
          ValidationRules.isString('text')
        ]);

        if (segment.start >= segment.end) {
          throw new Error('Transcript segment start time must be before end time');
        }
      }

      const completedJob = await this.transcriptionRepository.completeTranscription(jobId, transcript);
      this._logger.info(`Completed transcription job ${jobId} with ${transcript.length} segments`);
      return completedJob;
    });
  }

  async failTranscription(jobId: number, error: string): Promise<TranscriptionJob> {
    return this.executeWithErrorHandling('failTranscription', async () => {
      this.validateInput(jobId, [
        ValidationRules.required('jobId'),
        ValidationRules.isNumber('jobId'),
        ValidationRules.isPositive('jobId')
      ]);

      this.validateInput(error, [
        ValidationRules.required('error'),
        ValidationRules.isString('error'),
        ValidationRules.minLength('error', 1)
      ]);

      const failedJob = await this.transcriptionRepository.updateStatus(jobId, 'failed', error);
      this._logger.warn(`Failed transcription job ${jobId}: ${error}`);
      return failedJob;
    });
  }

  async getJobsByStatus(status: string): Promise<TranscriptionJob[]> {
    return this.executeWithErrorHandling('getJobsByStatus', async () => {
      this.validateInput(status, [
        ValidationRules.required('status'),
        ValidationRules.isString('status'),
        ValidationRules.oneOf('status', ['pending', 'processing', 'completed', 'failed', 'draft'])
      ]);

      return await this.transcriptionRepository.findByStatus(status);
    });
  }

  async getPendingJobs(): Promise<TranscriptionJob[]> {
    return this.executeWithErrorHandling('getPendingJobs', async () => {
      return await this.transcriptionRepository.findByStatus('pending');
    });
  }

  async getProcessingJobs(): Promise<TranscriptionJob[]> {
    return this.executeWithErrorHandling('getProcessingJobs', async () => {
      return await this.transcriptionRepository.findByStatus('processing');
    });
  }

  // Additional utility methods
  async cancelJob(jobId: number): Promise<TranscriptionJob> {
    return this.executeWithErrorHandling('cancelJob', async () => {
      this.validateInput(jobId, [
        ValidationRules.required('jobId'),
        ValidationRules.isNumber('jobId'),
        ValidationRules.isPositive('jobId')
      ]);

      const job = await this.transcriptionRepository.findById(jobId);
      if (!job) {
        throw new Error(`Transcription job ${jobId} not found`);
      }

      if (job.status === 'completed') {
        throw new Error(`Cannot cancel completed transcription job ${jobId}`);
      }

      const cancelledJob = await this.transcriptionRepository.updateStatus(jobId, 'failed', 'Cancelled by user');
      this._logger.info(`Cancelled transcription job ${jobId}`);
      return cancelledJob;
    });
  }

  async retryJob(jobId: number): Promise<TranscriptionJob> {
    return this.executeWithErrorHandling('retryJob', async () => {
      this.validateInput(jobId, [
        ValidationRules.required('jobId'),
        ValidationRules.isNumber('jobId'),
        ValidationRules.isPositive('jobId')
      ]);

      const job = await this.transcriptionRepository.findById(jobId);
      if (!job) {
        throw new Error(`Transcription job ${jobId} not found`);
      }

      if (job.status !== 'failed') {
        throw new Error(`Cannot retry transcription job ${jobId}: current status is ${job.status}`);
      }

      const retriedJob = await this.transcriptionRepository.updateStatus(jobId, 'pending');
      this._logger.info(`Retrying transcription job ${jobId}`);
      return retriedJob;
    });
  }

  async getJobStatistics(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    return this.executeWithErrorHandling('getJobStatistics', async () => {
      const [pending, processing, completed, failed] = await Promise.all([
        this.transcriptionRepository.findByStatus('pending'),
        this.transcriptionRepository.findByStatus('processing'),
        this.transcriptionRepository.findByStatus('completed'),
        this.transcriptionRepository.findByStatus('failed'),
      ]);

      return {
        total: pending.length + processing.length + completed.length + failed.length,
        pending: pending.length,
        processing: processing.length,
        completed: completed.length,
        failed: failed.length,
      };
    });
  }
}
