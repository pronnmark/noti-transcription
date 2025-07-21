import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RepositoryFactory } from '@/lib/database/repositories';
import { AudioRepository } from '@/lib/database/repositories/AudioRepository';
import { TranscriptionRepository } from '@/lib/database/repositories/TranscriptRepository';
import { ExtractionRepository } from '@/lib/database/repositories/ExtractionRepository';
import { SummarizationRepository } from '@/lib/database/repositories/SummarizationRepository';
import { ExtractionTemplateRepository, SummarizationTemplateRepository } from '@/lib/database/repositories/TemplateRepository';

describe('RepositoryFactory', () => {
  beforeEach(() => {
    // Reset factory before each test
    RepositoryFactory.reset();
  });

  afterEach(() => {
    // Clean up after each test
    RepositoryFactory.reset();
  });

  describe('audioRepository', () => {
    it('should return AudioRepository instance', () => {
      const repo = RepositoryFactory.audioRepository;
      expect(repo).toBeInstanceOf(AudioRepository);
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const repo1 = RepositoryFactory.audioRepository;
      const repo2 = RepositoryFactory.audioRepository;
      expect(repo1).toBe(repo2);
    });

    it('should return new instance after reset', () => {
      const repo1 = RepositoryFactory.audioRepository;
      RepositoryFactory.reset();
      const repo2 = RepositoryFactory.audioRepository;
      expect(repo1).not.toBe(repo2);
    });
  });

  describe('transcriptionRepository', () => {
    it('should return TranscriptionRepository instance', () => {
      const repo = RepositoryFactory.transcriptionRepository;
      expect(repo).toBeInstanceOf(TranscriptionRepository);
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const repo1 = RepositoryFactory.transcriptionRepository;
      const repo2 = RepositoryFactory.transcriptionRepository;
      expect(repo1).toBe(repo2);
    });
  });

  describe('extractionRepository', () => {
    it('should return ExtractionRepository instance', () => {
      const repo = RepositoryFactory.extractionRepository;
      expect(repo).toBeInstanceOf(ExtractionRepository);
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const repo1 = RepositoryFactory.extractionRepository;
      const repo2 = RepositoryFactory.extractionRepository;
      expect(repo1).toBe(repo2);
    });
  });

  describe('summarizationRepository', () => {
    it('should return SummarizationRepository instance', () => {
      const repo = RepositoryFactory.summarizationRepository;
      expect(repo).toBeInstanceOf(SummarizationRepository);
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const repo1 = RepositoryFactory.summarizationRepository;
      const repo2 = RepositoryFactory.summarizationRepository;
      expect(repo1).toBe(repo2);
    });
  });

  describe('extractionTemplateRepository', () => {
    it('should return ExtractionTemplateRepository instance', () => {
      const repo = RepositoryFactory.extractionTemplateRepository;
      expect(repo).toBeInstanceOf(ExtractionTemplateRepository);
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const repo1 = RepositoryFactory.extractionTemplateRepository;
      const repo2 = RepositoryFactory.extractionTemplateRepository;
      expect(repo1).toBe(repo2);
    });
  });

  describe('summarizationTemplateRepository', () => {
    it('should return SummarizationTemplateRepository instance', () => {
      const repo = RepositoryFactory.summarizationTemplateRepository;
      expect(repo).toBeInstanceOf(SummarizationTemplateRepository);
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const repo1 = RepositoryFactory.summarizationTemplateRepository;
      const repo2 = RepositoryFactory.summarizationTemplateRepository;
      expect(repo1).toBe(repo2);
    });
  });

  describe('reset', () => {
    it('should reset all repository instances', () => {
      // Get all repositories
      const audio1 = RepositoryFactory.audioRepository;
      const transcription1 = RepositoryFactory.transcriptionRepository;
      const extraction1 = RepositoryFactory.extractionRepository;
      const summarization1 = RepositoryFactory.summarizationRepository;
      const extractionTemplate1 = RepositoryFactory.extractionTemplateRepository;
      const summarizationTemplate1 = RepositoryFactory.summarizationTemplateRepository;

      // Reset factory
      RepositoryFactory.reset();

      // Get repositories again
      const audio2 = RepositoryFactory.audioRepository;
      const transcription2 = RepositoryFactory.transcriptionRepository;
      const extraction2 = RepositoryFactory.extractionRepository;
      const summarization2 = RepositoryFactory.summarizationRepository;
      const extractionTemplate2 = RepositoryFactory.extractionTemplateRepository;
      const summarizationTemplate2 = RepositoryFactory.summarizationTemplateRepository;

      // All should be different instances
      expect(audio1).not.toBe(audio2);
      expect(transcription1).not.toBe(transcription2);
      expect(extraction1).not.toBe(extraction2);
      expect(summarization1).not.toBe(summarization2);
      expect(extractionTemplate1).not.toBe(extractionTemplate2);
      expect(summarizationTemplate1).not.toBe(summarizationTemplate2);
    });
  });

  describe('integration', () => {
    it('should provide working repository instances', () => {
      const audioRepo = RepositoryFactory.audioRepository;
      const transcriptionRepo = RepositoryFactory.transcriptionRepository;

      // Should have expected methods
      expect(typeof audioRepo.findByHash).toBe('function');
      expect(typeof audioRepo.findByFileName).toBe('function');
      expect(typeof audioRepo.getStatistics).toBe('function');

      expect(typeof transcriptionRepo.findByFileId).toBe('function');
      expect(typeof transcriptionRepo.updateStatus).toBe('function');
      expect(typeof transcriptionRepo.completeTranscription).toBe('function');
    });

    it('should maintain repository independence', () => {
      const audioRepo1 = RepositoryFactory.audioRepository;
      const audioRepo2 = RepositoryFactory.audioRepository;
      const transcriptionRepo = RepositoryFactory.transcriptionRepository;

      // Same type repositories should be identical
      expect(audioRepo1).toBe(audioRepo2);

      // Different type repositories should be different
      expect(audioRepo1).not.toBe(transcriptionRepo);
    });
  });
});
