import { sqliteTable, text, integer, index, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { audioFiles } from './audio';
import { extractionTemplates, summarizationTemplates } from './extractions';

// Data Point Templates - Configurable analysis metrics
export const dataPointTemplates = sqliteTable('data_point_templates', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
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
  id: text('id').primaryKey().$defaultFn(() => createId()),
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
  id: text('id').primaryKey().$defaultFn(() => createId()),
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
  id: text('id').primaryKey().$defaultFn(() => createId()),
  fileId: integer('file_id').notNull().references(() => audioFiles.id, { onDelete: 'cascade' }),
  templateId: text('template_id').references(() => summarizationPrompts.id, { onDelete: 'set null' }),
  model: text('model').notNull(),
  prompt: text('prompt').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  fileIdIdx: index('summarizations_file_id_idx').on(table.fileId),
  templateIdIdx: index('summarizations_template_id_idx').on(table.templateId),
}));

// ===== DYNAMIC EXTRACTION SYSTEM =====

// Summarization prompts - user-defined summarization styles
export const summarizationPrompts = sqliteTable('summarization_prompts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  prompt: text('prompt').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  nameIdx: index('summ_prompts_name_idx').on(table.name),
  isDefaultIdx: index('summ_prompts_default_idx').on(table.isDefault),
}));

// Extraction definitions - user-defined extraction types
export const extractionDefinitions = sqliteTable('extraction_definitions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(), // e.g., "Tasks", "Ideas", "Word Complexity"
  description: text('description'),
  jsonKey: text('json_key').notNull().unique(), // e.g., "tasks", "ideas", "word_complexity"
  jsonSchema: text('json_schema', { mode: 'json' }).notNull(), // Expected JSON structure
  aiInstructions: text('ai_instructions').notNull(), // Instructions for AI
  outputType: text('output_type', { enum: ['array', 'object', 'value'] }).default('array'),
  category: text('category', { enum: ['extraction', 'datapoint'] }).default('extraction'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  nameIdx: index('extr_def_name_idx').on(table.name),
  jsonKeyIdx: index('extr_def_json_key_idx').on(table.jsonKey),
  categoryIdx: index('extr_def_category_idx').on(table.category),
  isActiveIdx: index('extr_def_active_idx').on(table.isActive),
}));

// Extraction results - flexible storage for AI extraction results
export const extractionResults = sqliteTable('extraction_results', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  fileId: integer('file_id').notNull().references(() => audioFiles.id, { onDelete: 'cascade' }),
  definitionId: text('definition_id').notNull().references(() => extractionDefinitions.id, { onDelete: 'cascade' }),
  extractionType: text('extraction_type').notNull(), // Copy of jsonKey for easier querying
  content: text('content', { mode: 'json' }).notNull(), // The actual extracted data
  schemaVersion: text('schema_version').default('1.0'), // Track schema changes
  confidence: real('confidence'), // AI confidence score if available
  processingTime: integer('processing_time'), // Time taken to process in ms
  model: text('model').default('gemini-2.5-flash'), // AI model used
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  fileIdIdx: index('extr_results_file_id_idx').on(table.fileId),
  definitionIdIdx: index('extr_results_def_id_idx').on(table.definitionId),
  extractionTypeIdx: index('extr_results_type_idx').on(table.extractionType),
  createdAtIdx: index('extr_results_created_at_idx').on(table.createdAt),
}));

// AI processing sessions - track complete AI processing runs
export const aiProcessingSessions = sqliteTable('ai_processing_sessions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  fileId: integer('file_id').notNull().references(() => audioFiles.id, { onDelete: 'cascade' }),
  summarizationPromptId: text('summarization_prompt_id').references(() => summarizationPrompts.id, { onDelete: 'set null' }),
  extractionDefinitionIds: text('extraction_definition_ids', { mode: 'json' }).$type<string[]>(), // IDs of active extractions
  systemPrompt: text('system_prompt').notNull(), // Generated system prompt
  aiResponse: text('ai_response').notNull(), // Raw AI response
  parsedResponse: text('parsed_response', { mode: 'json' }), // Parsed JSON response
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending'),
  error: text('error'),
  processingTime: integer('processing_time'), // Total processing time in ms
  tokenCount: integer('token_count'), // Tokens used
  model: text('model').default('gemini-2.5-flash'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  fileIdIdx: index('ai_sessions_file_id_idx').on(table.fileId),
  statusIdx: index('ai_sessions_status_idx').on(table.status),
  createdAtIdx: index('ai_sessions_created_at_idx').on(table.createdAt),
}));

// Type exports

export type DataPointTemplate = typeof dataPointTemplates.$inferSelect;
export type NewDataPointTemplate = typeof dataPointTemplates.$inferInsert;
export type Extraction = typeof extractions.$inferSelect;
export type NewExtraction = typeof extractions.$inferInsert;
export type DataPoint = typeof dataPoints.$inferSelect;
export type NewDataPoint = typeof dataPoints.$inferInsert;
export type Summarization = typeof summarizations.$inferSelect;
export type NewSummarization = typeof summarizations.$inferInsert;
export type SummarizationPrompt = typeof summarizationPrompts.$inferSelect;
export type NewSummarizationPrompt = typeof summarizationPrompts.$inferInsert;
export type ExtractionDefinition = typeof extractionDefinitions.$inferSelect;
export type NewExtractionDefinition = typeof extractionDefinitions.$inferInsert;
export type ExtractionResult = typeof extractionResults.$inferSelect;
export type NewExtractionResult = typeof extractionResults.$inferInsert;
export type AIProcessingSession = typeof aiProcessingSessions.$inferSelect;
export type NewAIProcessingSession = typeof aiProcessingSessions.$inferInsert; 