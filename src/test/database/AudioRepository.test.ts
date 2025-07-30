import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioRepository } from '@/lib/database/repositories/AudioRepository';
import { AudioFile } from '@/lib/database/client';

interface NewAudioFile {
  file_name: string;
  original_file_name: string;
  original_file_type: string;
  file_size: number;
  file_hash?: string;
  duration?: number;
  title?: string;
  peaks?: string;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  location_timestamp?: string;
  location_provider?: string;
  recorded_at?: string;
}

describe('AudioRepository', () => {
  let repository: AudioRepository;

  beforeEach(async () => {
    // Note: Database should already be initialized in test environment
    repository = new AudioRepository();
  });

  afterEach(async () => {
    // Clean up test data using repository method
    try {
      await repository.deleteAll();
    } catch (error) {
      console.warn('Test cleanup failed:', error);
    }
  });

  describe('findByHash', () => {
    it('should find audio file by hash', async () => {
      const newAudio: NewAudioFile = {
        file_name: 'test.mp3',
        original_file_name: 'test-original.mp3',
        original_file_type: 'audio/mpeg',
        file_size: 1024,
        file_hash: 'unique-hash-123',
      };

      await repository.create(newAudio);
      const found = await repository.findByHash('unique-hash-123');

      expect(found).toBeDefined();
      expect(found?.file_hash).toBe('unique-hash-123');
      expect(found?.file_name).toBe('test.mp3');
    });

    it('should return null for non-existent hash', async () => {
      const found = await repository.findByHash('non-existent-hash');
      expect(found).toBeNull();
    });
  });

  describe('findByFileName', () => {
    it('should find audio file by filename', async () => {
      const newAudio: NewAudioFile = {
        file_name: 'unique-file.mp3',
        original_file_name: 'test-original.mp3',
        original_file_type: 'audio/mpeg',
        file_size: 1024,
        file_hash: 'test-hash-123',
      };

      await repository.create(newAudio);
      const found = await repository.findByFileName('unique-file.mp3');

      expect(found).toBeDefined();
      expect(found?.file_name).toBe('unique-file.mp3');
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
        file_name: 'old.mp3',
        original_file_name: 'old-original.mp3',
        original_file_type: 'audio/mpeg',
        file_size: 1024,
        file_hash: 'hash-1',
      };

      const audio2: NewAudioFile = {
        file_name: 'new.mp3',
        original_file_name: 'new-original.mp3',
        original_file_type: 'audio/mpeg',
        file_size: 2048,
        file_hash: 'hash-2',
      };

      await repository.create(audio1);
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      await repository.create(audio2);

      const recent = await repository.findRecent(2);

      expect(recent).toHaveLength(2);
      expect(recent[0].file_name).toBe('new.mp3'); // Most recent first
      expect(recent[1].file_name).toBe('old.mp3');
    });

    it('should respect limit parameter', async () => {
      // Create 3 files
      for (let i = 1; i <= 3; i++) {
        await repository.create({
          file_name: `test${i}.mp3`,
          original_file_name: `test${i}-original.mp3`,
          original_file_type: 'audio/mpeg',
          file_size: 1024 * i,
          file_hash: `hash-${i}`,
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
        file_name: 'today.mp3',
        original_file_name: 'today-original.mp3',
        original_file_type: 'audio/mpeg',
        file_size: 1024,
        file_hash: 'hash-today',
      });

      const filesInRange = await repository.findByDateRange(
        yesterday,
        tomorrow
      );
      expect(filesInRange).toHaveLength(1);
      expect(filesInRange[0].file_name).toBe('today.mp3');
    });
  });

  describe('findByFileType', () => {
    it('should find files by file type', async () => {
      await repository.create({
        file_name: 'test.mp3',
        original_file_name: 'test-original.mp3',
        original_file_type: 'audio/mpeg',
        file_size: 1024,
        file_hash: 'hash-mp3',
      });

      await repository.create({
        file_name: 'test.wav',
        original_file_name: 'test-original.wav',
        original_file_type: 'audio/wav',
        file_size: 2048,
        file_hash: 'hash-wav',
      });

      const mp3Files = await repository.findByFileType('audio/mpeg');
      expect(mp3Files).toHaveLength(1);
      expect(mp3Files[0].original_file_type).toBe('audio/mpeg');

      const wavFiles = await repository.findByFileType('audio/wav');
      expect(wavFiles).toHaveLength(1);
      expect(wavFiles[0].original_file_type).toBe('audio/wav');
    });
  });

  describe('getTotalSize', () => {
    it('should calculate total size of all files', async () => {
      await repository.create({
        file_name: 'test1.mp3',
        original_file_name: 'test1-original.mp3',
        original_file_type: 'audio/mpeg',
        file_size: 1024,
        file_hash: 'hash-1',
      });

      await repository.create({
        file_name: 'test2.mp3',
        original_file_name: 'test2-original.mp3',
        original_file_type: 'audio/mpeg',
        file_size: 2048,
        file_hash: 'hash-2',
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
        file_name: 'test1.mp3',
        original_file_name: 'test1-original.mp3',
        original_file_type: 'audio/mpeg',
        file_size: 1000,
        file_hash: 'hash-1',
        duration: 60,
      });

      await repository.create({
        file_name: 'test2.mp3',
        original_file_name: 'test2-original.mp3',
        original_file_type: 'audio/mpeg',
        file_size: 2000,
        file_hash: 'hash-2',
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
