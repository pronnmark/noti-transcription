import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TranscriptionRepository } from '@/lib/database/repositories/TranscriptRepository';
import { AudioRepository } from '@/lib/database/repositories/AudioRepository';
import { db } from '@/lib/database';
import { audioFiles, transcriptionJobs, NewTranscriptionJob, TranscriptSegment } from '@/lib/database/schema';

describe('TranscriptionRepository', () => {
  let transcriptionRepository: TranscriptionRepository;
  let audioRepository: AudioRepository;
  let testAudioFileId: number;

  beforeEach(async () => {
    // Note: Database should already be initialized in test environment
    transcriptionRepository = new TranscriptionRepository();
    audioRepository = new AudioRepository();

    // Create a test audio file
    const audioFile = await audioRepository.create({
      fileName: 'test.mp3',
      originalFileName: 'test-original.mp3',
      originalFileType: 'audio/mpeg',
      fileSize: 1024,
      fileHash: 'test-hash-123',
    });
    testAudioFileId = audioFile.id;
  });

  afterEach(async () => {
    await db.delete(transcriptionJobs);
    await db.delete(audioFiles);
  });

  describe('create', () => {
    it('should create a transcription job', async () => {
      const newJob: NewTranscriptionJob = {
        fileId: testAudioFileId,
        language: 'en',
        modelSize: 'large-v3',
        threads: 4,
        processors: 1,
        diarization: true,
        status: 'pending',
        progress: 0,
      };

      const created = await transcriptionRepository.create(newJob);

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.fileId).toBe(testAudioFileId);
      expect(created.status).toBe('pending');
      expect(created.progress).toBe(0);
    });
  });

  describe('findByFileId', () => {
    it('should find transcription jobs by file ID', async () => {
      const job1: NewTranscriptionJob = {
        fileId: testAudioFileId,
        language: 'en',
        modelSize: 'large-v3',
        status: 'pending',
      };

      const job2: NewTranscriptionJob = {
        fileId: testAudioFileId,
        language: 'sv',
        modelSize: 'medium',
        status: 'completed',
      };

      await transcriptionRepository.create(job1);
      await transcriptionRepository.create(job2);

      const jobs = await transcriptionRepository.findByFileId(testAudioFileId);

      expect(jobs).toHaveLength(2);
      expect(jobs.every(job => job.fileId === testAudioFileId)).toBe(true);
    });

    it('should return empty array for non-existent file ID', async () => {
      const jobs = await transcriptionRepository.findByFileId(99999);
      expect(jobs).toHaveLength(0);
    });
  });

  describe('findLatestByFileId', () => {
    it('should find the latest transcription job for a file', async () => {
      const job1: NewTranscriptionJob = {
        fileId: testAudioFileId,
        language: 'en',
        modelSize: 'large-v3',
        status: 'completed',
      };

      const job2: NewTranscriptionJob = {
        fileId: testAudioFileId,
        language: 'sv',
        modelSize: 'medium',
        status: 'pending',
      };

      await transcriptionRepository.create(job1);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      await transcriptionRepository.create(job2);

      const latest = await transcriptionRepository.findLatestByFileId(testAudioFileId);

      expect(latest).toBeDefined();
      expect(latest?.language).toBe('sv'); // Most recent
    });

    it('should return null for non-existent file ID', async () => {
      const latest = await transcriptionRepository.findLatestByFileId(99999);
      expect(latest).toBeNull();
    });
  });

  describe('findByStatus', () => {
    it('should find jobs by status', async () => {
      await transcriptionRepository.create({
        fileId: testAudioFileId,
        status: 'pending',
        language: 'en',
      });

      await transcriptionRepository.create({
        fileId: testAudioFileId,
        status: 'completed',
        language: 'sv',
      });

      await transcriptionRepository.create({
        fileId: testAudioFileId,
        status: 'pending',
        language: 'fr',
      });

      const pendingJobs = await transcriptionRepository.findByStatus('pending');
      expect(pendingJobs).toHaveLength(2);
      expect(pendingJobs.every(job => job.status === 'pending')).toBe(true);

      const completedJobs = await transcriptionRepository.findByStatus('completed');
      expect(completedJobs).toHaveLength(1);
      expect(completedJobs[0].status).toBe('completed');
    });
  });

  describe('updateStatus', () => {
    it('should update job status to processing', async () => {
      const job = await transcriptionRepository.create({
        fileId: testAudioFileId,
        status: 'pending',
        language: 'en',
      });

      const updated = await transcriptionRepository.updateStatus(job.id, 'processing');

      expect(updated.status).toBe('processing');
      expect(updated.startedAt).toBeDefined();
    });

    it('should update job status to completed', async () => {
      const job = await transcriptionRepository.create({
        fileId: testAudioFileId,
        status: 'processing',
        language: 'en',
      });

      const updated = await transcriptionRepository.updateStatus(job.id, 'completed');

      expect(updated.status).toBe('completed');
      expect(updated.completedAt).toBeDefined();
    });

    it('should update job status to failed with error', async () => {
      const job = await transcriptionRepository.create({
        fileId: testAudioFileId,
        status: 'processing',
        language: 'en',
      });

      const errorMessage = 'Transcription failed due to audio format';
      const updated = await transcriptionRepository.updateStatus(job.id, 'failed', errorMessage);

      expect(updated.status).toBe('failed');
      expect(updated.lastError).toBe(errorMessage);
    });

    it('should throw error for non-existent job', async () => {
      await expect(
        transcriptionRepository.updateStatus(99999, 'completed'),
      ).rejects.toThrow();
    });
  });

  describe('updateProgress', () => {
    it('should update job progress', async () => {
      const job = await transcriptionRepository.create({
        fileId: testAudioFileId,
        status: 'processing',
        language: 'en',
        progress: 0,
      });

      const updated = await transcriptionRepository.updateProgress(job.id, 50);

      expect(updated.progress).toBe(50);
    });

    it('should throw error for non-existent job', async () => {
      await expect(
        transcriptionRepository.updateProgress(99999, 50),
      ).rejects.toThrow();
    });
  });

  describe('completeTranscription', () => {
    it('should complete transcription with transcript data', async () => {
      const job = await transcriptionRepository.create({
        fileId: testAudioFileId,
        status: 'processing',
        language: 'en',
        progress: 50,
      });

      const transcript: TranscriptSegment[] = [
        {
          start: 0,
          end: 5,
          text: 'Hello world',
          speaker: 'Speaker 1',
        },
        {
          start: 5,
          end: 10,
          text: 'How are you?',
          speaker: 'Speaker 2',
        },
      ];

      const completed = await transcriptionRepository.completeTranscription(job.id, transcript);

      expect(completed.status).toBe('completed');
      expect(completed.progress).toBe(100);
      expect(completed.transcript).toEqual(transcript);
      expect(completed.completedAt).toBeDefined();
    });

    it('should throw error for non-existent job', async () => {
      const transcript: TranscriptSegment[] = [
        { start: 0, end: 5, text: 'Test', speaker: 'Speaker 1' },
      ];

      await expect(
        transcriptionRepository.completeTranscription(99999, transcript),
      ).rejects.toThrow();
    });
  });
});
