/**
 * Dependency Injection Container Setup
 * 
 * Configures the DI container with all services and repositories.
 * This replaces the singleton RepositoryFactory pattern.
 */

import { container, TOKENS } from './DIContainer';
import { getDatabaseClient } from '../database/client';
import { AudioRepository } from '../database/repositories/AudioRepository';
import { AudioStatsRepository } from '../database/repositories/AudioStatsRepository';
import { TranscriptionRepository } from '../database/repositories/TranscriptRepository';
import { SummarizationRepository } from '../database/repositories/SummarizationRepository';
import { SummarizationTemplateRepository } from '../database/repositories/TemplateRepository';
import { ValidationService } from '../services/ValidationService';
import { ErrorHandlingService } from '../services/ErrorHandlingService';
import { TranscriptionService } from '../services/core/TranscriptionService';
import { AudioService } from '../services/core/AudioService';

/**
 * Initialize the dependency injection container
 */
export function setupDIContainer(): void {
  // Register database client
  container.register(
    TOKENS.DATABASE_CLIENT,
    () => getDatabaseClient(),
    { singleton: true }
  );

  // Register repositories with dependency injection
  container.registerClass(
    TOKENS.AUDIO_REPOSITORY,
    AudioRepository,
    [TOKENS.DATABASE_CLIENT],
    { singleton: true }
  );

  container.registerClass(
    TOKENS.AUDIO_STATS_REPOSITORY,
    AudioStatsRepository,
    [TOKENS.DATABASE_CLIENT],
    { singleton: true }
  );

  container.registerClass(
    TOKENS.TRANSCRIPTION_REPOSITORY,
    TranscriptionRepository,
    [TOKENS.DATABASE_CLIENT],
    { singleton: true }
  );

  container.registerClass(
    TOKENS.SUMMARIZATION_REPOSITORY,
    SummarizationRepository,
    [TOKENS.DATABASE_CLIENT],
    { singleton: true }
  );

  container.registerClass(
    TOKENS.SUMMARIZATION_TEMPLATE_REPOSITORY,
    SummarizationTemplateRepository,
    [TOKENS.DATABASE_CLIENT],
    { singleton: true }
  );

  // Register services
  container.register(
    TOKENS.VALIDATION_SERVICE,
    () => new ValidationService(),
    { singleton: true }
  );

  container.register(
    TOKENS.ERROR_HANDLING_SERVICE,
    () => new ErrorHandlingService(),
    { singleton: true }
  );

  // Register TranscriptionService with proper DI
  container.registerClass(
    TOKENS.TRANSCRIPTION_SERVICE,
    TranscriptionService,
    [TOKENS.TRANSCRIPTION_REPOSITORY, TOKENS.VALIDATION_SERVICE],
    { singleton: true }
  );

  // Register AudioService with proper DI
  container.registerClass(
    TOKENS.AUDIO_SERVICE,
    AudioService,
    [
      TOKENS.AUDIO_REPOSITORY,
      TOKENS.AUDIO_STATS_REPOSITORY,
      TOKENS.TRANSCRIPTION_REPOSITORY,
      TOKENS.VALIDATION_SERVICE
    ],
    { singleton: true }
  );
}

/**
 * Get a service from the container with type safety
 */
export function getService<T>(token: symbol): T {
  return container.resolve<T>(token);
}

/**
 * Convenience functions for commonly used services
 */
export const getAudioRepository = () => 
  getService<AudioRepository>(TOKENS.AUDIO_REPOSITORY);

export const getAudioStatsRepository = () => 
  getService<AudioStatsRepository>(TOKENS.AUDIO_STATS_REPOSITORY);

export const getTranscriptionRepository = () => 
  getService<TranscriptionRepository>(TOKENS.TRANSCRIPTION_REPOSITORY);

export const getSummarizationRepository = () => 
  getService<SummarizationRepository>(TOKENS.SUMMARIZATION_REPOSITORY);

export const getSummarizationTemplateRepository = () => 
  getService<SummarizationTemplateRepository>(TOKENS.SUMMARIZATION_TEMPLATE_REPOSITORY);

export const getValidationService = () => 
  getService<ValidationService>(TOKENS.VALIDATION_SERVICE);

export const getErrorHandlingService = () => 
  getService<ErrorHandlingService>(TOKENS.ERROR_HANDLING_SERVICE);

export const getTranscriptionService = () => 
  getService<TranscriptionService>(TOKENS.TRANSCRIPTION_SERVICE);

export const getAudioService = () => 
  getService<AudioService>(TOKENS.AUDIO_SERVICE);

// Initialize container on module load
setupDIContainer();