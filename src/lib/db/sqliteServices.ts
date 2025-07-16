import { db } from './sqlite';
import { audioFiles, speakerLabels, aiExtracts, summarizationTemplates, systemSettings } from './sqliteSchema';
import { eq, desc, sql, and } from 'drizzle-orm';
import type { TranscriptSegment } from './sqliteSchema';
import { createId } from '@paralleldrive/cuid2';

// Audio Files Service
export const audioFilesService = {
  async create(data: {
    fileName: string;
    originalFileName: string;
    originalFileType: string;
    fileSize: number;
    fileHash?: string;
    duration?: number;
    transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  }) {
    try {
      const result = await db.insert(audioFiles).values({
        fileName: data.fileName,
        originalFileName: data.originalFileName,
        originalFileType: data.originalFileType,
        fileSize: data.fileSize,
        fileHash: data.fileHash,
        duration: data.duration,
        transcriptionStatus: data.transcriptionStatus || 'pending',
      }).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating audio file:', error);
      throw error;
    }
  },

  async findById(id: number) {
    try {
      const [file] = await db.select().from(audioFiles).where(eq(audioFiles.id, id)).limit(1);
      return file || null;
    } catch (error) {
      console.error('Error finding audio file:', error);
      return null;
    }
  },

  async findAll() {
    try {
      return await db.select().from(audioFiles).orderBy(desc(audioFiles.uploadedAt));
    } catch (error) {
      console.error('Error fetching all audio files:', error);
      return [];
    }
  },

  async update(id: number, data: any) {
    try {
      const [updated] = await db.update(audioFiles)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(audioFiles.id, id))
        .returning();
      return updated || null;
    } catch (error) {
      console.error('Error updating audio file:', error);
      return null;
    }
  },

  async updateTranscript(id: number, transcript: TranscriptSegment[], status: 'completed' | 'failed' = 'completed') {
    try {
      const [updated] = await db.update(audioFiles)
        .set({
          transcript: transcript as any,
          transcriptionStatus: status,
          transcribedAt: status === 'completed' ? new Date() : null,
          transcriptionProgress: status === 'completed' ? 100 : 0,
          updatedAt: new Date(),
        } as any)
        .where(eq(audioFiles.id, id))
        .returning();
      return updated || null;
    } catch (error) {
      console.error('Error updating transcript:', error);
      return null;
    }
  },

  async updateProgress(id: number, progress: number) {
    try {
      await db.update(audioFiles)
        .set({ 
          transcriptionProgress: progress,
          updatedAt: new Date(),
        })
        .where(eq(audioFiles.id, id));
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  },

  async delete(id: number) {
    try {
      const result = await db.delete(audioFiles).where(eq(audioFiles.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting audio file:', error);
      return false;
    }
  },

  // Duplicate detection methods
  async findByHash(fileHash: string) {
    try {
      const [file] = await db.select().from(audioFiles).where(eq(audioFiles.fileHash, fileHash)).limit(1);
      return file || null;
    } catch (error) {
      console.error('Error finding audio file by hash:', error);
      return null;
    }
  },

  async findByFilenameAndSize(originalFileName: string, fileSize: number) {
    try {
      const [file] = await db.select()
        .from(audioFiles)
        .where(and(
          eq(audioFiles.originalFileName, originalFileName),
          eq(audioFiles.fileSize, fileSize)
        ))
        .limit(1);
      return file || null;
    } catch (error) {
      console.error('Error finding audio file by filename and size:', error);
      return null;
    }
  },

  async checkForDuplicates(data: {
    fileHash: string;
    originalFileName: string;
    fileSize: number;
  }) {
    try {
      // Check for exact hash match (most accurate)
      const hashDuplicate = await this.findByHash(data.fileHash);
      if (hashDuplicate) {
        return {
          isDuplicate: true,
          duplicateType: 'hash' as const,
          existingFile: hashDuplicate,
          message: 'An identical file (same content) already exists.'
        };
      }

      // Check for filename + size match (likely duplicate)
      const filenameSizeDuplicate = await this.findByFilenameAndSize(
        data.originalFileName,
        data.fileSize
      );
      if (filenameSizeDuplicate) {
        return {
          isDuplicate: true,
          duplicateType: 'filename_size' as const,
          existingFile: filenameSizeDuplicate,
          message: 'A file with the same name and size already exists.'
        };
      }

      return {
        isDuplicate: false,
        duplicateType: null,
        existingFile: null,
        message: 'No duplicates found.'
      };
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return {
        isDuplicate: false,
        duplicateType: null,
        existingFile: null,
        message: 'Error checking for duplicates.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
};

// Speaker Labels Service
export const speakerLabelsService = {
  async upsert(fileId: number, labels: Record<string, string>) {
    try {
      // Check if exists
      const existing = await db.select().from(speakerLabels).where(eq(speakerLabels.fileId, fileId)).limit(1);
      
      if (existing.length > 0) {
        // Update
        await db.update(speakerLabels)
          .set({ 
            labels: labels as any,
            updatedAt: new Date(),
          })
          .where(eq(speakerLabels.fileId, fileId));
      } else {
        // Insert
        await db.insert(speakerLabels).values({
          fileId,
          labels: labels as any,
        });
      }
    } catch (error) {
      console.error('Error upserting speaker labels:', error);
    }
  },

  async findByFileId(fileId: number): Promise<Record<string, string> | null> {
    try {
      const [result] = await db.select()
        .from(speakerLabels)
        .where(eq(speakerLabels.fileId, fileId))
        .limit(1);
      return result ? result.labels : null;
    } catch (error) {
      console.error('Error finding speaker labels:', error);
      return null;
    }
  },
};

// AI Extracts Service
export const aiExtractsService = {
  async create(data: {
    fileId: number;
    templateId?: string;
    model: string;
    prompt: string;
    content: string;
  }) {
    try {
      await db.insert(aiExtracts).values({
        id: createId(),
        ...data,
      });
      
      // Also update the audio file
      await db.update(audioFiles)
        .set({
          aiExtract: data.content,
          aiExtractStatus: 'completed',
          aiExtractedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(audioFiles.id, data.fileId));
    } catch (error) {
      console.error('Error creating AI extract:', error);
    }
  },

  async findByFileId(fileId: number) {
    try {
      return await db.select()
        .from(aiExtracts)
        .where(eq(aiExtracts.fileId, fileId))
        .orderBy(desc(aiExtracts.createdAt));
    } catch (error) {
      console.error('Error finding AI extracts:', error);
      return [];
    }
  },
};

// Templates Service
export const templatesService = {
  async create(title: string, prompt: string) {
    try {
      const [template] = await db.insert(summarizationTemplates)
        .values({ 
          id: createId(),
          title, 
          prompt,
        })
        .returning();
      return template;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  },

  async findAll() {
    try {
      return await db.select()
        .from(summarizationTemplates)
        .orderBy(summarizationTemplates.title);
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  },

  async findById(id: string) {
    try {
      const [template] = await db.select()
        .from(summarizationTemplates)
        .where(eq(summarizationTemplates.id, id))
        .limit(1);
      return template || null;
    } catch (error) {
      console.error('Error finding template:', error);
      return null;
    }
  },

  async update(id: string, data: { title?: string; prompt?: string }) {
    try {
      const [updated] = await db.update(summarizationTemplates)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(summarizationTemplates.id, id))
        .returning();
      return updated || null;
    } catch (error) {
      console.error('Error updating template:', error);
      return null;
    }
  },

  async delete(id: string) {
    try {
      const result = await db.delete(summarizationTemplates)
        .where(eq(summarizationTemplates.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting template:', error);
      return false;
    }
  },
};

// System Settings Service
export const settingsService = {
  async get() {
    try {
      const [settings] = await db.select().from(systemSettings).limit(1);
      if (!settings) {
        // This shouldn't happen as we initialize with default settings
        return null;
      }
      return settings;
    } catch (error) {
      console.error('Error fetching settings:', error);
      return null;
    }
  },

  async update(data: any) {
    try {
      const [updated] = await db.update(systemSettings)
        .set(data)
        .where(eq(systemSettings.id, 1))
        .returning();
      return updated;
    } catch (error) {
      console.error('Error updating settings:', error);
      return null;
    }
  },
};

// Helper to parse JSON fields for SQLite
export function parseAudioFile(file: any) {
  if (!file) return null;
  
  return {
    ...file,
    // JSON fields are already parsed by drizzle when using mode: 'json'
    uploadedAt: new Date(file.uploadedAt),
    updatedAt: new Date(file.updatedAt),
    transcribedAt: file.transcribedAt ? new Date(file.transcribedAt) : null,
    summarizedAt: file.summarizedAt ? new Date(file.summarizedAt) : null,
    aiExtractedAt: file.aiExtractedAt ? new Date(file.aiExtractedAt) : null,
  };
}