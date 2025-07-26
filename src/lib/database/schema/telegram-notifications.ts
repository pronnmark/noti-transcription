import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Notification preferences per user/chat
export const telegramNotificationPreferences = sqliteTable('telegram_notification_preferences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: text('chat_id').notNull().unique(),
  userId: integer('user_id'), // Telegram user ID if applicable
  
  // Notification types
  transcriptionComplete: integer('transcription_complete', { mode: 'boolean' }).default(true),
  transcriptionFailed: integer('transcription_failed', { mode: 'boolean' }).default(true),
  summaryReady: integer('summary_ready', { mode: 'boolean' }).default(true),
  dailyDigest: integer('daily_digest', { mode: 'boolean' }).default(false),
  weeklyReport: integer('weekly_report', { mode: 'boolean' }).default(false),
  
  // Notification settings
  quietHoursStart: text('quiet_hours_start'), // e.g., "22:00"
  quietHoursEnd: text('quiet_hours_end'), // e.g., "08:00"
  timezone: text('timezone').default('UTC'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  chatIdIdx: index('telegram_notif_prefs_chat_id_idx').on(table.chatId),
  userIdIdx: index('telegram_notif_prefs_user_id_idx').on(table.userId),
}));

// Telegram users table for user management
export const telegramUsers = sqliteTable('telegram_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  telegramId: integer('telegram_id').notNull().unique(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  languageCode: text('language_code'),
  
  // Permissions
  canTranscribe: integer('can_transcribe', { mode: 'boolean' }).default(true),
  canSummarize: integer('can_summarize', { mode: 'boolean' }).default(true),
  isAdmin: integer('is_admin', { mode: 'boolean' }).default(false),
  
  // Usage limits
  dailyTranscriptionLimit: integer('daily_transcription_limit').default(10),
  monthlyTranscriptionLimit: integer('monthly_transcription_limit').default(100),
  
  // Stats
  totalTranscriptions: integer('total_transcriptions').default(0),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' }),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  telegramIdIdx: index('telegram_users_telegram_id_idx').on(table.telegramId),
  usernameIdx: index('telegram_users_username_idx').on(table.username),
}));

// Scheduled notifications table
export const telegramScheduledNotifications = sqliteTable('telegram_scheduled_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: text('chat_id').notNull(),
  type: text('type', { enum: ['daily_digest', 'weekly_report', 'custom'] }).notNull(),
  
  // Schedule
  scheduleTime: text('schedule_time').notNull(), // e.g., "09:00"
  scheduleDays: text('schedule_days', { mode: 'json' }).$type<string[]>(), // e.g., ["monday", "friday"]
  nextRunAt: integer('next_run_at', { mode: 'timestamp' }).notNull(),
  
  // Content
  template: text('template'), // Message template with placeholders
  filters: text('filters', { mode: 'json' }).$type<Record<string, any>>(), // e.g., { status: "completed", minDuration: 60 }
  
  // Status
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  lastRunStatus: text('last_run_status', { enum: ['success', 'failed', 'skipped'] }),
  lastRunError: text('last_run_error'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  chatIdIdx: index('telegram_scheduled_notif_chat_id_idx').on(table.chatId),
  nextRunIdx: index('telegram_scheduled_notif_next_run_idx').on(table.nextRunAt),
  activeIdx: index('telegram_scheduled_notif_active_idx').on(table.isActive),
}));

// Type exports
export type TelegramNotificationPreferences = typeof telegramNotificationPreferences.$inferSelect;
export type NewTelegramNotificationPreferences = typeof telegramNotificationPreferences.$inferInsert;
export type TelegramUser = typeof telegramUsers.$inferSelect;
export type NewTelegramUser = typeof telegramUsers.$inferInsert;
export type TelegramScheduledNotification = typeof telegramScheduledNotifications.$inferSelect;
export type NewTelegramScheduledNotification = typeof telegramScheduledNotifications.$inferInsert;