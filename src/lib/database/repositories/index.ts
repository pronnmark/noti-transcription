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

// Import the new repositories
import { AudioStatsRepository } from './AudioStatsRepository';
import { DatabaseClient } from '../interfaces/DatabaseClient';
import { getDatabaseClient } from '../client';

// Repository factory for dependency injection with proper DI
export class RepositoryFactory {
  private static _audioRepository: AudioRepository;
  private static _audioStatsRepository: AudioStatsRepository;
  private static _transcriptionRepository: TranscriptionRepository;
  private static _summarizationRepository: SummarizationRepository;
  private static _summarizationTemplateRepository: SummarizationTemplateRepository;
  private static _databaseClient: DatabaseClient;

  private static getDatabaseClient(): DatabaseClient {
    if (!this._databaseClient) {
      this._databaseClient = getDatabaseClient();
    }
    return this._databaseClient;
  }

  static get audioRepository(): AudioRepository {
    if (!this._audioRepository) {
      this._audioRepository = new AudioRepository(this.getDatabaseClient());
    }
    return this._audioRepository;
  }

  static get audioStatsRepository(): AudioStatsRepository {
    if (!this._audioStatsRepository) {
      this._audioStatsRepository = new AudioStatsRepository(this.getDatabaseClient());
    }
    return this._audioStatsRepository;
  }

  static get transcriptionRepository(): TranscriptionRepository {
    if (!this._transcriptionRepository) {
      this._transcriptionRepository = new TranscriptionRepository(this.getDatabaseClient());
    }
    return this._transcriptionRepository;
  }

  static get summarizationRepository(): SummarizationRepository {
    if (!this._summarizationRepository) {
      this._summarizationRepository = new SummarizationRepository(this.getDatabaseClient());
    }
    return this._summarizationRepository;
  }

  static get summarizationTemplateRepository(): SummarizationTemplateRepository {
    if (!this._summarizationTemplateRepository) {
      this._summarizationTemplateRepository =
        new SummarizationTemplateRepository(this.getDatabaseClient());
    }
    return this._summarizationTemplateRepository;
  }

  // Override database client (useful for testing with mocks)
  static setDatabaseClient(client: DatabaseClient): void {
    this._databaseClient = client;
    this.reset(); // Reset all repositories to use new client
  }

  // Reset all repositories (useful for testing)
  static reset(): void {
    this._audioRepository = undefined as any;
    this._audioStatsRepository = undefined as any;
    this._transcriptionRepository = undefined as any;
    this._summarizationRepository = undefined as any;
    this._summarizationTemplateRepository = undefined as any;
  }
}
