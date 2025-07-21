import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseRepository } from '@/lib/database/repositories/BaseRepository';
import { db, databaseInitializer } from '@/lib/database';
import { audioFiles, NewAudioFile, AudioFile } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

// Test repository extending BaseRepository
class TestAudioRepository extends BaseRepository<AudioFile, NewAudioFile> {
  constructor() {
    super(audioFiles);
  }
}

describe('BaseRepository', () => {
  let repository: TestAudioRepository;

  beforeEach(async () => {
    // Initialize database for testing
    await databaseInitializer.initialize({
      runMigrations: true,
      validateSchema: false,
      createBackup: false,
      force: true,
    });

    repository = new TestAudioRepository();
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(audioFiles);
  });

  describe('create', () => {
    it('should create a new record', async () => {
      const newAudio: NewAudioFile = {
        fileName: 'test.mp3',
        originalFileName: 'test-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'test-hash-123',
        duration: 120,
        title: 'Test Audio',
      };

      const created = await repository.create(newAudio);

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.fileName).toBe(newAudio.fileName);
      expect(created.originalFileName).toBe(newAudio.originalFileName);
      expect(created.fileSize).toBe(newAudio.fileSize);
    });

    it('should throw error on invalid data', async () => {
      const invalidAudio = {
        // Missing required fields
        fileName: '',
      } as NewAudioFile;

      await expect(repository.create(invalidAudio)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find record by id', async () => {
      const newAudio: NewAudioFile = {
        fileName: 'test.mp3',
        originalFileName: 'test-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'test-hash-123',
      };

      const created = await repository.create(newAudio);
      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.fileName).toBe(newAudio.fileName);
    });

    it('should return null for non-existent id', async () => {
      const found = await repository.findById(99999);
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all records', async () => {
      const audio1: NewAudioFile = {
        fileName: 'test1.mp3',
        originalFileName: 'test1-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'test-hash-1',
      };

      const audio2: NewAudioFile = {
        fileName: 'test2.mp3',
        originalFileName: 'test2-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 2048,
        fileHash: 'test-hash-2',
      };

      await repository.create(audio1);
      await repository.create(audio2);

      const all = await repository.findAll();
      expect(all).toHaveLength(2);
    });

    it('should support limit and offset', async () => {
      // Create 5 records
      for (let i = 1; i <= 5; i++) {
        await repository.create({
          fileName: `test${i}.mp3`,
          originalFileName: `test${i}-original.mp3`,
          originalFileType: 'audio/mpeg',
          fileSize: 1024 * i,
          fileHash: `test-hash-${i}`,
        });
      }

      const limited = await repository.findAll(2, 1);
      expect(limited).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update existing record', async () => {
      const newAudio: NewAudioFile = {
        fileName: 'test.mp3',
        originalFileName: 'test-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'test-hash-123',
      };

      const created = await repository.create(newAudio);
      const updated = await repository.update(created.id, {
        title: 'Updated Title',
        duration: 180,
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.duration).toBe(180);
      expect(updated.fileName).toBe(newAudio.fileName); // Unchanged
    });

    it('should throw error for non-existent record', async () => {
      await expect(repository.update(99999, { title: 'Test' })).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete existing record', async () => {
      const newAudio: NewAudioFile = {
        fileName: 'test.mp3',
        originalFileName: 'test-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'test-hash-123',
      };

      const created = await repository.create(newAudio);
      const deleted = await repository.delete(created.id);

      expect(deleted).toBe(true);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent record', async () => {
      const deleted = await repository.delete(99999);
      expect(deleted).toBe(false);
    });
  });

  describe('count', () => {
    it('should count all records', async () => {
      expect(await repository.count()).toBe(0);

      await repository.create({
        fileName: 'test1.mp3',
        originalFileName: 'test1-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'test-hash-1',
      });

      expect(await repository.count()).toBe(1);

      await repository.create({
        fileName: 'test2.mp3',
        originalFileName: 'test2-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 2048,
        fileHash: 'test-hash-2',
      });

      expect(await repository.count()).toBe(2);
    });

    it('should count with where condition', async () => {
      await repository.create({
        fileName: 'test1.mp3',
        originalFileName: 'test1-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'test-hash-1',
      });

      await repository.create({
        fileName: 'test2.wav',
        originalFileName: 'test2-original.wav',
        originalFileType: 'audio/wav',
        fileSize: 2048,
        fileHash: 'test-hash-2',
      });

      const mp3Count = await repository.count(eq(audioFiles.originalFileType, 'audio/mpeg'));
      expect(mp3Count).toBe(1);
    });
  });

  describe('exists', () => {
    it('should check if record exists', async () => {
      const newAudio: NewAudioFile = {
        fileName: 'test.mp3',
        originalFileName: 'test-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'test-hash-123',
      };

      const created = await repository.create(newAudio);

      expect(await repository.exists(created.id)).toBe(true);
      expect(await repository.exists(99999)).toBe(false);
    });
  });
});
