import { sqliteTable, text, integer, blob, index, real } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// System settings table
export const systemSettings = sqliteTable('system_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  isInitialized: integer('is_initialized', { mode: 'boolean' }).default(false).notNull(),
  firstStartupDate: integer('first_startup_date', { mode: 'timestamp' }),
  lastStartupDate: integer('last_startup_date', { mode: 'timestamp' }),
  
  // Whisper settings
  whisperModelSizes: text('whisper_model_sizes', { mode: 'json' }).$type<string[]>().default(['tiny', 'base', 'small', 'medium', 'large']),
  whisperQuantization: text('whisper_quantization').default('none'),
  
  // Storage settings
  obsidianEnabled: integer('obsidian_enabled', { mode: 'boolean' }).default(false),
  obsidianVaultPath: text('obsidian_vault_path'),
  obsidianFolder: text('obsidian_folder'),
  
  // API keys
  geminiApiKey: text('gemini_api_key'),
  openaiApiKey: text('openai_api_key'),
  openrouterApiKey: text('openrouter_api_key'),
  
  // AI Extract settings
  aiExtractEnabled: integer('ai_extract_enabled', { mode: 'boolean' }).default(false),
  aiExtractPrompt: text('ai_extract_prompt'),
  aiExtractOutputPath: text('ai_extract_output_path'),
  aiExtractModel: text('ai_extract_model').default('anthropic/claude-sonnet-4'),
  
  // Notes extraction settings
  notesPrompts: text('notes_prompts', { mode: 'json' }).$type<{
    tasks?: string;
    questions?: string;
    decisions?: string;
    followups?: string;
    mentions?: string;
  }>(),
});

// Audio files table
export const audioFiles = sqliteTable('audio_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fileName: text('file_name').notNull(),
  originalFileName: text('original_file_name').notNull(),
  originalFileType: text('original_file_type').notNull(),
  fileSize: integer('file_size').notNull(),
  duration: integer('duration'),
  
  // Transcription
  transcript: text('transcript', { mode: 'json' }).$type<TranscriptSegment[]>(),
  transcriptionStatus: text('transcription_status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending').notNull(),
  transcriptionProgress: integer('transcription_progress').default(0),
  language: text('language'),
  modelSize: text('model_size').default('large-v3'),
  threads: integer('threads'),
  processors: integer('processors'),
  diarization: integer('diarization', { mode: 'boolean' }).default(true),
  
  // Summary
  summary: text('summary'),
  summaryPrompt: text('summary_prompt'),
  summaryStatus: text('summary_status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending'),
  
  // AI Extract
  aiExtract: text('ai_extract'),
  aiExtractStatus: text('ai_extract_status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending'),
  aiExtractedAt: integer('ai_extracted_at', { mode: 'timestamp' }),
  aiExtractFilePath: text('ai_extract_file_path'),
  
  // AI Notes
  notesExtractedAt: text('notes_extracted_at'),
  notesStatus: text('notes_status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending'),
  notesCount: text('notes_count', { mode: 'json' }), // { tasks: 0, questions: 0, decisions: 0, followups: 0, mentions: 0 }
  
  // Metadata
  title: text('title'),
  lastError: text('last_error'),
  peaks: text('peaks', { mode: 'json' }).$type<number[]>(),
  
  // Timestamps
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  transcribedAt: integer('transcribed_at', { mode: 'timestamp' }),
  summarizedAt: integer('summarized_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  transcriptionStatusIdx: index('transcription_status_idx').on(table.transcriptionStatus),
  uploadedAtIdx: index('uploaded_at_idx').on(table.uploadedAt),
  summaryStatusIdx: index('summary_status_idx').on(table.summaryStatus),
}));

// Speaker labels table
export const speakerLabels = sqliteTable('speaker_labels', {
  fileId: integer('file_id').primaryKey().references(() => audioFiles.id, { onDelete: 'cascade' }),
  labels: text('labels', { mode: 'json' }).$type<Record<string, string>>().notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Summarization templates table
export const summarizationTemplates = sqliteTable('summarization_templates', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  titleIdx: index('title_idx').on(table.title),
}));

// AI notes table - for task extraction
export const aiNotes = sqliteTable('ai_notes', {
  id: text('id').primaryKey(),
  fileId: integer('file_id').notNull().references(() => audioFiles.id, { onDelete: 'cascade' }),
  noteType: text('note_type', { enum: ['task', 'question', 'decision', 'followup', 'mention'] }).notNull(),
  content: text('content').notNull(),
  context: text('context'), // Surrounding text for reference
  speaker: text('speaker'), // Who said it
  timestamp: real('timestamp'), // When in the recording (seconds)
  priority: text('priority', { enum: ['high', 'medium', 'low'] }).default('medium'),
  status: text('status', { enum: ['active', 'completed', 'archived'] }).default('active'),
  metadata: text('metadata', { mode: 'json' }), // Additional structured data
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// AI extracts history table
export const aiExtracts = sqliteTable('ai_extracts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  fileId: integer('file_id').notNull().references(() => audioFiles.id, { onDelete: 'cascade' }),
  templateId: text('template_id').references(() => summarizationTemplates.id, { onDelete: 'set null' }),
  model: text('model').notNull(),
  prompt: text('prompt').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  fileIdIdx: index('file_id_idx').on(table.fileId),
  createdAtIdx: index('created_at_idx').on(table.createdAt),
}));

// Relations
export const audioFilesRelations = relations(audioFiles, ({ one, many }) => ({
  speakerLabels: one(speakerLabels, {
    fields: [audioFiles.id],
    references: [speakerLabels.fileId],
  }),
  aiExtracts: many(aiExtracts),
  aiNotes: many(aiNotes),
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

export const aiNotesRelations = relations(aiNotes, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [aiNotes.fileId],
    references: [audioFiles.id],
  }),
}));

// Types
export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
};

export type AudioFile = typeof audioFiles.$inferSelect;
export type NewAudioFile = typeof audioFiles.$inferInsert;

export type SpeakerLabel = typeof speakerLabels.$inferSelect;
export type NewSpeakerLabel = typeof speakerLabels.$inferInsert;

export type SummarizationTemplate = typeof summarizationTemplates.$inferSelect;
export type NewSummarizationTemplate = typeof summarizationTemplates.$inferInsert;

export type AIExtract = typeof aiExtracts.$inferSelect;
export type NewAIExtract = typeof aiExtracts.$inferInsert;
export type AINote = typeof aiNotes.$inferSelect;
export type NewAINote = typeof aiNotes.$inferInsert;

export type SystemSettings = typeof systemSettings.$inferSelect;
export type NewSystemSettings = typeof systemSettings.$inferInsert;