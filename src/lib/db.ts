// Legacy database exports for backward compatibility
// This file provides the old interface while using the new Supabase-based structure

import {
  AudioRepository,
  ExtractionRepository,
  SummarizationRepository,
  ExtractionTemplateRepository,
  SummarizationTemplateRepository,
  getSupabase,
} from './database';

// Export the Supabase client as db for backward compatibility
export const db = getSupabase();

// Legacy table name exports (these are now just string references for table names)
export const audioFiles = 'audio_files';
export const extractions = 'extractions';
export const summarizations = 'summarizations';
export const extractionTemplates = 'extraction_templates';
export const summarizationTemplates = 'summarization_templates';
export const transcriptionJobs = 'transcription_jobs';
export const systemSettings = 'system_settings';
export const psychologicalEvaluations = 'psychological_evaluations';
export const dataPoints = 'data_points';
export const dataPointTemplates = 'data_point_templates';
export const summarizationPrompts = 'summarization_prompts';
export const extractionDefinitions = 'extraction_definitions';
export const extractionResults = 'extraction_results';
export const aiProcessingSessions = 'ai_processing_sessions';

// Legacy aliases for backward compatibility
export const settings = systemSettings;
export const psychologyProfiles = psychologicalEvaluations;
export const aiExtracts = extractions;
export const aiExtractTemplates = extractionTemplates;

// Legacy service instances for backward compatibility
export const audioFilesService = new AudioRepository();
export const extractionsService = new ExtractionRepository();
export const aiExtractsService = extractionsService; // Alias for backward compatibility
export const summarizationsService = new SummarizationRepository();
export const templatesService = new ExtractionTemplateRepository();
export const summarizationTemplatesService =
  new SummarizationTemplateRepository();

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
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return data || null;
    } catch (error) {
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
          .insert({ id: 1, ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        
        if (error) throw error;
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  },
};

// Legacy services removed - Use repositories instead

// Legacy notesService removed - Use ExtractionRepository instead

// Helper function for parsing audio files (placeholder)
export const parseAudioFile = async (filePath: string) => {
  // This would contain audio parsing logic
  return { duration: 0, peaks: [] };
};

// Export additional schema items (now just table name strings)
export const schema = {
  audioFiles,
  extractions,
  summarizations,
  extractionTemplates,
  summarizationTemplates,
  transcriptionJobs,
  systemSettings,
  psychologicalEvaluations,
  dataPoints,
  dataPointTemplates,
  summarizationPrompts,
  extractionDefinitions,
  extractionResults,
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
