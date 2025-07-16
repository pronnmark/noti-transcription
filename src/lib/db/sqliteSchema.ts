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
  
  // Psychological evaluation settings
  psychEvalEnabled: integer('psych_eval_enabled', { mode: 'boolean' }).default(false),
  psychEvalAutoRun: integer('psych_eval_auto_run', { mode: 'boolean' }).default(false),
  
  // Auto-extraction settings
  extractionAutoRun: text('extraction_auto_run', { mode: 'json' }).$type<{
    tasks?: boolean;
    psychology?: boolean;
    decisions?: boolean;
    questions?: boolean;
    followups?: boolean;
  }>(),
});

// Audio files table
export const audioFiles = sqliteTable('audio_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fileName: text('file_name').notNull(),
  originalFileName: text('original_file_name').notNull(),
  originalFileType: text('original_file_type').notNull(),
  fileSize: integer('file_size').notNull(),
  fileHash: text('file_hash').unique(), // SHA-256 hash for duplicate detection
  duration: integer('duration'),
  
  // Transcription
  transcript: text('transcript', { mode: 'json' }).$type<TranscriptSegment[]>(),
  transcriptionStatus: text('transcription_status', { enum: ['pending', 'processing', 'completed', 'failed', 'draft'] }).default('pending').notNull(),
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
  
  // New flexible system fields
  summarizationStatus: text('summarization_status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending'),
  summarizationContent: text('summarization_content'),
  extractionTemplatesUsed: text('extraction_templates_used', { mode: 'json' }).$type<string[]>(),
  dataPointTemplatesUsed: text('data_point_templates_used', { mode: 'json' }).$type<string[]>(),
  extractionStatus: text('extraction_status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending'),
  dataPointStatus: text('data_point_status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending'),
  
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
  // New fields for enhanced task management
  comments: text('comments'), // User comments/notes
  completedAt: text('completed_at'), // When marked as completed
  assignedTo: text('assigned_to'), // For future user management
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

// Psychological evaluations table
export const psychologicalEvaluations = sqliteTable('psychological_evaluations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  fileId: integer('file_id').notNull().references(() => audioFiles.id, { onDelete: 'cascade' }),
  mood: text('mood', { mode: 'json' }).$type<{
    happy?: number;
    sad?: number;
    anxious?: number;
    stressed?: number;
    calm?: number;
    excited?: number;
    frustrated?: number;
    confident?: number;
  }>(),
  energy: integer('energy'), // 1-10 scale
  stressLevel: integer('stress_level'), // 1-10 scale
  confidence: integer('confidence'), // 1-10 scale
  engagement: integer('engagement'), // 1-10 scale
  emotionalState: text('emotional_state', { mode: 'json' }).$type<{
    dominant_emotion?: string;
    secondary_emotions?: string[];
    emotional_stability?: number;
    emotional_intensity?: number;
  }>(),
  speechPatterns: text('speech_patterns', { mode: 'json' }).$type<{
    pace?: string; // slow, normal, fast
    tone?: string; // positive, negative, neutral
    hesitation_count?: number;
    interruption_count?: number;
    vocal_tension?: number;
  }>(),
  keyInsights: text('key_insights').notNull(),
  timestampAnalysis: text('timestamp_analysis', { mode: 'json' }).$type<{
    timestamp: number;
    mood_score: number;
    energy_level: number;
    key_emotion: string;
  }[]>(),
  model: text('model').notNull().default('anthropic/claude-sonnet-4'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  fileIdIdx: index('psych_file_id_idx').on(table.fileId),
  createdAtIdx: index('psych_created_at_idx').on(table.createdAt),
}));

// Psychological metrics aggregated view
export const psychologicalMetrics = sqliteTable('psychological_metrics', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').default('default'), // For future multi-user support
  date: text('date').notNull(), // YYYY-MM-DD format
  averageMood: real('average_mood'), // Average mood score for the day
  averageEnergy: real('average_energy'), // Average energy level
  averageStress: real('average_stress'), // Average stress level
  sessionCount: integer('session_count').default(0),
  dominantEmotion: text('dominant_emotion'),
  insights: text('insights'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  userDateIdx: index('user_date_idx').on(table.userId, table.date),
  dateIdx: index('metrics_date_idx').on(table.date),
}));

// New flexible system tables

// Extraction Templates - Configurable extraction criteria
export const extractionTemplates = sqliteTable('extraction_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  prompt: text('prompt').notNull(),
  expectedOutputFormat: text('expected_output_format'), // JSON schema definition
  defaultPriority: text('default_priority', { enum: ['high', 'medium', 'low'] }).default('medium'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  activeIdx: index('extraction_templates_active_idx').on(table.isActive),
  defaultIdx: index('extraction_templates_default_idx').on(table.isDefault),
}));

// Data Point Templates - Configurable analysis metrics
export const dataPointTemplates = sqliteTable('data_point_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  analysisPrompt: text('analysis_prompt').notNull(),
  outputSchema: text('output_schema'), // JSON schema for expected metrics
  visualizationType: text('visualization_type').default('chart'), // chart, gauge, text, etc.
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  activeIdx: index('data_point_templates_active_idx').on(table.isActive),
  defaultIdx: index('data_point_templates_default_idx').on(table.isDefault),
}));

// Flexible Extractions (renamed from ai_notes)
export const extractions = sqliteTable('extractions', {
  id: text('id').primaryKey(),
  fileId: integer('file_id').notNull().references(() => audioFiles.id, { onDelete: 'cascade' }),
  templateId: text('template_id').notNull().references(() => extractionTemplates.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  context: text('context'),
  speaker: text('speaker'),
  timestamp: real('timestamp'),
  priority: text('priority', { enum: ['high', 'medium', 'low'] }).default('medium'),
  status: text('status', { enum: ['active', 'completed', 'archived'] }).default('active'),
  metadata: text('metadata'), // JSON metadata based on template schema
  comments: text('comments'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  fileIdIdx: index('extractions_file_id_idx').on(table.fileId),
  templateIdIdx: index('extractions_template_id_idx').on(table.templateId),
  statusIdx: index('extractions_status_idx').on(table.status),
}));

// Flexible Data Points (renamed from psychological_evaluations)
export const dataPoints = sqliteTable('data_points', {
  id: text('id').primaryKey(),
  fileId: integer('file_id').notNull().references(() => audioFiles.id, { onDelete: 'cascade' }),
  templateId: text('template_id').notNull().references(() => dataPointTemplates.id, { onDelete: 'cascade' }),
  analysisResults: text('analysis_results').notNull(), // JSON results based on template schema
  model: text('model').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  fileIdIdx: index('data_points_file_id_idx').on(table.fileId),
  templateIdIdx: index('data_points_template_id_idx').on(table.templateId),
}));

// Summarizations (renamed from ai_extracts)
export const summarizations = sqliteTable('summarizations', {
  id: text('id').primaryKey(),
  fileId: integer('file_id').notNull().references(() => audioFiles.id, { onDelete: 'cascade' }),
  templateId: text('template_id').references(() => summarizationTemplates.id, { onDelete: 'set null' }),
  model: text('model').notNull(),
  prompt: text('prompt').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  fileIdIdx: index('summarizations_file_id_idx').on(table.fileId),
  templateIdIdx: index('summarizations_template_id_idx').on(table.templateId),
}));

// Relations
export const audioFilesRelations = relations(audioFiles, ({ one, many }) => ({
  speakerLabels: one(speakerLabels, {
    fields: [audioFiles.id],
    references: [speakerLabels.fileId],
  }),
  aiExtracts: many(aiExtracts),
  aiNotes: many(aiNotes),
  psychologicalEvaluations: many(psychologicalEvaluations),
  // New flexible system relations
  extractions: many(extractions),
  dataPoints: many(dataPoints),
  summarizations: many(summarizations),
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

export const psychologicalEvaluationsRelations = relations(psychologicalEvaluations, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [psychologicalEvaluations.fileId],
    references: [audioFiles.id],
  }),
}));

// New flexible system relations
export const extractionTemplatesRelations = relations(extractionTemplates, ({ many }) => ({
  extractions: many(extractions),
}));

export const dataPointTemplatesRelations = relations(dataPointTemplates, ({ many }) => ({
  dataPoints: many(dataPoints),
}));

export const extractionsRelations = relations(extractions, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [extractions.fileId],
    references: [audioFiles.id],
  }),
  template: one(extractionTemplates, {
    fields: [extractions.templateId],
    references: [extractionTemplates.id],
  }),
}));

export const dataPointsRelations = relations(dataPoints, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [dataPoints.fileId],
    references: [audioFiles.id],
  }),
  template: one(dataPointTemplates, {
    fields: [dataPoints.templateId],
    references: [dataPointTemplates.id],
  }),
}));

export const summarizationsRelations = relations(summarizations, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [summarizations.fileId],
    references: [audioFiles.id],
  }),
  template: one(summarizationTemplates, {
    fields: [summarizations.templateId],
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

export type PsychologicalEvaluation = typeof psychologicalEvaluations.$inferSelect;
export type NewPsychologicalEvaluation = typeof psychologicalEvaluations.$inferInsert;

// New flexible system types
export type ExtractionTemplate = typeof extractionTemplates.$inferSelect;
export type NewExtractionTemplate = typeof extractionTemplates.$inferInsert;

export type DataPointTemplate = typeof dataPointTemplates.$inferSelect;
export type NewDataPointTemplate = typeof dataPointTemplates.$inferInsert;

export type Extraction = typeof extractions.$inferSelect;
export type NewExtraction = typeof extractions.$inferInsert;

export type DataPoint = typeof dataPoints.$inferSelect;
export type NewDataPoint = typeof dataPoints.$inferInsert;

export type Summarization = typeof summarizations.$inferSelect;
export type NewSummarization = typeof summarizations.$inferInsert;

export type PsychologicalMetric = typeof psychologicalMetrics.$inferSelect;
export type NewPsychologicalMetric = typeof psychologicalMetrics.$inferInsert;

export type SystemSettings = typeof systemSettings.$inferSelect;
export type NewSystemSettings = typeof systemSettings.$inferInsert;