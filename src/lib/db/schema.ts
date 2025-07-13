import { pgTable, text, timestamp, boolean, serial, integer, jsonb, pgEnum, index, primaryKey, unique, varchar } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// Enums
export const transcriptionStatusEnum = pgEnum('transcription_status', ['pending', 'processing', 'completed', 'failed']);
export const summaryStatusEnum = pgEnum('summary_status', ['pending', 'processing', 'completed', 'failed']);
export const aiExtractStatusEnum = pgEnum('ai_extract_status', ['pending', 'processing', 'completed', 'failed']);

// User table
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Session table
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// System settings table
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  isInitialized: boolean('is_initialized').default(false).notNull(),
  firstStartupDate: timestamp('first_startup_date'),
  lastStartupDate: timestamp('last_startup_date'),
  
  // Whisper settings
  whisperModelSizes: text('whisper_model_sizes').array().default(sql`ARRAY['tiny', 'base', 'small', 'medium', 'large']`),
  whisperQuantization: text('whisper_quantization').default('none'),
  
  // Storage settings
  obsidianEnabled: boolean('obsidian_enabled').default(false),
  obsidianVaultPath: text('obsidian_vault_path'),
  obsidianFolder: text('obsidian_folder'),
  
  // API keys
  geminiApiKey: text('gemini_api_key'),
  openaiApiKey: text('openai_api_key'),
  openrouterApiKey: text('openrouter_api_key'),
  
  // AI Extract settings
  aiExtractEnabled: boolean('ai_extract_enabled').default(false),
  aiExtractPrompt: text('ai_extract_prompt'),
  aiExtractOutputPath: text('ai_extract_output_path'),
  aiExtractModel: text('ai_extract_model').default('gemini-1.5-flash'),
});

// Audio files table
export const audioFiles = pgTable('audio_files', {
  id: serial('id').primaryKey(),
  fileName: text('file_name').notNull(),
  originalFileName: text('original_file_name').notNull(),
  originalFileType: text('original_file_type').notNull(),
  fileSize: integer('file_size').notNull(),
  duration: integer('duration'),
  
  // Transcription
  transcript: jsonb('transcript').$type<TranscriptSegment[]>(),
  transcriptionStatus: transcriptionStatusEnum('transcription_status').default('pending').notNull(),
  transcriptionProgress: integer('transcription_progress').default(0),
  language: text('language'),
  modelSize: text('model_size').default('large-v3'),
  threads: integer('threads'),
  processors: integer('processors'),
  diarization: boolean('diarization').default(true),
  
  // Summary
  summary: text('summary'),
  summaryPrompt: text('summary_prompt'),
  summaryStatus: summaryStatusEnum('summary_status').default('pending'),
  
  // AI Extract
  aiExtract: text('ai_extract'),
  aiExtractStatus: aiExtractStatusEnum('ai_extract_status').default('pending'),
  aiExtractedAt: timestamp('ai_extracted_at'),
  aiExtractFilePath: text('ai_extract_file_path'),
  
  // Metadata
  title: text('title'),
  lastError: text('last_error'),
  peaks: jsonb('peaks').$type<number[]>(),
  
  // Timestamps
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  transcribedAt: timestamp('transcribed_at'),
  summarizedAt: timestamp('summarized_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  transcriptionStatusIdx: index('transcription_status_idx').on(table.transcriptionStatus),
  uploadedAtIdx: index('uploaded_at_idx').on(table.uploadedAt),
  summaryStatusIdx: index('summary_status_idx').on(table.summaryStatus),
}));

// Speaker labels table
export const speakerLabels = pgTable('speaker_labels', {
  fileId: integer('file_id').primaryKey().references(() => audioFiles.id, { onDelete: 'cascade' }),
  labels: jsonb('labels').$type<Record<string, string>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// Summarization templates table
export const summarizationTemplates = pgTable('summarization_templates', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  titleIdx: index('title_idx').on(table.title),
}));

// AI extracts history table (new)
export const aiExtracts = pgTable('ai_extracts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  fileId: integer('file_id').notNull().references(() => audioFiles.id, { onDelete: 'cascade' }),
  templateId: text('template_id').references(() => summarizationTemplates.id, { onDelete: 'set null' }),
  model: text('model').notNull(),
  prompt: text('prompt').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  fileIdIdx: index('file_id_idx').on(table.fileId),
  createdAtIdx: index('created_at_idx').on(table.createdAt),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const audioFilesRelations = relations(audioFiles, ({ one, many }) => ({
  speakerLabels: one(speakerLabels, {
    fields: [audioFiles.id],
    references: [speakerLabels.fileId],
  }),
  aiExtracts: many(aiExtracts),
}));

export const speakerLabelsRelations = relations(speakerLabels, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [speakerLabels.fileId],
    references: [audioFiles.id],
  }),
}));

export const aiExtractsRelations = relations(aiExtracts, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [aiExtracts.fileId],
    references: [audioFiles.id],
  }),
  template: one(summarizationTemplates, {
    fields: [aiExtracts.templateId],
    references: [summarizationTemplates.id],
  }),
}));

// Types
export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type AudioFile = typeof audioFiles.$inferSelect;
export type NewAudioFile = typeof audioFiles.$inferInsert;

export type SpeakerLabel = typeof speakerLabels.$inferSelect;
export type NewSpeakerLabel = typeof speakerLabels.$inferInsert;

export type SummarizationTemplate = typeof summarizationTemplates.$inferSelect;
export type NewSummarizationTemplate = typeof summarizationTemplates.$inferInsert;

export type AIExtract = typeof aiExtracts.$inferSelect;
export type NewAIExtract = typeof aiExtracts.$inferInsert;

export type SystemSettings = typeof systemSettings.$inferSelect;
export type NewSystemSettings = typeof systemSettings.$inferInsert;