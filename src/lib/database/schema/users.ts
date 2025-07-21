import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
  openaiApiKey: text('openai_api_key'),

  // Custom AI endpoint configuration
  customAiBaseUrl: text('custom_ai_base_url'),
  customAiApiKey: text('custom_ai_api_key'),
  customAiModel: text('custom_ai_model'),
  customAiProvider: text('custom_ai_provider').default('custom'),

  // AI Extract settings
  aiExtractEnabled: integer('ai_extract_enabled', { mode: 'boolean' }).default(false),
  aiExtractPrompt: text('ai_extract_prompt'),
  aiExtractOutputPath: text('ai_extract_output_path'),
  aiExtractModel: text('ai_extract_model'),

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

export type SystemSettings = typeof systemSettings.$inferSelect;
export type NewSystemSettings = typeof systemSettings.$inferInsert;
