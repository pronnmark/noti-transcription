import { db } from './index';
import { audioFiles, speakerLabels, aiExtracts, summarizationTemplates, systemSettings, type NewAudioFile, type AudioFile, type TranscriptSegment } from './schema';
import { eq, desc, and, or } from 'drizzle-orm';

// Audio Files Service
export const audioFilesService = {
  async create(data: NewAudioFile): Promise<AudioFile> {
    const [file] = await db.insert(audioFiles).values(data).returning();
    return file;
  },

  async findById(id: number): Promise<AudioFile | null> {
    const [file] = await db.select().from(audioFiles).where(eq(audioFiles.id, id)).limit(1);
    return file || null;
  },

  async findAll(): Promise<AudioFile[]> {
    return db.select().from(audioFiles).orderBy(desc(audioFiles.uploadedAt));
  },

  async update(id: number, data: Partial<AudioFile>): Promise<AudioFile | null> {
    const [updated] = await db.update(audioFiles)
      .set(data)
      .where(eq(audioFiles.id, id))
      .returning();
    return updated || null;
  },

  async updateTranscript(id: number, transcript: TranscriptSegment[], status: 'completed' | 'failed' = 'completed'): Promise<AudioFile | null> {
    const [updated] = await db.update(audioFiles)
      .set({
        transcript,
        transcriptionStatus: status,
        transcribedAt: status === 'completed' ? new Date() : null,
        transcriptionProgress: status === 'completed' ? 100 : 0,
      })
      .where(eq(audioFiles.id, id))
      .returning();
    return updated || null;
  },

  async updateProgress(id: number, progress: number): Promise<void> {
    await db.update(audioFiles)
      .set({ transcriptionProgress: progress })
      .where(eq(audioFiles.id, id));
  },

  async delete(id: number): Promise<boolean> {
    const result = await db.delete(audioFiles).where(eq(audioFiles.id, id)).returning();
    return result.length > 0;
  },
};

// Speaker Labels Service
export const speakerLabelsService = {
  async upsert(fileId: number, labels: Record<string, string>): Promise<void> {
    await db.insert(speakerLabels)
      .values({ fileId, labels })
      .onConflictDoUpdate({
        target: speakerLabels.fileId,
        set: { labels, updatedAt: new Date() },
      });
  },

  async findByFileId(fileId: number): Promise<Record<string, string> | null> {
    const [result] = await db.select()
      .from(speakerLabels)
      .where(eq(speakerLabels.fileId, fileId))
      .limit(1);
    return result?.labels || null;
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
  }): Promise<void> {
    await db.insert(aiExtracts).values(data);
    
    // Also update the audio file
    await db.update(audioFiles)
      .set({
        aiExtract: data.content,
        aiExtractStatus: 'completed',
        aiExtractedAt: new Date(),
      })
      .where(eq(audioFiles.id, data.fileId));
  },

  async findByFileId(fileId: number) {
    return db.select()
      .from(aiExtracts)
      .where(eq(aiExtracts.fileId, fileId))
      .orderBy(desc(aiExtracts.createdAt));
  },
};

// Templates Service
export const templatesService = {
  async create(title: string, prompt: string) {
    const [template] = await db.insert(summarizationTemplates)
      .values({ title, prompt })
      .returning();
    return template;
  },

  async findAll() {
    return db.select()
      .from(summarizationTemplates)
      .orderBy(summarizationTemplates.title);
  },

  async findById(id: string) {
    const [template] = await db.select()
      .from(summarizationTemplates)
      .where(eq(summarizationTemplates.id, id))
      .limit(1);
    return template || null;
  },

  async update(id: string, data: { title?: string; prompt?: string }) {
    const [updated] = await db.update(summarizationTemplates)
      .set(data)
      .where(eq(summarizationTemplates.id, id))
      .returning();
    return updated || null;
  },

  async delete(id: string) {
    const result = await db.delete(summarizationTemplates)
      .where(eq(summarizationTemplates.id, id))
      .returning();
    return result.length > 0;
  },
};

// System Settings Service
export const settingsService = {
  async get() {
    const [settings] = await db.select().from(systemSettings).limit(1);
    if (!settings) {
      // Create default settings if none exist
      const [newSettings] = await db.insert(systemSettings)
        .values({
          isInitialized: true,
          firstStartupDate: new Date(),
          lastStartupDate: new Date(),
        })
        .returning();
      return newSettings;
    }
    return settings;
  },

  async update(data: Partial<typeof systemSettings.$inferInsert>) {
    const [updated] = await db.update(systemSettings)
      .set(data)
      .returning();
    return updated;
  },
};