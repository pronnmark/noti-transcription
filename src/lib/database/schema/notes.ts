import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { audioFiles } from './audio';

// Simple notes table - For basic note-taking functionality
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  fileId: integer('file_id').notNull().references(() => audioFiles.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  fileIdIdx: index('notes_file_id_idx').on(table.fileId),
  createdAtIdx: index('notes_created_at_idx').on(table.createdAt),
}));

// Type exports
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;