// Legacy database exports for backward compatibility
// This file provides the old interface while using the new database structure

import {
  db,
  AudioRepository,
  ExtractionRepository,
  SummarizationRepository,
  ExtractionTemplateRepository,
  SummarizationTemplateRepository,
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
  eq,
  and,
  or,
  desc,
  asc,
  count,
  sql,
  inArray,
} from './database';

// Export the database connection
export { db };

// Export schema tables
export {
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

// Export query operators
export { eq, and, or, desc, asc, count, sql, inArray };

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
      const result = await db.select().from(systemSettings).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Failed to get settings:', error);
      return null;
    }
  },
  async update(data: any) {
    try {
      const existing = await this.get();
      if (existing) {
        await db
          .update(systemSettings)
          .set(data)
          .where(eq(systemSettings.id, existing.id));
      } else {
        await db.insert(systemSettings).values({ id: 1, ...data });
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

// Export additional schema items
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

// Export types for backward compatibility
export type {
  AudioFile,
  NewAudioFile,
  Extraction,
  NewExtraction,
  ExtractionTemplate,
  NewExtractionTemplate,
  Summarization,
  NewSummarization,
  TranscriptionJob,
  NewTranscriptionJob,
  TranscriptSegment,
} from './database';
