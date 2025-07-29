import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { audioFiles, TranscriptSegment } from './audio';

// Transcription jobs table
export const transcriptionJobs = sqliteTable(
  'transcription_jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fileId: integer('file_id')
      .notNull()
      .references(() => audioFiles.id, { onDelete: 'cascade' }),

    // Transcription settings
    language: text('language'),
    modelSize: text('model_size').default('large-v3'),
    threads: integer('threads'),
    processors: integer('processors'),
    diarization: integer('diarization', { mode: 'boolean' }).default(true),
    speakerCount: integer('speaker_count'),

    // Status and progress
    status: text('status', {
      enum: ['pending', 'processing', 'completed', 'failed', 'draft'],
    })
      .default('pending')
      .notNull(),
    progress: integer('progress').default(0),

    // Results
    transcript: text('transcript', { mode: 'json' }).$type<
      TranscriptSegment[]
    >(),
    diarizationStatus: text('diarization_status', {
      enum: [
        'not_attempted',
        'in_progress',
        'success',
        'failed',
        'no_speakers_detected',
      ],
    }).default('not_attempted'),
    diarizationError: text('diarization_error'),

    // Error handling
    lastError: text('last_error'),

    // Timestamps
    startedAt: integer('started_at', { mode: 'timestamp' }),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  table => ({
    fileIdIdx: index('transcription_jobs_file_id_idx').on(table.fileId),
    statusIdx: index('transcription_jobs_status_idx').on(table.status),
    createdAtIdx: index('transcription_jobs_created_at_idx').on(
      table.createdAt,
    ),
  }),
);

// Type exports
export type TranscriptionJob = typeof transcriptionJobs.$inferSelect;
export type NewTranscriptionJob = typeof transcriptionJobs.$inferInsert;
