// Base repository
export { BaseRepository } from './BaseRepository';

// Domain repositories
export { AudioRepository } from './AudioRepository';
export { TranscriptionRepository } from './TranscriptRepository';
export { SummarizationRepository } from './SummarizationRepository';
export { SummarizationTemplateRepository } from './TemplateRepository';

// Import types for the factory
import { AudioRepository } from './AudioRepository';
import { TranscriptionRepository } from './TranscriptRepository';
import { SummarizationRepository } from './SummarizationRepository';
import { SummarizationTemplateRepository } from './TemplateRepository';

// Repository factory for dependency injection
export class RepositoryFactory {
  private static _audioRepository: AudioRepository;
  private static _transcriptionRepository: TranscriptionRepository;
  private static _summarizationRepository: SummarizationRepository;
  private static _summarizationTemplateRepository: SummarizationTemplateRepository;

  static get audioRepository(): AudioRepository {
    if (!this._audioRepository) {
      this._audioRepository = new AudioRepository();
    }
    return this._audioRepository;
  }

  static get transcriptionRepository(): TranscriptionRepository {
    if (!this._transcriptionRepository) {
      this._transcriptionRepository = new TranscriptionRepository();
    }
    return this._transcriptionRepository;
  }

  static get summarizationRepository(): SummarizationRepository {
    if (!this._summarizationRepository) {
      this._summarizationRepository = new SummarizationRepository();
    }
    return this._summarizationRepository;
  }

  static get summarizationTemplateRepository(): SummarizationTemplateRepository {
    if (!this._summarizationTemplateRepository) {
      this._summarizationTemplateRepository =
        new SummarizationTemplateRepository();
    }
    return this._summarizationTemplateRepository;
  }

  // Reset all repositories (useful for testing)
  static reset(): void {
    this._audioRepository = undefined as any;
    this._transcriptionRepository = undefined as any;
    this._summarizationRepository = undefined as any;
    this._summarizationTemplateRepository = undefined as any;
  }
}
