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
export const summarizationTemplatesService = new SummarizationTemplateRepository();

// Settings service (simplified for backward compatibility)
export const settingsService = {
  async get() {
    try {
      const result = await db.select().from(systemSettings).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Failed to get settings:', error);
      // If table doesn't exist, return null
      if (error instanceof Error && error.message.includes('no such table')) {
        return null;
      }
      return null;
    }
  },

  async ensureTableExists() {
    try {
      // Drop existing table if it has wrong schema, then recreate
      await db.run(`DROP TABLE IF EXISTS system_settings`);
      console.log('Dropped existing system_settings table');

      // Create table with exact schema matching Drizzle expectations
      await db.run(`CREATE TABLE system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        is_initialized INTEGER DEFAULT 0 NOT NULL,
        first_startup_date INTEGER,
        last_startup_date INTEGER,
        whisper_model_sizes TEXT DEFAULT '["tiny","base","small","medium","large"]',
        whisper_quantization TEXT DEFAULT 'none',
        obsidian_enabled INTEGER DEFAULT 0,
        obsidian_vault_path TEXT,
        obsidian_folder TEXT,
        openai_api_key TEXT,
        custom_ai_base_url TEXT,
        custom_ai_api_key TEXT,
        custom_ai_model TEXT,
        custom_ai_provider TEXT DEFAULT 'custom',
        ai_extract_enabled INTEGER DEFAULT 0,
        ai_extract_prompt TEXT,
        ai_extract_output_path TEXT,
        ai_extract_model TEXT,
        notes_prompts TEXT,
        psych_eval_enabled INTEGER DEFAULT 0,
        psych_eval_auto_run INTEGER DEFAULT 0,
        extraction_auto_run TEXT
      )`);
      console.log('Created system_settings table with correct schema');
    } catch (error) {
      console.error('Failed to ensure table exists:', error);
      throw error;
    }
  },

  async update(data: any) {
    try {
      // Ensure table exists first
      await this.ensureTableExists();

      // Check if settings exist
      const existing = await this.get();

      if (existing) {
        console.log('Updating existing settings with ID:', existing.id);
        await db.update(systemSettings)
          .set(data)
          .where(eq(systemSettings.id, existing.id));
      } else {
        console.log('Creating new settings record');
        await db.insert(systemSettings).values({
          id: 1,
          ...data,
        });
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  },

  async create(data: any) {
    try {
      const [result] = await db.insert(systemSettings).values(data).returning();
      return result;
    } catch (error) {
      console.error('Failed to create settings:', error);
      throw error;
    }
  },
};

// Psychology service (simplified for backward compatibility)
export const psychologyService = {
  async getProfile(fileId: number) {
    try {
      const result = await db.select()
        .from(psychologicalEvaluations)
        .where(eq(psychologicalEvaluations.fileId, fileId))
        .limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Failed to get psychology profile:', error);
      return null;
    }
  },

  async updateProfile(fileId: number, data: any) {
    try {
      const existing = await this.getProfile(fileId);

      if (existing) {
        await db.update(psychologicalEvaluations)
          .set(data)
          .where(eq(psychologicalEvaluations.fileId, fileId));
      } else {
        await db.insert(psychologicalEvaluations).values({
          fileId,
          ...data,
        });
      }
    } catch (error) {
      console.error('Failed to update psychology profile:', error);
      throw error;
    }
  },
};

// Data points service (simplified for backward compatibility)
export const dataPointsService = {
  async create(data: any) {
    try {
      const [result] = await db.insert(dataPoints).values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return result;
    } catch (error) {
      console.error('Failed to create data point:', error);
      throw error;
    }
  },

  async findByFileId(fileId: number) {
    try {
      return await db.select()
        .from(dataPoints)
        .where(eq(dataPoints.fileId, fileId))
        .orderBy(desc(dataPoints.createdAt));
    } catch (error) {
      console.error('Failed to find data points by file ID:', error);
      return [];
    }
  },

  async findByTemplate(templateId: string) {
    try {
      return await db.select()
        .from(dataPoints)
        .where(eq(dataPoints.templateId, templateId))
        .orderBy(desc(dataPoints.createdAt));
    } catch (error) {
      console.error('Failed to find data points by template:', error);
      return [];
    }
  },
};

// Notes service (simplified for backward compatibility)
export const notesService = {
  async create(data: any) {
    try {
      const [result] = await db.insert(extractions).values(data).returning();
      return result;
    } catch (error) {
      console.error('Failed to create note:', error);
      throw error;
    }
  },

  async findByFileId(fileId: number) {
    try {
      return await db.select()
        .from(extractions)
        .where(eq(extractions.fileId, fileId))
        .orderBy(desc(extractions.createdAt));
    } catch (error) {
      console.error('Failed to find notes by file ID:', error);
      return [];
    }
  },

  async findByFileIdAndType(fileId: number, type: string) {
    try {
      // Since the new schema doesn't have a 'type' field, we'll filter by templateId
      // For now, return all extractions for the file (this method may need to be updated
      // when we have proper template-based filtering)
      return await db.select()
        .from(extractions)
        .where(eq(extractions.fileId, fileId))
        .orderBy(desc(extractions.createdAt));
    } catch (error) {
      console.error('Failed to find notes by file ID and type:', error);
      return [];
    }
  },

  async update(id: string, data: any) {
    try {
      const result = await db.update(extractions)
        .set(data)
        .where(eq(extractions.id, id));
      return true;
    } catch (error) {
      console.error('Failed to update note:', error);
      return false;
    }
  },

  async delete(id: string) {
    try {
      const result = await db.delete(extractions).where(eq(extractions.id, id));
      return true;
    } catch (error) {
      console.error('Failed to delete note:', error);
      return false;
    }
  },

  async addComment(id: string, comment: string) {
    try {
      const existing = await db.select()
        .from(extractions)
        .where(eq(extractions.id, id))
        .limit(1);

      if (existing.length === 0) {
        return false;
      }

      const currentComments = existing[0].comments || '';
      const newComments = currentComments
        ? `${currentComments}\n---\n${comment}`
        : comment;

      await db.update(extractions)
        .set({
          comments: newComments,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(extractions.id, id));

      return true;
    } catch (error) {
      console.error('Failed to add comment:', error);
      return false;
    }
  },

  async updateComment(id: string, comment: string) {
    try {
      const existing = await db.select()
        .from(extractions)
        .where(eq(extractions.id, id))
        .limit(1);

      if (existing.length === 0) {
        return false;
      }

      await db.update(extractions)
        .set({
          comments: comment,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(extractions.id, id));

      return true;
    } catch (error) {
      console.error('Failed to update comment:', error);
      return false;
    }
  },

  async toggleStatus(id: string, status: string) {
    try {
      const existing = await db.select()
        .from(extractions)
        .where(eq(extractions.id, id))
        .limit(1);

      if (existing.length === 0) {
        return false;
      }

      await db.update(extractions)
        .set({
          status: status as 'active' | 'completed' | 'archived',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(extractions.id, id));

      return true;
    } catch (error) {
      console.error('Failed to toggle status:', error);
      return false;
    }
  },

  async updateFileNotesCount(fileId: number) {
    try {
      // This is a placeholder - in the new schema, we don't store counts on the file
      // The count is calculated dynamically when needed
      return true;
    } catch (error) {
      console.error('Failed to update file notes count:', error);
      return false;
    }
  },

  async getStats(fileId: number) {
    try {
      const notes = await this.findByFileId(fileId);

      const stats = {
        total: notes.length,
        active: notes.filter(n => n.status === 'active').length,
        completed: notes.filter(n => n.status === 'completed').length,
        archived: notes.filter(n => n.status === 'archived').length,
        byPriority: {
          high: notes.filter(n => n.priority === 'high').length,
          medium: notes.filter(n => n.priority === 'medium').length,
          low: notes.filter(n => n.priority === 'low').length,
        },
        recentActivity: notes
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5)
          .map(n => ({
            id: n.id,
            content: n.content.substring(0, 100),
            status: n.status,
            updatedAt: n.updatedAt,
          })),
      };

      return stats;
    } catch (error) {
      console.error('Failed to get notes stats:', error);
      return {
        total: 0,
        active: 0,
        completed: 0,
        archived: 0,
        byPriority: { high: 0, medium: 0, low: 0 },
        recentActivity: [],
      };
    }
  },

  async getTasksWithFileInfo() {
    try {
      const tasks = await db.select({
        id: extractions.id,
        content: extractions.content,
        status: extractions.status,
        priority: extractions.priority,
        createdAt: extractions.createdAt,
        updatedAt: extractions.updatedAt,
        fileId: extractions.fileId,
        fileName: audioFiles.fileName,
        originalFileName: audioFiles.originalFileName,
      })
        .from(extractions)
        .innerJoin(audioFiles, eq(extractions.fileId, audioFiles.id))
        .orderBy(desc(extractions.updatedAt));

      return tasks;
    } catch (error) {
      console.error('Failed to get tasks with file info:', error);
      return [];
    }
  },

  async getTasksByStatus(status: 'active' | 'completed' | 'archived') {
    try {
      return await db.select()
        .from(extractions)
        .where(eq(extractions.status, status))
        .orderBy(desc(extractions.updatedAt));
    } catch (error) {
      console.error('Failed to get tasks by status:', error);
      return [];
    }
  },

  async getAllTasks() {
    try {
      return await db.select()
        .from(extractions)
        .orderBy(desc(extractions.updatedAt));
    } catch (error) {
      console.error('Failed to get all tasks:', error);
      return [];
    }
  },

  async getGlobalStats() {
    try {
      const allNotes = await this.getAllTasks();

      const stats = {
        total: allNotes.length,
        active: allNotes.filter(n => n.status === 'active').length,
        completed: allNotes.filter(n => n.status === 'completed').length,
        archived: allNotes.filter(n => n.status === 'archived').length,
        byPriority: {
          high: allNotes.filter(n => n.priority === 'high').length,
          medium: allNotes.filter(n => n.priority === 'medium').length,
          low: allNotes.filter(n => n.priority === 'low').length,
        },
        recentActivity: allNotes
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 10)
          .map(n => ({
            id: n.id,
            content: n.content.substring(0, 100),
            status: n.status,
            fileId: n.fileId,
            updatedAt: n.updatedAt,
          })),
        completionRate: allNotes.length > 0
          ? Math.round((allNotes.filter(n => n.status === 'completed').length / allNotes.length) * 100)
          : 0,
      };

      return stats;
    } catch (error) {
      console.error('Failed to get global stats:', error);
      return {
        total: 0,
        active: 0,
        completed: 0,
        archived: 0,
        byPriority: { high: 0, medium: 0, low: 0 },
        recentActivity: [],
        completionRate: 0,
      };
    }
  },
};

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
