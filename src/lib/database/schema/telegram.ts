import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Chat configuration type
export type ChatConfiguration = {
  name: string;
  chatId: string;
  type: 'user' | 'group' | 'channel';
};

// Telegram settings table
export const telegramSettings = sqliteTable('telegram_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  botToken: text('bot_token'), // Optional - falls back to env var if null
  chatConfigurations: text('chat_configurations', { mode: 'json' }).$type<ChatConfiguration[]>().default('[]'),
  defaultChatId: text('default_chat_id'), // Default chat for quick sharing
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  enabledIdx: index('telegram_settings_enabled_idx').on(table.isEnabled),
}));

// Telegram share history table  
export const telegramShares = sqliteTable('telegram_shares', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fileId: integer('file_id').notNull(), // Reference to audioFiles.id
  summarizationId: text('summarization_id'), // Reference to summarizations.id if applicable
  chatId: text('chat_id').notNull(),
  chatName: text('chat_name'), // Friendly name for the chat
  messageText: text('message_text').notNull(),
  status: text('status', { enum: ['pending', 'sent', 'failed'] }).default('pending'),
  error: text('error'), // Error message if failed
  telegramMessageId: text('telegram_message_id'), // Telegram's message ID if successful
  sharedAt: integer('shared_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  fileIdIdx: index('telegram_shares_file_id_idx').on(table.fileId),
  statusIdx: index('telegram_shares_status_idx').on(table.status),
  sharedAtIdx: index('telegram_shares_shared_at_idx').on(table.sharedAt),
}));

// Type exports
export type TelegramSettings = typeof telegramSettings.$inferSelect;
export type NewTelegramSettings = typeof telegramSettings.$inferInsert;
export type TelegramShare = typeof telegramShares.$inferSelect;
export type NewTelegramShare = typeof telegramShares.$inferInsert;