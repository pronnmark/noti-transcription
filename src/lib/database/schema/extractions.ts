import {
  sqliteTable,
  text,
  integer,
  index,
  real,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { audioFiles } from './audio';

// Summarization templates table
export const summarizationTemplates = sqliteTable(
  'summarization_templates',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    title: text('title').notNull(),
    prompt: text('prompt').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  table => ({
    titleIdx: index('title_idx').on(table.title),
  }),
);

// Extraction Templates - Configurable extraction criteria
export const extractionTemplates = sqliteTable(
  'extraction_templates',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull(),
    description: text('description'),
    prompt: text('prompt').notNull(),
    expectedOutputFormat: text('expected_output_format'), // JSON schema definition
    defaultPriority: text('default_priority', {
      enum: ['high', 'medium', 'low'],
    }).default('medium'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    isDefault: integer('is_default', { mode: 'boolean' }).default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  table => ({
    nameIdx: index('extraction_templates_name_idx').on(table.name),
    activeIdx: index('extraction_templates_active_idx').on(table.isActive),
  }),
);

// AI extracts history table - stores AI processing results
export const aiExtracts = sqliteTable(
  'ai_extracts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    fileId: integer('file_id')
      .notNull()
      .references(() => audioFiles.id, { onDelete: 'cascade' }),
    templateId: text('template_id').references(() => extractionTemplates.id, {
      onDelete: 'set null',
    }),
    model: text('model').notNull(),
    prompt: text('prompt').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  table => ({
    fileIdIdx: index('ai_extracts_file_id_idx').on(table.fileId),
    createdAtIdx: index('ai_extracts_created_at_idx').on(table.createdAt),
  }),
);

// Type exports
export type SummarizationTemplate = typeof summarizationTemplates.$inferSelect;
export type NewSummarizationTemplate =
  typeof summarizationTemplates.$inferInsert;
export type AIExtract = typeof aiExtracts.$inferSelect;
export type NewAIExtract = typeof aiExtracts.$inferInsert;
export type ExtractionTemplate = typeof extractionTemplates.$inferSelect;
export type NewExtractionTemplate = typeof extractionTemplates.$inferInsert;
