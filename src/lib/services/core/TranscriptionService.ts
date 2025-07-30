import { RepositoryFactory } from '../../database/repositories';
import type { TranscriptionRepository } from '../../database/repositories/TranscriptRepository';
import type { TranscriptionJob } from '../../database/client';

interface NewTranscriptionJob {
  file_id: number;
  language?: string;
  model_size?: string;
  threads?: number;
  processors?: number;
  diarization?: boolean;
  speaker_count?: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'draft';
  progress?: number;
  transcript?: any;
  diarization_status?:
    | 'not_attempted'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'no_speakers_detected';
  diarization_error?: string;
  last_error?: string;
  started_at?: string;
  completed_at?: string;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: number;
  confidence?: number;
}

export class TranscriptionService {
  private transcriptionRepository: TranscriptionRepository;

  constructor() {
    this.transcriptionRepository = RepositoryFactory.transcriptionRepository;
    console.log('Transcription service initialized');
  }

  async createJob(data: NewTranscriptionJob): Promise<TranscriptionJob> {
    try {
      // Validate input
      if (
        !data.file_id ||
        typeof data.file_id !== 'number' ||
        data.file_id <= 0
      ) {
        throw new Error('file_id is required and must be a positive number');
      }

      // Set default values
      const jobData = {
        file_id: data.file_id,
        status: (data.status || 'pending') as
          | 'pending'
          | 'processing'
          | 'completed'
          | 'failed'
          | 'draft',
        progress: data.progress || 0,
        language: data.language || 'auto',
        model_size: data.model_size || 'large-v3',
        threads: data.threads || 4,
        processors: data.processors || 1,
        diarization: data.diarization ?? true,
        speaker_count: data.speaker_count,
        transcript: data.transcript,
        diarization_status: data.diarization_status,
        diarization_error: data.diarization_error,
        last_error: data.last_error,
        started_at: data.started_at,
        completed_at: data.completed_at,
      };

      const job = await this.transcriptionRepository.create(jobData);
      console.log(
        `Created transcription job ${job.id} for file ${data.file_id}`
      );
      return job;
    } catch (error) {
      console.error('Error in createJob:', error);
      throw error;
    }
  }

  async getJobById(id: number): Promise<TranscriptionJob | null> {
    try {
      if (!id || typeof id !== 'number' || id <= 0) {
        throw new Error('id is required and must be a positive number');
      }

      return await this.transcriptionRepository.findById(id);
    } catch (error) {
      console.error('Error in getJobById:', error);
      throw error;
    }
  }

  async getJobsByFileId(fileId: number): Promise<TranscriptionJob[]> {
    try {
      if (!fileId || typeof fileId !== 'number' || fileId <= 0) {
        throw new Error('fileId is required and must be a positive number');
      }

      return await this.transcriptionRepository.findByFileId(fileId);
    } catch (error) {
      console.error('Error in getJobsByFileId:', error);
      throw error;
    }
  }

  // Add singular method for getting the latest job by file ID (DRY principle)
  async getJobByFileId(fileId: number): Promise<TranscriptionJob | null> {
    try {
      if (!fileId || typeof fileId !== 'number' || fileId <= 0) {
        throw new Error('fileId is required and must be a positive number');
      }

      return await this.transcriptionRepository.findLatestByFileId(fileId);
    } catch (error) {
      console.error('Error in getJobByFileId:', error);
      throw error;
    }
  }

  async getLatestJobByFileId(fileId: number): Promise<TranscriptionJob | null> {
    try {
      if (!fileId || typeof fileId !== 'number' || fileId <= 0) {
        throw new Error('fileId is required and must be a positive number');
      }

      return await this.transcriptionRepository.findLatestByFileId(fileId);
    } catch (error) {
      console.error('Error in getLatestJobByFileId:', error);
      throw error;
    }
  }

  async startTranscription(jobId: number): Promise<TranscriptionJob> {
    try {
      if (!jobId || typeof jobId !== 'number' || jobId <= 0) {
        throw new Error('jobId is required and must be a positive number');
      }

      // Check if job exists and is in pending state
      const job = await this.transcriptionRepository.findById(jobId);
      if (!job) {
        throw new Error(`Transcription job ${jobId} not found`);
      }

      if (job.status !== 'pending') {
        throw new Error(
          `Cannot start transcription job ${jobId}: current status is ${job.status}`
        );
      }

      const updatedJob = await this.transcriptionRepository.updateStatus(
        jobId,
        'processing'
      );
      console.log(`Started transcription job ${jobId}`);
      return updatedJob;
    } catch (error) {
      console.error('Error in startTranscription:', error);
      throw error;
    }
  }

  async updateProgress(
    jobId: number,
    progress: number
  ): Promise<TranscriptionJob> {
    try {
      if (!jobId || typeof jobId !== 'number' || jobId <= 0) {
        throw new Error('jobId is required and must be a positive number');
      }

      if (
        progress === null ||
        progress === undefined ||
        typeof progress !== 'number' ||
        progress < 0 ||
        progress > 100
      ) {
        throw new Error(
          'progress is required and must be a number between 0 and 100'
        );
      }

      const updatedJob = await this.transcriptionRepository.updateProgress(
        jobId,
        progress
      );
      console.log(`Updated progress for job ${jobId}: ${progress}%`);
      return updatedJob;
    } catch (error) {
      console.error('Error in updateProgress:', error);
      throw error;
    }
  }

  async completeTranscription(
    jobId: number,
    transcript: TranscriptSegment[]
  ): Promise<TranscriptionJob> {
    try {
      if (!jobId || typeof jobId !== 'number' || jobId <= 0) {
        throw new Error('jobId is required and must be a positive number');
      }

      if (!transcript || !Array.isArray(transcript)) {
        throw new Error('transcript is required and must be an array');
      }

      // Validate transcript segments
      for (const segment of transcript) {
        if (!segment.start || !segment.end || !segment.text) {
          throw new Error(
            'Each transcript segment must have start, end, and text properties'
          );
        }
        if (
          typeof segment.start !== 'number' ||
          typeof segment.end !== 'number' ||
          typeof segment.text !== 'string'
        ) {
          throw new Error(
            'Transcript segment start and end must be numbers, text must be a string'
          );
        }
        if (segment.start >= segment.end) {
          throw new Error(
            'Transcript segment start time must be before end time'
          );
        }
      }

      const completedJob = await this.transcriptionRepository.updateWithResults(
        jobId,
        {
          status: 'completed',
          progress: 100,
          transcript,
          completedAt: new Date(),
        }
      );
      console.log(
        `Completed transcription job ${jobId} with ${transcript.length} segments`
      );
      return completedJob;
    } catch (error) {
      console.error('Error in completeTranscription:', error);
      throw error;
    }
  }

  async failTranscription(
    jobId: number,
    error: string
  ): Promise<TranscriptionJob> {
    try {
      if (!jobId || typeof jobId !== 'number' || jobId <= 0) {
        throw new Error('jobId is required and must be a positive number');
      }

      if (!error || typeof error !== 'string' || error.length < 1) {
        throw new Error('error is required and must be a non-empty string');
      }

      const failedJob = await this.transcriptionRepository.updateStatus(
        jobId,
        'failed',
        { lastError: error, completedAt: new Date().toISOString() }
      );
      console.error(`Failed transcription job ${jobId}: ${error}`);
      return failedJob;
    } catch (err) {
      console.error('Error in failTranscription:', err);
      throw err;
    }
  }

  async getJobsByStatus(
    status: TranscriptionJob['status']
  ): Promise<TranscriptionJob[]> {
    try {
      if (!status || typeof status !== 'string') {
        throw new Error('status is required and must be a string');
      }

      const validStatuses: TranscriptionJob['status'][] = [
        'pending',
        'processing',
        'completed',
        'failed',
        'draft',
      ];
      if (!validStatuses.includes(status)) {
        throw new Error(`status must be one of: ${validStatuses.join(', ')}`);
      }

      return await this.transcriptionRepository.findByStatus(status);
    } catch (error) {
      console.error('Error in getJobsByStatus:', error);
      throw error;
    }
  }

  async getPendingJobs(): Promise<TranscriptionJob[]> {
    try {
      return await this.transcriptionRepository.findByStatus('pending');
    } catch (error) {
      console.error('Error in getPendingJobs:', error);
      throw error;
    }
  }

  async getProcessingJobs(): Promise<TranscriptionJob[]> {
    try {
      return await this.transcriptionRepository.findByStatus('processing');
    } catch (error) {
      console.error('Error in getProcessingJobs:', error);
      throw error;
    }
  }

  // Additional utility methods
  async cancelJob(jobId: number): Promise<TranscriptionJob> {
    try {
      if (!jobId || typeof jobId !== 'number' || jobId <= 0) {
        throw new Error('jobId is required and must be a positive number');
      }

      const job = await this.transcriptionRepository.findById(jobId);
      if (!job) {
        throw new Error(`Transcription job ${jobId} not found`);
      }

      if (job.status === 'completed') {
        throw new Error(`Cannot cancel completed transcription job ${jobId}`);
      }

      const cancelledJob = await this.transcriptionRepository.updateStatus(
        jobId,
        'failed',
        {
          lastError: 'Cancelled by user',
          completedAt: new Date().toISOString(),
        }
      );
      console.log(`Cancelled transcription job ${jobId}`);
      return cancelledJob;
    } catch (error) {
      console.error('Error in cancelJob:', error);
      throw error;
    }
  }

  async retryJob(jobId: number): Promise<TranscriptionJob> {
    try {
      if (!jobId || typeof jobId !== 'number' || jobId <= 0) {
        throw new Error('jobId is required and must be a positive number');
      }

      const job = await this.transcriptionRepository.findById(jobId);
      if (!job) {
        throw new Error(`Transcription job ${jobId} not found`);
      }

      if (job.status !== 'failed') {
        throw new Error(
          `Cannot retry transcription job ${jobId}: current status is ${job.status}`
        );
      }

      const retriedJob = await this.transcriptionRepository.updateStatus(
        jobId,
        'pending'
      );
      console.log(`Retrying transcription job ${jobId}`);
      return retriedJob;
    } catch (error) {
      console.error('Error in retryJob:', error);
      throw error;
    }
  }

  async getJobStatistics(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const [pending, processing, completed, failed] = await Promise.all([
        this.transcriptionRepository.findByStatus('pending'),
        this.transcriptionRepository.findByStatus('processing'),
        this.transcriptionRepository.findByStatus('completed'),
        this.transcriptionRepository.findByStatus('failed'),
      ]);

      return {
        total:
          pending.length + processing.length + completed.length + failed.length,
        pending: pending.length,
        processing: processing.length,
        completed: completed.length,
        failed: failed.length,
      };
    } catch (error) {
      console.error('Error in getJobStatistics:', error);
      throw error;
    }
  }
}
