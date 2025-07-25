// Database client and utilities
export { getDb, getSqlite, healthCheck, closeDatabase, ensureConnection } from './client';

// Direct exports for better ESM compatibility - create singleton instance
import { getDb } from './client';
export const db = getDb();

export { getSqlite as sqlite } from './client';

// Schema exports
export * from './schema';

// Repository exports
export * from './repositories';

// Drizzle ORM operators
export { eq, and, or, not, isNull, isNotNull, inArray, notInArray, exists, notExists, between, like, ilike, desc, asc, count, sum, avg, min, max, sql } from 'drizzle-orm';

// Note: Database initialization and migration utilities are available in
// separate server-only exports to avoid bundling Node.js modules in client code

// Re-export commonly used types
export type {
  AudioFile,
  NewAudioFile,
  TranscriptionJob,
  NewTranscriptionJob,
  Extraction,
  NewExtraction,
  ExtractionTemplate,
  NewExtractionTemplate,
  Summarization,
  NewSummarization,
  SummarizationTemplate,
  NewSummarizationTemplate,
  TranscriptSegment,
} from './schema';
