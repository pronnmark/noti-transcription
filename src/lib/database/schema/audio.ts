import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Transcript segment type definition
export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
};

// Audio files table - Core file metadata only
export const audioFiles = sqliteTable(
  'audio_files',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fileName: text('file_name').notNull(),
    originalFileName: text('original_file_name').notNull(),
    originalFileType: text('original_file_type').notNull(),
    fileSize: integer('file_size').notNull(),
    fileHash: text('file_hash').unique(), // SHA-256 hash for duplicate detection
    duration: integer('duration'),

    // Basic metadata
    title: text('title'),
    peaks: text('peaks', { mode: 'json' }).$type<number[]>(),

    // Location metadata (captured during recording)
    latitude: real('latitude'),
    longitude: real('longitude'),
    locationAccuracy: integer('location_accuracy'), // accuracy in meters
    locationTimestamp: integer('location_timestamp', { mode: 'timestamp' }), // when location was captured
    locationProvider: text('location_provider'), // 'gps' | 'network' | 'passive'

    // Timestamps
    uploadedAt: integer('uploaded_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    recordedAt: integer('recorded_at', { mode: 'timestamp' }), // Extracted from audio file metadata
  },
  table => ({
    fileHashIdx: index('audio_files_file_hash_idx').on(table.fileHash),
    uploadedAtIdx: index('audio_files_uploaded_at_idx').on(table.uploadedAt),
  }),
);

// Speaker labels table
export const speakerLabels = sqliteTable('speaker_labels', {
  fileId: integer('file_id')
    .primaryKey()
    .references(() => audioFiles.id, { onDelete: 'cascade' }),
  labels: text('labels', { mode: 'json' })
    .$type<Record<string, string>>()
    .notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// File labels table - For custom user labels/tags
export const fileLabels = sqliteTable(
  'file_labels',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fileId: integer('file_id')
      .notNull()
      .references(() => audioFiles.id, { onDelete: 'cascade' }),
    labels: text('labels', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  table => ({
    fileIdIdx: index('file_labels_file_id_idx').on(table.fileId),
    labelsIdx: index('file_labels_labels_idx').on(table.labels),
  }),
);

// Type exports
export type AudioFile = typeof audioFiles.$inferSelect;
export type NewAudioFile = typeof audioFiles.$inferInsert;
export type SpeakerLabel = typeof speakerLabels.$inferSelect;
export type NewSpeakerLabel = typeof speakerLabels.$inferInsert;
export type FileLabel = typeof fileLabels.$inferSelect;
export type NewFileLabel = typeof fileLabels.$inferInsert;
