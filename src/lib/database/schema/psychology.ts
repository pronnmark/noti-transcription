import { sqliteTable, text, integer, index, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { audioFiles } from './audio';

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
  model: text('model').notNull(),
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

export type PsychologicalEvaluation = typeof psychologicalEvaluations.$inferSelect;
export type NewPsychologicalEvaluation = typeof psychologicalEvaluations.$inferInsert;
export type PsychologicalMetric = typeof psychologicalMetrics.$inferSelect;
export type NewPsychologicalMetric = typeof psychologicalMetrics.$inferInsert;
