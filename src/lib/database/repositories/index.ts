// Base repository
export { BaseRepository, type IRepository } from './BaseRepository';

// Domain repositories
export { AudioRepository } from './AudioRepository';
export { TranscriptionRepository } from './TranscriptRepository';
export { ExtractionRepository } from './ExtractionRepository';
export { SummarizationRepository } from './SummarizationRepository';
export {
  ExtractionTemplateRepository,
  SummarizationTemplateRepository,
} from './TemplateRepository';

// Import types for the factory
import { AudioRepository } from './AudioRepository';
import { TranscriptionRepository } from './TranscriptRepository';
import { ExtractionRepository } from './ExtractionRepository';
import { SummarizationRepository } from './SummarizationRepository';
import { ExtractionTemplateRepository, SummarizationTemplateRepository } from './TemplateRepository';

// Repository factory for dependency injection
export class RepositoryFactory {
  private static _audioRepository: AudioRepository;
  private static _transcriptionRepository: TranscriptionRepository;
  private static _extractionRepository: ExtractionRepository;
  private static _summarizationRepository: SummarizationRepository;
  private static _extractionTemplateRepository: ExtractionTemplateRepository;
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

  static get extractionRepository(): ExtractionRepository {
    if (!this._extractionRepository) {
      this._extractionRepository = new ExtractionRepository();
    }
    return this._extractionRepository;
  }

  static get summarizationRepository(): SummarizationRepository {
    if (!this._summarizationRepository) {
      this._summarizationRepository = new SummarizationRepository();
    }
    return this._summarizationRepository;
  }

  static get extractionTemplateRepository(): ExtractionTemplateRepository {
    if (!this._extractionTemplateRepository) {
      this._extractionTemplateRepository = new ExtractionTemplateRepository();
    }
    return this._extractionTemplateRepository;
  }

  static get summarizationTemplateRepository(): SummarizationTemplateRepository {
    if (!this._summarizationTemplateRepository) {
      this._summarizationTemplateRepository = new SummarizationTemplateRepository();
    }
    return this._summarizationTemplateRepository;
  }

  // Reset all repositories (useful for testing)
  static reset(): void {
    this._audioRepository = undefined as any;
    this._transcriptionRepository = undefined as any;
    this._extractionRepository = undefined as any;
    this._summarizationRepository = undefined as any;
    this._extractionTemplateRepository = undefined as any;
    this._summarizationTemplateRepository = undefined as any;
  }
}
