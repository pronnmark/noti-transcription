import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioRepository } from '@/lib/database/repositories/AudioRepository';
import { db, databaseInitializer } from '@/lib/database';
import { audioFiles, NewAudioFile } from '@/lib/database/schema';

describe('AudioRepository', () => {
  let repository: AudioRepository;

  beforeEach(async () => {
    await databaseInitializer.initialize({
      runMigrations: true,
      validateSchema: false,
      createBackup: false,
      force: true,
    });

    repository = new AudioRepository();
  });

  afterEach(async () => {
    await db.delete(audioFiles);
  });

  describe('findByHash', () => {
    it('should find audio file by hash', async () => {
      const newAudio: NewAudioFile = {
        fileName: 'test.mp3',
        originalFileName: 'test-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'unique-hash-123',
      };

      await repository.create(newAudio);
      const found = await repository.findByHash('unique-hash-123');

      expect(found).toBeDefined();
      expect(found?.fileHash).toBe('unique-hash-123');
      expect(found?.fileName).toBe('test.mp3');
    });

    it('should return null for non-existent hash', async () => {
      const found = await repository.findByHash('non-existent-hash');
      expect(found).toBeNull();
    });
  });

  describe('findByFileName', () => {
    it('should find audio file by filename', async () => {
      const newAudio: NewAudioFile = {
        fileName: 'unique-file.mp3',
        originalFileName: 'test-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'test-hash-123',
      };

      await repository.create(newAudio);
      const found = await repository.findByFileName('unique-file.mp3');

      expect(found).toBeDefined();
      expect(found?.fileName).toBe('unique-file.mp3');
    });

    it('should return null for non-existent filename', async () => {
      const found = await repository.findByFileName('non-existent.mp3');
      expect(found).toBeNull();
    });
  });

  describe('findRecent', () => {
    it('should return recent files in descending order', async () => {
      // Create files with different timestamps
      const audio1: NewAudioFile = {
        fileName: 'old.mp3',
        originalFileName: 'old-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'hash-1',
      };

      const audio2: NewAudioFile = {
        fileName: 'new.mp3',
        originalFileName: 'new-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 2048,
        fileHash: 'hash-2',
      };

      await repository.create(audio1);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      await repository.create(audio2);

      const recent = await repository.findRecent(2);

      expect(recent).toHaveLength(2);
      expect(recent[0].fileName).toBe('new.mp3'); // Most recent first
      expect(recent[1].fileName).toBe('old.mp3');
    });

    it('should respect limit parameter', async () => {
      // Create 3 files
      for (let i = 1; i <= 3; i++) {
        await repository.create({
          fileName: `test${i}.mp3`,
          originalFileName: `test${i}-original.mp3`,
          originalFileType: 'audio/mpeg',
          fileSize: 1024 * i,
          fileHash: `hash-${i}`,
        });
      }

      const recent = await repository.findRecent(2);
      expect(recent).toHaveLength(2);
    });
  });

  describe('findByDateRange', () => {
    it('should find files within date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await repository.create({
        fileName: 'today.mp3',
        originalFileName: 'today-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'hash-today',
      });

      const filesInRange = await repository.findByDateRange(yesterday, tomorrow);
      expect(filesInRange).toHaveLength(1);
      expect(filesInRange[0].fileName).toBe('today.mp3');
    });
  });

  describe('findByFileType', () => {
    it('should find files by file type', async () => {
      await repository.create({
        fileName: 'test.mp3',
        originalFileName: 'test-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'hash-mp3',
      });

      await repository.create({
        fileName: 'test.wav',
        originalFileName: 'test-original.wav',
        originalFileType: 'audio/wav',
        fileSize: 2048,
        fileHash: 'hash-wav',
      });

      const mp3Files = await repository.findByFileType('audio/mpeg');
      expect(mp3Files).toHaveLength(1);
      expect(mp3Files[0].originalFileType).toBe('audio/mpeg');

      const wavFiles = await repository.findByFileType('audio/wav');
      expect(wavFiles).toHaveLength(1);
      expect(wavFiles[0].originalFileType).toBe('audio/wav');
    });
  });

  describe('getTotalSize', () => {
    it('should calculate total size of all files', async () => {
      await repository.create({
        fileName: 'test1.mp3',
        originalFileName: 'test1-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1024,
        fileHash: 'hash-1',
      });

      await repository.create({
        fileName: 'test2.mp3',
        originalFileName: 'test2-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 2048,
        fileHash: 'hash-2',
      });

      const totalSize = await repository.getTotalSize();
      expect(totalSize).toBe(3072); // 1024 + 2048
    });

    it('should return 0 for empty database', async () => {
      const totalSize = await repository.getTotalSize();
      expect(totalSize).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      await repository.create({
        fileName: 'test1.mp3',
        originalFileName: 'test1-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 1000,
        fileHash: 'hash-1',
        duration: 60,
      });

      await repository.create({
        fileName: 'test2.mp3',
        originalFileName: 'test2-original.mp3',
        originalFileType: 'audio/mpeg',
        fileSize: 2000,
        fileHash: 'hash-2',
        duration: 120,
      });

      const stats = await repository.getStatistics();

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBe(3000);
      expect(stats.averageSize).toBe(1500);
      expect(stats.averageDuration).toBe(90);
    });

    it('should handle empty database', async () => {
      const stats = await repository.getStatistics();

      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageSize).toBe(0);
      expect(stats.averageDuration).toBe(0);
    });
  });
});
