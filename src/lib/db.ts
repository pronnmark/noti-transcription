// Legacy database exports for backward compatibility
// This file provides the old interface while using the new Supabase-based structure

import {
  RepositoryFactory,
  getSupabase,
} from './database';

// Export the Supabase client as db for backward compatibility
export const db = getSupabase();

// Legacy table name exports (these are now just string references for table names)
export const audioFiles = 'audio_files';
export const summarizations = 'summarizations';
export const summarizationTemplates = 'summarization_templates';
export const transcriptionJobs = 'transcription_jobs';
export const systemSettings = 'system_settings';
export const psychologicalEvaluations = 'psychological_evaluations';
export const summarizationPrompts = 'summarization_prompts';
export const aiProcessingSessions = 'ai_processing_sessions';

// Legacy aliases for backward compatibility
export const settings = systemSettings;
export const psychologyProfiles = psychologicalEvaluations;

// Legacy service instances for backward compatibility
export const audioFilesService = RepositoryFactory.audioRepository;
export const summarizationsService = RepositoryFactory.summarizationRepository;
export const summarizationTemplatesService = RepositoryFactory.summarizationTemplateRepository;

// Legacy settings service - DEPRECATED: Use repositories instead
// Keeping minimal implementation for backward compatibility with /api/settings route
export const settingsService = {
  async get() {
    try {
      const { data, error } = await db
        .from('system_settings')
        .select('*')
        .limit(1)
        .single();

      // Handle missing table (PGRST116) or PostgreSQL relation error (42P01)
      if (error && (error.code === 'PGRST116' || error.code === '42P01')) {
        return null;
      }

      if (error) {
        throw error;
      }

      return data || null;
    } catch (error) {
      // Silently handle missing table errors
      if (error && typeof error === 'object' && 'code' in error && 
          (error.code === 'PGRST116' || error.code === '42P01')) {
        return null;
      }
      // Only log unexpected errors
      console.error('Failed to get settings:', error);
      return null;
    }
  },
  async update(data: any) {
    try {
      const existing = await this.get();
      if (existing) {
        const { error } = await db
          .from('system_settings')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await db
          .from('system_settings')
          .insert({
            id: 1,
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  },
};

// Legacy services removed - Use repositories instead

// Legacy services removed - Use repositories instead

// TODO: Implement audio file parsing logic
// Should extract metadata like duration, peaks, format, etc.
export const parseAudioFile = async (filePath: string) => {
  // TODO: Add actual audio parsing implementation
  // - Use ffprobe for metadata extraction
  // - Generate waveform peaks for visualization
  // - Extract format information and duration
  return { duration: 0, peaks: [] };
};

// Export additional schema items (now just table name strings)
export const schema = {
  audioFiles,
  summarizations,
  summarizationTemplates,
  transcriptionJobs,
  systemSettings,
  psychologicalEvaluations,
  summarizationPrompts,
  aiProcessingSessions,
};

// Basic TypeScript types for backward compatibility
export interface AudioFile {
  id: number;
  file_name: string;
  original_file_name: string;
  file_size: number;
  duration?: number;
  uploaded_at: string;
  updated_at: string;
}

export interface TranscriptionJob {
  id: number;
  file_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transcript?: any;
  created_at: string;
  updated_at: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}
