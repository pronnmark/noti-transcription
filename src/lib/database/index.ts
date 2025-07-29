// Export Supabase client and database utilities
export {
  supabase,
  getSupabase,
  healthCheck,
  ensureConnection,
  closeDatabase,
} from './client';

// Export database types
export type {
  AudioFile,
  TranscriptionJob,
  SpeakerLabel,
  FileLabel,
} from './client';

// Export repositories
export * from './repositories';